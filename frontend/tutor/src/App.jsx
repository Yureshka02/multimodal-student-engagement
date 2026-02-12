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
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
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
            Tutor Dashboard
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#666',
            margin: 0,
          }}>
            Monitor Student Engagement in Real-time
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
          {!code ? (
            <>
              {/* Create Session Section */}
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 24px',
                  background: '#f0fdfa',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ccfbf1',
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>

                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  margin: '0 0 8px 0',
                  color: '#1a1a1a',
                }}>
                  Start a New Session
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: '0 0 24px 0',
                  lineHeight: '1.5',
                }}>
                  Create a session and share the code with your students
                </p>

                <button 
                  onClick={createSession}
                  style={{
                    padding: '14px 32px',
                    fontSize: '15px',
                    fontWeight: '600',
                    background: '#14b8a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#0d9488';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(20, 184, 166, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#14b8a6';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  Create Session
                </button>
              </div>

              {/* Instructions */}
              <div style={{
                marginTop: '32px',
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '10px',
                border: '1px solid #e5e5e5',
              }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: '0 0 12px 0',
                  color: '#1a1a1a',
                }}>
                  📋 How it works
                </h3>
                <ul style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  {[
                    'Click "Create Session" to generate a unique code',
                    'Share the code with your students',
                    'Monitor their engagement metrics in real-time',
                    'Get instant alerts on attention and posture',
                  ].map((tip, i) => (
                    <li key={i} style={{
                      fontSize: '13px',
                      color: '#4b5563',
                      lineHeight: '1.5',
                    }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Session Code Display */}
              <div style={{
                padding: '24px',
                background: '#f0fdfa',
                borderRadius: '10px',
                border: '2px solid #14b8a6',
                marginBottom: '24px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f766e',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Session Code
                </div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#14b8a6',
                  letterSpacing: '4px',
                  fontFamily: 'monospace',
                }}>
                  {code}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#0f766e',
                  marginTop: '8px',
                }}>
                  Share this code with your students
                </div>
              </div>

              {/* Telemetry Data */}
              {telemetry ? (
                <div style={{
                  animation: 'fadeIn 0.3s ease-in',
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    margin: '0 0 16px 0',
                    color: '#1a1a1a',
                  }}>
                    📊 Live Metrics
                  </h3>

                  {/* FER Status */}
                  <div style={{
                    padding: '16px',
                    marginBottom: '12px',
                    borderRadius: '8px',
                    background: telemetry.fer.color === 'GREEN' ? '#d1fae5' :
                               telemetry.fer.color === 'YELLOW' ? '#fef3c7' :
                               telemetry.fer.color === 'GRAY' ? '#f3f4f6' : '#fee2e2',
                    border: `2px solid ${
                      telemetry.fer.color === 'GREEN' ? '#10b981' :
                      telemetry.fer.color === 'YELLOW' ? '#f59e0b' :
                      telemetry.fer.color === 'GRAY' ? '#9ca3af' : '#ef4444'
                    }`,
                    transition: 'all 0.3s',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#666',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          Facial Expression
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: telemetry.fer.color === 'GREEN' ? '#065f46' :
                                 telemetry.fer.color === 'YELLOW' ? '#92400e' :
                                 telemetry.fer.color === 'GRAY' ? '#4b5563' : '#991b1b',
                        }}>
                          {telemetry.fer.label || "NO FACE"}
                        </div>
                      </div>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: telemetry.fer.color === 'GREEN' ? '#10b981' :
                                   telemetry.fer.color === 'YELLOW' ? '#f59e0b' :
                                   telemetry.fer.color === 'GRAY' ? '#9ca3af' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        animation: telemetry.fer.color === 'GREEN' ? 'pulse 2s infinite' : 'none',
                      }}>
                        {telemetry.fer.color === 'GREEN' ? '😊' :
                         telemetry.fer.color === 'YELLOW' ? '😐' :
                         telemetry.fer.color === 'GRAY' ? '⏳' : '😟'}
                      </div>
                    </div>
                  </div>

                  {/* Pose Status */}
                  <div style={{
                    padding: '16px',
                    marginBottom: '12px',
                    borderRadius: '8px',
                    background: telemetry.pose.color === 'GREEN' ? '#d1fae5' :
                               telemetry.pose.color === 'YELLOW' ? '#fef3c7' :
                               telemetry.pose.color === 'GRAY' ? '#f3f4f6' : '#fee2e2',
                    border: `2px solid ${
                      telemetry.pose.color === 'GREEN' ? '#10b981' :
                      telemetry.pose.color === 'YELLOW' ? '#f59e0b' :
                      telemetry.pose.color === 'GRAY' ? '#9ca3af' : '#ef4444'
                    }`,
                    transition: 'all 0.3s',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#666',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          Upper Body Posture
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: telemetry.pose.color === 'GREEN' ? '#065f46' :
                                 telemetry.pose.color === 'YELLOW' ? '#92400e' :
                                 telemetry.pose.color === 'GRAY' ? '#4b5563' : '#991b1b',
                        }}>
                          {telemetry.pose.color === 'GREEN' ? 'Attentive' :
                           telemetry.pose.color === 'YELLOW' ? 'Neutral' :
                           telemetry.pose.color === 'GRAY' ? 'Warming Up' : 'Distracted'}
                        </div>
                      </div>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: telemetry.pose.color === 'GREEN' ? '#10b981' :
                                   telemetry.pose.color === 'YELLOW' ? '#f59e0b' :
                                   telemetry.pose.color === 'GRAY' ? '#9ca3af' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        animation: telemetry.pose.color === 'GREEN' ? 'pulse 2s infinite' : 'none',
                      }}>
                        {telemetry.pose.color === 'GREEN' ? '✓' :
                         telemetry.pose.color === 'YELLOW' ? '~' :
                         telemetry.pose.color === 'GRAY' ? '⏳' : '!'}
                      </div>
                    </div>
                  </div>

                  {/* Mouse Activity */}
                  <div style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: telemetry.mouse.active ? '#d1fae5' : '#f3f4f6',
                    border: `2px solid ${telemetry.mouse.active ? '#10b981' : '#9ca3af'}`,
                    transition: 'all 0.3s',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#666',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          Mouse Activity
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: telemetry.mouse.active ? '#065f46' : '#4b5563',
                        }}>
                          {telemetry.mouse.active ? 'ACTIVE' : `IDLE (${telemetry.mouse.idleMs} ms)`}
                        </div>
                      </div>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: telemetry.mouse.active ? '#10b981' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        animation: telemetry.mouse.active ? 'pulse 2s infinite' : 'none',
                      }}>
                        🖱️
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#666',
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    margin: '0 auto 16px',
                    border: '3px solid #e5e5e5',
                    borderTopColor: '#14b8a6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}></div>
                  <style>
                    {`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}
                  </style>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Waiting for students to join...
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}