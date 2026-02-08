from __future__ import annotations
from typing import Dict, Any, Optional
import numpy as np
import tensorflow as tf

class PoseEngine:
    def __init__(self, model_path: str, threshold: float = 0.5):
        self.model = tf.keras.models.load_model(model_path)
        self.threshold = threshold

    def predict_from_window(
        self,
        window_60x52: np.ndarray,
        face_detected: bool,
    ) -> Dict[str, Any]:
        """
        Your locked rules:
          - If no frontal face detected -> pose must be RED
          - Binary classification: GREEN=ENGAGED, RED=NOT_ENGAGED
          - If window not ready -> RED (we handle readiness outside)
        """
        if not face_detected:
            return {"windowReady": True, "prob": None, "status": "FORCED_NOT_ENGAGED", "color": "RED"}

        x = window_60x52.astype(np.float32)[None, ...]  # (1,60,52)
        prob = float(self.model.predict(x, verbose=0)[0][0])

        if prob >= self.threshold:
            return {"windowReady": True, "prob": prob, "status": "ENGAGED", "color": "GREEN"}
        return {"windowReady": True, "prob": prob, "status": "NOT_ENGAGED", "color": "RED"}
