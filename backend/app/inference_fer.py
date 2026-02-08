from __future__ import annotations
import base64
import json
import re
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

import cv2
import numpy as np
import tensorflow as tf

DATAURL_RE = re.compile(r"^data:image\/[a-zA-Z0-9.+-]+;base64,")

class FerEngine:
    def __init__(self, model_path: str, labels_path: str):
        self.model = tf.keras.models.load_model(model_path)
        self.labels = json.loads(Path(labels_path).read_text(encoding="utf-8"))

        # Haar cascade for frontal face (same family you used locally)
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

    def _decode_dataurl_to_bgr(self, dataurl: str) -> Optional[np.ndarray]:
        try:
            b64 = DATAURL_RE.sub("", dataurl)
            raw = base64.b64decode(b64)
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR
            return img
        except Exception:
            return None

    def predict_from_frame_dataurl(self, dataurl: str) -> Dict[str, Any]:
        """
        Returns:
          faceDetected, label, conf, color
        Color rules you requested:
          - RED if no frontal face
          - GREEN if label in {neutral, happy, angry}
          - YELLOW otherwise
        """
        frame = self._decode_dataurl_to_bgr(dataurl)
        if frame is None:
            return {"faceDetected": False, "label": None, "conf": 0.0, "color": "RED"}

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.2, minNeighbors=5, minSize=(40, 40)
        )
        if len(faces) == 0:
            return {"faceDetected": False, "label": None, "conf": 0.0, "color": "RED"}

        # pick biggest face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        face = gray[y : y + h, x : x + w]
        face = cv2.resize(face, (48, 48), interpolation=cv2.INTER_AREA)

        # model expects (48,48,1) normalized
        x_in = (face.astype(np.float32) / 255.0)[None, ..., None]  # (1,48,48,1)

        probs = self.model.predict(x_in, verbose=0)[0]
        idx = int(np.argmax(probs))
        conf = float(probs[idx])
        label = str(self.labels[idx])

        if label in ("neutral", "happy", "angry"):
            color = "GREEN"
        else:
            color = "YELLOW"

        return {"faceDetected": True, "label": label, "conf": conf, "color": color}
