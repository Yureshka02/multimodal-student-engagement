from __future__ import annotations
import time
from typing import Any, Dict, Optional

import numpy as np
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.session import create_session, get_session, remove_session
from app.inference_fer import FerEngine
from app.inference_pose import PoseEngine

# ---- Load models once on startup ----
FER_MODEL_PATH = "models/fer2013_model.h5"
FER_LABELS_PATH = "models/fer2013_labels.json"
POSE_MODEL_PATH = "models/upper_body_binary_best.h5"

fer_engine = FerEngine(FER_MODEL_PATH, FER_LABELS_PATH)
pose_engine = PoseEngine(POSE_MODEL_PATH, threshold=0.5)

# ---- FastAPI + Socket.IO (ASGI) ----
fastapi_app = FastAPI()

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for MVP; lock down later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

@fastapi_app.post("/api/session/create")
async def api_create_session():
    st = create_session()
    return {"code": st.code}

def build_telemetry_payload(st) -> Dict[str, Any]:
    return {
        "ts": time.time(),
        "fer": {
            "faceDetected": st.face_detected,
            "label": st.fer_label,
            "conf": st.fer_conf,
            "color": st.fer_color,
        },
        "pose": {
            "prob": st.pose_prob,
            "status": st.pose_status,
            "color": st.pose_color,
        },
        "mouse": {
            "active": st.mouse_active,
            "idleMs": st.mouse_idle_ms,
        },
    }

async def emit_to_tutor(st):
    if st.tutor_sid:
        await sio.emit("telemetry", build_telemetry_payload(st), to=st.tutor_sid)

@sio.event
async def connect(sid, environ):
    # client connected
    return

@sio.event
async def disconnect(sid):
    # Clean up session bindings if needed
    # (For MVP, we just unbind)
    # Find session containing this sid:
    # Simple scan (OK for MVP small scale)
    from app.session import _session
    for st in list(_session.values()):
        if st.tutor_sid == sid:
            st.tutor_sid = None
        if st.student_sid == sid:
            st.student_sid = None

@sio.event
async def join_session(sid, data):
    code = (data or {}).get("code")
    role = (data or {}).get("role")

    st = get_session(code)
    if not st:
        return {"ok": False, "error": "INVALID_CODE"}

    if role == "tutor":
        st.tutor_sid = sid
        await sio.emit("status", {"studentConnected": st.student_sid is not None}, to=sid)
        return {"ok": True}

    if role == "student":
        # enforce 1 student
        if st.student_sid and st.student_sid != sid:
            return {"ok": False, "error": "STUDENT_ALREADY_CONNECTED"}
        st.student_sid = sid
        # notify tutor
        if st.tutor_sid:
            await sio.emit("status", {"studentConnected": True}, to=st.tutor_sid)
        return {"ok": True}

    return {"ok": False, "error": "INVALID_ROLE"}

@sio.event
async def frame(sid, data):
    """
    Student sends: { code, image } where image is dataURL (jpeg/webp base64)
    We'll run FER, update session state, and push telemetry to tutor.
    """
    code = (data or {}).get("code")
    image = (data or {}).get("image")
    st = get_session(code)
    if not st or sid != st.student_sid or not image:
        return

    fer = fer_engine.predict_from_frame_dataurl(image)
    st.face_detected = bool(fer["faceDetected"])
    st.fer_label = fer["label"]
    st.fer_conf = float(fer["conf"])
    st.fer_color = fer["color"]

    # IMPORTANT: If no face, force pose red too (your rule)
    if not st.face_detected:
        st.pose_color = "RED"
        st.pose_status = "FORCED_NOT_ENGAGED"
        st.pose_prob = None

    await emit_to_tutor(st)

@sio.event
async def pose_features(sid, data):
    print("Received pose features:", data)
    """
    Student sends: { code, features } where features is length-52 list[float]
    We'll buffer to 60, run model when ready, apply FER override rule, emit to tutor.
    """
    code = (data or {}).get("code")
    features = (data or {}).get("features")
    st = get_session(code)
    if not st or sid != st.student_sid or not isinstance(features, list) or len(features) != 52:
        return

    st.pose_buf.append([float(x) for x in features])

    # If no face -> keep forced RED
    if not st.face_detected:
        st.pose_color = "RED"
        st.pose_status = "FORCED_NOT_ENGAGED"
        st.pose_prob = None
        await emit_to_tutor(st)
        return

 # If buffer not ready -> GRAY (warming up)
    if len(st.pose_buf) < 60:
        st.pose_color = "GRAY"
        st.pose_status = f"WARMING_UP ({len(st.pose_buf)}/60)"
        st.pose_prob = None
        await emit_to_tutor(st)
        return


    window = np.array(st.pose_buf, dtype=np.float32)  # (60,52)
    out = pose_engine.predict_from_window(window, face_detected=True)

    st.pose_prob = out["prob"]
    st.pose_status = out["status"]
    st.pose_color = out["color"]

    await emit_to_tutor(st)

@sio.event
async def mouse(sid, data):
    """
    Student sends: { code, active, idleMs }
    """
    code = (data or {}).get("code")
    st = get_session(code)
    if not st or sid != st.student_sid:
        return

    st.mouse_active = bool((data or {}).get("active"))
    st.mouse_idle_ms = int((data or {}).get("idleMs") or 0)
    st.last_mouse_ts = time.time()

    await emit_to_tutor(st)
