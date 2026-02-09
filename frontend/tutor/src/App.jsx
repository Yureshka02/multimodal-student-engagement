import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:9000";

export default function App() {
  const [code, setCode] = useState(null);
  const [telemetry, setTelemetry] = useState(null);

  const socketRef = useRef(null);

  const createSession = async () => {
    const res = await fetch(`${SOCKET_URL}/api/session/create`, {
      method: "POST",
    });
    const data = await res.json();
    setCode(data.code);

    socketRef.current = io(SOCKET_URL);
    socketRef.current.on("connect", () => {
      socketRef.current.emit("join_session", {
        code: data.code,
        role: "tutor",
      });
    });

    socketRef.current.on("telemetry", (data) => {
      setTelemetry(data);
    });
  };

  const colorStyle = (c) => ({
  padding: "10px",
  margin: "5px 0",
  color: "white",
  backgroundColor:
    c === "GREEN" ? "green" :
    c === "YELLOW" ? "orange" :
    c === "GRAY" ? "gray" :
    "red",
});


  return (
    <div style={{ padding: 20 }}>
      <h2>Tutor Page</h2>

      {!code && <button onClick={createSession}>Create Session</button>}

      {code && <h3>Session Code: {code}</h3>}

      {telemetry && (
        <>
          <div style={colorStyle(telemetry.fer.color)}>
            FER: {telemetry.fer.color} ({telemetry.fer.label || "NO FACE"})
          </div>

          <div style={colorStyle(telemetry.pose.color)}>
            Upper Body: {telemetry.pose.color}
          </div>

          <div>
            Mouse:{" "}
            {telemetry.mouse.active
              ? "ACTIVE"
              : `IDLE (${telemetry.mouse.idleMs} ms)`}
          </div>
        </>
      )}
    </div>
  );
}
