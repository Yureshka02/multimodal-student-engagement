import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

const SOCKET_URL = "http://localhost:9000";

// Match your Python: landmarks 11..23 inclusive (13 points)
const LANDMARK_IDX = [11,12,13,14,15,16,17,18,19,20,21,22,23];

export default function App() {
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [poseReady, setPoseReady] = useState(false);

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const lastMouseTs = useRef(Date.now());

  // MediaPipe
  const poseRef = useRef(null);
  const lastPoseTs = useRef(0);

  // ---------------- Socket connect / join ----------------
  const joinSession = () => {
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join_session", { code, role: "student" });
      setConnected(true);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket connect_error:", err);
    });
  };

  // ---------------- Mouse tracking ----------------
  const markMouse = () => {
    lastMouseTs.current = Date.now();
  };

  const sendMouseHeartbeat = () => {
    if (!socketRef.current) return;
    const idleMs = Date.now() - lastMouseTs.current;
    socketRef.current.emit("mouse", {
      code,
      active: idleMs < 1500,
      idleMs,
    });
  };

  // ---------------- FER frame sender ----------------
  const sendFrame = () => {
    if (!socketRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = 320;
    canvas.height = 240;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.5);

    socketRef.current.emit("frame", { code, image: dataUrl });
  };

  // ---------------- Pose feature extraction ----------------
  function compute52Features(landmarks) {
    // landmarks: array of 33 pose landmarks with {x,y,z,visibility}
    const ls = landmarks;

    // shoulders
    const L = ls[11];
    const R = ls[12];

    // mid-shoulder and shoulder distance
    const midX = (L.x + R.x) / 2;
    const midY = (L.y + R.y) / 2;
    const midZ = (L.z + R.z) / 2;

    const dx = L.x - R.x;
    const dy = L.y - R.y;
    const dz = L.z - R.z;
    const shoulderDist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;

    // Build 13 * 4 = 52 features: (x,y,z,visibility) normalized
    const feats = [];
    for (const idx of LANDMARK_IDX) {
      const p = ls[idx];
      feats.push((p.x - midX) / shoulderDist);
      feats.push((p.y - midY) / shoulderDist);
      feats.push((p.z - midZ) / shoulderDist);
      feats.push(p.visibility ?? 0);
    }
    return feats; // length 52
  }

  async function initPose() {
    // Load wasm assets
    const vision = await FilesetResolver.forVisionTasks(
      // CDN-hosted mediapipe wasm assets
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    // Load PoseLandmarker model
    poseRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        // CDN-hosted pose model
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });

    setPoseReady(true);
  }

  function runPoseLoop() {
    if (!poseRef.current || !videoRef.current || !socketRef.current) return;

    const nowMs = performance.now();
    // Throttle pose calls (~10 FPS)
    if (nowMs - lastPoseTs.current < 100) {
      requestAnimationFrame(runPoseLoop);
      return;
    }
    lastPoseTs.current = nowMs;

    const res = poseRef.current.detectForVideo(videoRef.current, nowMs);
    const poseLandmarks = res?.landmarks?.[0];

    if (poseLandmarks && poseLandmarks.length >= 24) {
      const feats = compute52Features(poseLandmarks);
      // Safety check
      if (feats.length === 52) {
        socketRef.current.emit("pose_features", { code, features: feats });
      }
    }

    requestAnimationFrame(runPoseLoop);
  }

  // ---------------- Main effect: start everything after connect ----------------
  useEffect(() => {
    if (!connected) return;

    let frameInterval = null;
    let mouseInterval = null;

    (async () => {
      // Start camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Init pose
      await initPose();

      // Start loops
      frameInterval = setInterval(sendFrame, 300); // ~3 FPS (FER)
      mouseInterval = setInterval(sendMouseHeartbeat, 1000);

      window.addEventListener("mousemove", markMouse);
      window.addEventListener("mousedown", markMouse);
      window.addEventListener("keydown", markMouse);

      requestAnimationFrame(runPoseLoop);
    })().catch((e) => console.error(e));

    return () => {
      if (frameInterval) clearInterval(frameInterval);
      if (mouseInterval) clearInterval(mouseInterval);
      window.removeEventListener("mousemove", markMouse);
      window.removeEventListener("mousedown", markMouse);
      window.removeEventListener("keydown", markMouse);

      // Stop camera
      const stream = videoRef.current?.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Student</h2>

      {!connected ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Session Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button onClick={joinSession} disabled={!code}>
            Join
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div>Connected ✅</div>
          <div>Pose: {poseReady ? "Ready ✅" : "Loading..."}</div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <video ref={videoRef} style={{ width: 360, borderRadius: 8 }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      <p style={{ marginTop: 10, opacity: 0.8 }}>
        Keep your upper body visible. Pose will start feeding the model and the
        tutor should see GRAY warmup → GREEN/RED.
      </p>
    </div>
  );
}
