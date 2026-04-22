"""
MQTT Bridge — central message broker integration.
Publishes fleet state and subscribes to robot telemetry.
Inspired by free_fleet's Zenoh communication layer.
"""

import json
import logging
import asyncio
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from config import settings

logger = logging.getLogger(__name__)


class MqttBridge:
    """MQTT bridge for fleet-wide communication."""

    def __init__(self):
        self._client: mqtt.Client | None = None
        self._connected = False
        self._message_handlers: dict[str, list] = {}

    async def connect(self):
        self._client = mqtt.Client(
            client_id="fleet_command_center",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

        try:
            self._client.connect(
                settings.mqtt_broker, settings.mqtt_port, settings.mqtt_keepalive
            )
            self._client.loop_start()
            self._connected = True
            logger.info("MQTT bridge connected to %s:%d",
                        settings.mqtt_broker, settings.mqtt_port)
        except Exception as e:
            logger.warning("MQTT bridge connect failed: %s (continuing without MQTT)", e)

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        # Subscribe to fleet-wide topics
        topics = [
            "fleet/+/telemetry",
            "fleet/+/status",
            "fleet/+/heartbeat",
            "fleet/+/alert",
            "fleet/+/error",
        ]
        for topic in topics:
            client.subscribe(topic)

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            # Dispatch to registered handlers
            for pattern, handlers in self._message_handlers.items():
                if mqtt.topic_matches_sub(pattern, msg.topic):
                    for handler in handlers:
                        handler(msg.topic, payload)
        except Exception as e:
            logger.warning("MQTT message error: %s", e)

    def on_topic(self, pattern: str, handler):
        """Register a handler for a topic pattern."""
        self._message_handlers.setdefault(pattern, []).append(handler)

    def publish(self, topic: str, payload: dict, qos: int = 1):
        """Publish a message to an MQTT topic."""
        if self._client and self._connected:
            self._client.publish(topic, json.dumps(payload), qos=qos)

    def publish_fleet_state(self, state: dict):
        """Broadcast fleet state to all subscribers."""
        self.publish("fleet/state", state)

    def publish_command(self, robot_id: str, command: dict):
        """Send command to a specific robot."""
        self.publish(f"fleet/{robot_id}/command", command)

    def publish_alert(self, robot_id: str, alert: dict):
        """Publish an alert for a robot."""
        alert["timestamp"] = datetime.now(timezone.utc).isoformat()
        self.publish(f"fleet/{robot_id}/alert", alert)

    async def disconnect(self):
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._connected = False
