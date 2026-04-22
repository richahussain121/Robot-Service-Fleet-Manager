from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./fleet_manager.db"

    # MQTT
    mqtt_broker: str = "localhost"
    mqtt_port: int = 1883
    mqtt_keepalive: int = 60

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # OpenAI (for LLM-based task planning)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Fleet
    robot_state_update_hz: float = 2.0
    job_allocation_interval_sec: float = 5.0

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
