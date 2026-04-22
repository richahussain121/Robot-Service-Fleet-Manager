"""Fleet state snapshot — merges ROOSTER MexListInfo with transact fleet monitoring."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class FleetState(Base):
    """Periodic fleet snapshots for analytics and history."""

    __tablename__ = "fleet_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    total_robots: Mapped[int] = mapped_column(Integer, default=0)
    online: Mapped[int] = mapped_column(Integer, default=0)
    standby: Mapped[int] = mapped_column(Integer, default=0)
    charging: Mapped[int] = mapped_column(Integer, default=0)
    executing: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[int] = mapped_column(Integer, default=0)
    offline: Mapped[int] = mapped_column(Integer, default=0)

    active_jobs: Mapped[int] = mapped_column(Integer, default=0)
    pending_jobs: Mapped[int] = mapped_column(Integer, default=0)
    completed_jobs_today: Mapped[int] = mapped_column(Integer, default=0)

    # Location context
    facility: Mapped[str] = mapped_column(String(128), default="main")
    notes: Mapped[str] = mapped_column(Text, default="")
