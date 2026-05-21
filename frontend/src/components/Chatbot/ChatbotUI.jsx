import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const ChatbotUI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente inteligente de Admin Residencial. ¿En qué te puedo ayudar hoy con el estado del conjunto?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChat = () => setIsOpen(!isOpen);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

      const res = await axios.post(
        `${API_URL}/chat`,
        { message: userMessage },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.data.response },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Lo siento, hubo un problema procesando tu mensaje." },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg =
        error.response?.status === 503
          ? "El modelo de IA está desactivado (falta GROQ_API_KEY en el servidor)."
          : "Hubo un error de conexión con el asistente.";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-[82px] left-[10px] z-[100] flex flex-col items-start">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[360px] sm:h-[460px] md:h-[500px] animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #0c1a2e 0%, #0a2540 100%)', borderBottom: '1px solid rgba(14,165,233,0.2)' }} className="p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.02em' }}>SafeEntry IA</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.65rem', color: '#64748B' }}>En línea</span>
                </div>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Cerrar chat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex w-full ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm bg-white text-slate-800 border border-slate-100 rounded-tl-sm flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={sendMessage}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta..."
              className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-full transition-colors disabled:opacity-50 shadow-md flex items-center justify-center focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label="Enviar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes se-fab-pulse {
              0% { transform: scale(1); opacity: 0.6; }
              70% { transform: scale(1.9); opacity: 0; }
              100% { transform: scale(1.9); opacity: 0; }
            }
            @keyframes se-fab-pulse2 {
              0% { transform: scale(1); opacity: 0.35; }
              70% { transform: scale(2.4); opacity: 0; }
              100% { transform: scale(2.4); opacity: 0; }
            }
            .se-fab-ring1 {
              position: absolute; inset: 0; border-radius: 50%;
              background: rgba(14,165,233,0.35);
              animation: se-fab-pulse 2s ease-out infinite;
            }
            .se-fab-ring2 {
              position: absolute; inset: 0; border-radius: 50%;
              background: rgba(14,165,233,0.18);
              animation: se-fab-pulse2 2s ease-out infinite 0.4s;
            }
            .se-fab-btn {
              position: relative; z-index: 1;
              width: 68px; height: 68px; border-radius: 50%;
              background: linear-gradient(135deg, #0c1a2e 0%, #0a2540 100%);
              border: 1.5px solid rgba(14,165,233,0.5);
              box-shadow: 0 0 20px rgba(14,165,233,0.3), 0 4px 16px rgba(0,0,0,0.4);
              display: flex; align-items: center; justify-content: center;
              cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
              overflow: hidden;
            }
            .se-fab-btn::before {
              content: '';
              position: absolute; top: 0; left: -100%;
              width: 60%; height: 100%;
              background: linear-gradient(90deg, transparent, rgba(14,165,233,0.15), transparent);
              animation: se-fab-shine 3s ease-in-out infinite;
            }
            @keyframes se-fab-shine {
              0% { left: -100%; }
              50% { left: 150%; }
              100% { left: 150%; }
            }
            .se-fab-btn:hover {
              transform: scale(1.08);
              box-shadow: 0 0 28px rgba(14,165,233,0.5), 0 6px 20px rgba(0,0,0,0.5);
            }
          `}</style>
          <div className="se-fab-ring2" />
          <div className="se-fab-ring1" />
          <button onClick={toggleChat} className="se-fab-btn" aria-label="Abrir Asistente IA SafeEntry">
            <svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="headGrad" cx="45%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#ffffff"/>
                  <stop offset="100%" stopColor="#bfdbfe"/>
                </radialGradient>
                <radialGradient id="eyeGrad" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#7dd3fc"/>
                  <stop offset="100%" stopColor="#0369a1"/>
                </radialGradient>
                <radialGradient id="bodyGrad" cx="40%" cy="20%" r="70%">
                  <stop offset="0%" stopColor="#e0f2fe"/>
                  <stop offset="100%" stopColor="#93c5fd"/>
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="1.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Antena base */}
              <line x1="32" y1="5" x2="32" y2="12" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round"/>
              {/* Antena bola con glow */}
              <circle cx="32" cy="4" r="3" fill="#0EA5E9" filter="url(#glow)"/>
              <circle cx="32" cy="4" r="1.5" fill="white" opacity="0.8"/>

              {/* Orejas */}
              <rect x="10" y="19" width="5" height="8" rx="2.5" fill="url(#bodyGrad)" stroke="#60a5fa" strokeWidth="1"/>
              <rect x="49" y="19" width="5" height="8" rx="2.5" fill="url(#bodyGrad)" stroke="#60a5fa" strokeWidth="1"/>

              {/* Cabeza */}
              <rect x="14" y="11" width="36" height="26" rx="10" fill="url(#headGrad)" stroke="#60a5fa" strokeWidth="1.2"/>
              {/* Brillo cabeza */}
              <ellipse cx="28" cy="16" rx="10" ry="4" fill="white" opacity="0.35"/>

              {/* Ojo izquierdo */}
              <circle cx="24" cy="24" r="6" fill="url(#eyeGrad)" stroke="#0284c7" strokeWidth="1"/>
              <circle cx="24" cy="24" r="3.5" fill="#0EA5E9"/>
              <circle cx="22.5" cy="22.5" r="1.2" fill="white" opacity="0.9"/>
              <circle cx="25.5" cy="25.5" r="0.6" fill="white" opacity="0.5"/>

              {/* Ojo derecho */}
              <circle cx="40" cy="24" r="6" fill="url(#eyeGrad)" stroke="#0284c7" strokeWidth="1"/>
              <circle cx="40" cy="24" r="3.5" fill="#0EA5E9"/>
              <circle cx="38.5" cy="22.5" r="1.2" fill="white" opacity="0.9"/>
              <circle cx="41.5" cy="25.5" r="0.6" fill="white" opacity="0.5"/>

              {/* Boca sonriente */}
              <path d="M26 33 Q32 38 38 33" stroke="#0369a1" strokeWidth="1.8" strokeLinecap="round" fill="none"/>

              {/* Cuerpo */}
              <rect x="19" y="40" width="26" height="16" rx="5" fill="url(#bodyGrad)" stroke="#60a5fa" strokeWidth="1.2"/>
              {/* Pantallita pecho */}
              <rect x="24" y="44" width="16" height="8" rx="3" fill="#0EA5E9" opacity="0.25"/>
              {/* Líneas pantalla */}
              <line x1="26" y1="47" x2="38" y2="47" stroke="#0EA5E9" strokeWidth="1" strokeLinecap="round" opacity="0.8"/>
              <line x1="28" y1="50" x2="36" y2="50" stroke="#0EA5E9" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatbotUI;
