import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

const SOCKET_URL = "http://localhost:8000";

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
    const ls = landmarks;

    const L = ls[11];
    const R = ls[12];

    const midX = (L.x + R.x) / 2;
    const midY = (L.y + R.y) / 2;
    const midZ = (L.z + R.z) / 2;

    const dx = L.x - R.x;
    const dy = L.y - R.y;
    const dz = L.z - R.z;
    const shoulderDist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;

    const feats = [];
    for (const idx of LANDMARK_IDX) {
      const p = ls[idx];
      feats.push((p.x - midX) / shoulderDist);
      feats.push((p.y - midY) / shoulderDist);
      feats.push((p.z - midZ) / shoulderDist);
      feats.push(p.visibility ?? 0);
    }
    return feats;
  }

  async function initPose() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    poseRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
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
    if (nowMs - lastPoseTs.current < 100) {
      requestAnimationFrame(runPoseLoop);
      return;
    }
    lastPoseTs.current = nowMs;

    const res = poseRef.current.detectForVideo(videoRef.current, nowMs);
    const poseLandmarks = res?.landmarks?.[0];

    if (poseLandmarks && poseLandmarks.length >= 24) {
      const feats = compute52Features(poseLandmarks);
      if (feats.length === 52) {
        socketRef.current.emit("pose_features", { code, features: feats });
      }
    }

    requestAnimationFrame(runPoseLoop);
  }

  // ---------------- Main effect ----------------
  useEffect(() => {
    if (!connected) return;

    let frameInterval = null;
    let mouseInterval = null;

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      await initPose();

      frameInterval = setInterval(sendFrame, 300);
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

      const stream = videoRef.current?.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}
      </style>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 8px 0',
            letterSpacing: '-0.5px',
          }}>
            Student Portal
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#666',
            margin: 0,
          }}>
            Real-time Engagement Monitoring
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e5e5e5',
        }}>
          {!connected ? (
            <>
              {/* Join Section */}
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  margin: '0 0 6px 0',
                  color: '#1a1a1a',
                }}>
                  Join Session
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: '0 0 20px 0',
                }}>
                  Enter the session code provided by your instructor
                </p>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid #e5e5e5',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      fontWeight: '500',
                      letterSpacing: '1px',
                    }}
                    placeholder="Enter Session Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && code && joinSession()}
                    onFocus={(e) => e.target.style.borderColor = '#14b8a6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                  />
                  <button 
                    style={{
                      padding: '12px 28px',
                      fontSize: '15px',
                      fontWeight: '600',
                      background: code ? '#14b8a6' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: code ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={joinSession} 
                    disabled={!code}
                    onMouseEnter={(e) => {
                      if (code) {
                        e.target.style.background = '#0d9488';
                        e.target.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (code) {
                        e.target.style.background = '#14b8a6';
                        e.target.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    Join Session
                  </button>
                </div>
              </div>

              {/* Instructions Section */}
              <div style={{
                padding: '24px',
                background: '#f8f9fa',
                borderRadius: '10px',
                border: '1px solid #e5e5e5',
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: '0 0 18px 0',
                  color: '#1a1a1a',
                }}>
                  Instructions
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  {[
                    { num: '1', text: 'Get the session code from your instructor' },
                    { num: '2', text: 'Allow camera access when prompted by your browser' },
                    { num: '3', text: 'Position yourself so your upper body is clearly visible' },
                    { num: '4', text: 'Stay engaged - the system monitors your attention and posture' },
                  ].map((item) => (
                    <div key={item.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#14b8a6',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '13px',
                        flexShrink: 0,
                      }}>
                        {item.num}
                      </span>
                      <span style={{
                        fontSize: '14px',
                        color: '#4b5563',
                        lineHeight: '1.6',
                        paddingTop: '3px',
                      }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  background: '#ecfdf5',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#065f46',
                  border: '1px solid #d1fae5',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M8 1L3 3V7C3 10.5 5.5 13.5 8 15C10.5 13.5 13 10.5 13 7V3L8 1Z" 
                          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  <span>Your privacy is protected. All data is processed in real-time and not stored.</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Connected Status */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: '#d1fae5',
                  borderRadius: '50px',
                  marginBottom: '18px',
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#14b8a6',
                    animation: 'pulse 2s infinite',
                  }}></div>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#065f46',
                  }}>
                    Connected to Session
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e5e5e5',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Camera:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#14b8a6' }}>Active ✓</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Pose Detection:</span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: poseReady ? '#14b8a6' : '#f59e0b'
                    }}>
                      {poseReady ? "Ready ✓" : "Loading..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Video Feed */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  position: 'relative',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#000',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}>
                  <video ref={videoRef} style={{
                    width: '100%',
                    display: 'block',
                    borderRadius: '10px',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      background: 'rgba(239, 68, 68, 0.9)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'white',
                        animation: 'blink 1.5s infinite',
                      }}></span>
                      LIVE
                    </span>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div style={{
                padding: '18px',
                background: '#f0fdfa',
                borderRadius: '8px',
                border: '1px solid #ccfbf1',
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: '0 0 12px 0',
                  color: '#134e4a',
                }}>
                  💡 Tips for Best Results
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  {[
                    'Ensure good lighting on your face',
                    'Sit upright with shoulders visible',
                    'Avoid excessive movement',
                    'Stay within the camera frame',
                  ].map((tip, i) => (
                    <li key={i} style={{
                      fontSize: '13px',
                      color: '#134e4a',
                      lineHeight: '1.5',
                    }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}