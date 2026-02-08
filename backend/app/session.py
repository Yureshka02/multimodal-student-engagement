from __future__ import annotations
from dataclasses import dataclass, field
from collections import deque
from typing import Optional, Deque, Dict, Any
import secrets
import string
import time

def make_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

@dataclass
class SessionState:
    code: str
    tutor_sid: Optional[str] = None
    student_sid: Optional[str] = None

    # Pose buffer: rolling (60,52)
    pose_buf: Deque[list[float]] = field(default_factory=lambda: deque(maxlen=60))

    # Last known FER state
    face_detected: bool = False
    fer_label: Optional[str] = None
    fer_conf: float = 0.0
    fer_color: str = "RED"

    # Last known Pose state
    pose_prob: Optional[float] = None
    pose_color: str = "RED"
    pose_status: str = "NOT_ENGAGED"

    # Mouse state (from student)
    mouse_active: bool = False
    mouse_idle_ms: int = 0
    last_mouse_ts: float = field(default_factory=time.time)

_session: Dict[str, SessionState] = {}

def create_session() -> SessionState:
    code = make_code()
    while code in _session:
        code = make_code()
    st = SessionState(code=code)
    _session[code] = st
    return st

def get_session(code: str) -> Optional[SessionState]:
    return _session.get(code)

def remove_session(code: str) -> None:
    _session.pop(code, None)
