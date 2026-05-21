import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck, Wifi } from 'lucide-react';
import api from '../services/api';
import Logo from '../components/Logo';

/* ─────────────────────────────────────────────
   Keyframe + font injection (CSS-only, no libs)
───────────────────────────────────────────── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  :root {
    --se-bg: #F7F8FA;
    --se-surface: #FFFFFF;
    --se-border: #E2E6ED;
    --se-border-focus: #0EA5E9;
    --se-text-primary: #0F1923;
    --se-text-secondary: #64748B;
    --se-text-muted: #94A3B8;
    --se-accent: #0EA5E9;
    --se-accent-dim: rgba(14, 165, 233, 0.12);
    --se-accent-glow: rgba(14, 165, 233, 0.35);
    --se-amber: #F59E0B;
    --se-amber-dim: rgba(245, 158, 11, 0.10);
    --se-error: #EF4444;
    --se-error-dim: rgba(239, 68, 68, 0.08);
    --se-panel-bg: #080D14;
    --se-panel-mid: #0D1520;
    --se-panel-border: rgba(14, 165, 233, 0.12);
  }

  .se-root * {
    font-family: 'DM Sans', sans-serif;
    box-sizing: border-box;
  }

  .se-heading {
    font-family: 'Syne', sans-serif;
  }

  /* Radar pulse behind logo */
  @keyframes se-radar-ring {
    0%   { transform: scale(0.55); opacity: 0.55; }
    100% { transform: scale(2.2);  opacity: 0; }
  }
  .se-radar-ring {
    animation: se-radar-ring 3.2s ease-out infinite;
  }
  .se-radar-ring:nth-child(2) { animation-delay: 1.05s; }
  .se-radar-ring:nth-child(3) { animation-delay: 2.1s;  }

  /* Slow rotating arc */
  @keyframes se-arc-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .se-arc-spin {
    animation: se-arc-spin 18s linear infinite;
  }
  .se-arc-spin-rev {
    animation: se-arc-spin 26s linear infinite reverse;
  }

  /* Scan line sweep on right panel */
  @keyframes se-scanline {
    0%   { top: -6%;   opacity: 0; }
    8%   { opacity: 0.6; }
    92%  { opacity: 0.6; }
    100% { top: 106%;  opacity: 0; }
  }
  .se-scanline {
    animation: se-scanline 7s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Staggered form field slide-up */
  @keyframes se-slide-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .se-slide-up {
    animation: se-slide-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .se-delay-1 { animation-delay: 0.05s; }
  .se-delay-2 { animation-delay: 0.12s; }
  .se-delay-3 { animation-delay: 0.19s; }
  .se-delay-4 { animation-delay: 0.26s; }
  .se-delay-5 { animation-delay: 0.33s; }
  .se-delay-6 { animation-delay: 0.40s; }
  .se-delay-7 { animation-delay: 0.47s; }

  /* Input focus ring expansion */
  .se-input-wrap {
    position: relative;
  }
  .se-input-wrap::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 10px;
    border: 1.5px solid var(--se-border-focus);
    opacity: 0;
    transform: scale(1.01);
    transition: opacity 0.18s ease, transform 0.18s ease;
    pointer-events: none;
  }
  .se-input-wrap:focus-within::after {
    opacity: 1;
    transform: scale(1);
  }

  /* Submit button glow on hover */
  .se-submit-btn {
    position: relative;
    overflow: hidden;
    transition: transform 0.15s ease, box-shadow 0.2s ease;
  }
  .se-submit-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .se-submit-btn:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px var(--se-accent-glow), 0 2px 8px rgba(0,0,0,0.18);
  }
  .se-submit-btn:not(:disabled):hover::before { opacity: 1; }
  .se-submit-btn:not(:disabled):active        { transform: translateY(0px); }

  /* Visitor button */
  .se-visitor-btn {
    transition: background 0.18s ease, transform 0.15s ease, border-color 0.18s ease;
  }
  .se-visitor-btn:hover {
    transform: translateY(-1px);
    border-color: var(--se-amber);
    background: var(--se-amber-dim);
  }
  .se-visitor-btn:active { transform: translateY(0px); }

  /* Status dot blink */
  @keyframes se-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }
  .se-blink { animation: se-blink 2.2s ease-in-out infinite; }

  /* Tilt grid lines on right panel */
  .se-grid-overlay {
    background-image:
      linear-gradient(rgba(14,165,233,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(14,165,233,0.045) 1px, transparent 1px);
    background-size: 52px 52px;
  }

  /* Corner bracket decoration */
  .se-corner-tl, .se-corner-br {
    position: absolute;
    width: 18px;
    height: 18px;
    pointer-events: none;
  }
  .se-corner-tl {
    top: 14px; left: 14px;
    border-top: 1.5px solid var(--se-accent);
    border-left: 1.5px solid var(--se-accent);
    opacity: 0.55;
  }
  .se-corner-br {
    bottom: 14px; right: 14px;
    border-bottom: 1.5px solid var(--se-accent);
    border-right: 1.5px solid var(--se-accent);
    opacity: 0.55;
  }

  /* Error shake */
  @keyframes se-shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-5px); }
    40%       { transform: translateX(5px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }
  .se-shake { animation: se-shake 0.38s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
`;

/* ─────────────────────────────────────────────
   Architectural data for right panel stats
───────────────────────────────────────────── */
const PANEL_STATS = [
  { value: '99.8%', label: 'Uptime SLA' },
  { value: 'AES-256', label: 'Cifrado en tránsito' },
  { value: '<50ms', label: 'Latencia media' },
];

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function Login({ onLoginSuccess, onVisitanteAcceso }) {
  const [showPassword, setShowPassword]       = useState(false);
  const [cedula, setCedula]                   = useState('');
  const [password, setPassword]               = useState('');
  const [error, setError]                     = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [conjuntos, setConjuntos]             = useState([]);
  const [selectedConjuntoId, setSelectedConjuntoId] = useState('');
  const [shakeError, setShakeError]           = useState(false);
  const [currentTime, setCurrentTime]         = useState('');

  // Live clock for the right panel status bar
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cedula || !password) {
      setError('Ingresa tu cédula y contraseña para continuar.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = { cedula, password };
      if (selectedConjuntoId) payload.conjuntoId = selectedConjuntoId;

      const response = await api.post('/usuarios/login', payload);
      onLoginSuccess(response.data.data || response.data);
    } catch (err) {
      if (err.response?.status === 300) {
        setConjuntos(err.response.data.conjuntos);
        setError('Se encontraron varios conjuntos. Selecciona el tuyo.');
      } else {
        setError(
          err.response?.data?.error || 'Credenciales incorrectas. Verifica e intenta de nuevo.'
        );
        triggerShake();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Inject global styles once */}
      <style>{GLOBAL_STYLES}</style>

      <div
        className="se-root h-screen flex flex-col lg:flex-row overflow-hidden"
        style={{ background: 'var(--se-surface)' }}
      >
          {/* ════════════════════════════════════
              LEFT — Form panel
          ════════════════════════════════════ */}
          <div
            className="w-full lg:w-[46%] flex flex-col justify-between p-5 sm:p-8 lg:p-12 relative overflow-y-auto"
            style={{ background: 'var(--se-surface)' }}
          >
            {/* Form content */}
            <div className="flex-1 flex flex-col justify-center">
              {/* Heading */}
              <div className="mb-5 sm:mb-8 se-slide-up se-delay-2">
                <h1
                  className="se-heading text-[1.4rem] sm:text-[1.85rem] font-bold leading-tight mb-1.5"
                  style={{ color: 'var(--se-text-primary)', letterSpacing: '-0.02em' }}
                >
                  Bienvenido de nuevo
                </h1>
                <p style={{ color: 'var(--se-text-secondary)', fontSize: '0.875rem', fontWeight: 300 }}>
                  Accede a tu ecosistema residencial de forma segura.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* Error banner */}
                {error && (
                  <div
                    className={`flex items-start gap-3 p-3.5 rounded-xl ${shakeError ? 'se-shake' : ''}`}
                    style={{
                      background: 'var(--se-error-dim)',
                      border: '1px solid rgba(239,68,68,0.18)',
                    }}
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircle size={16} style={{ color: 'var(--se-error)', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
                    <p style={{ color: 'var(--se-error)', fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45 }}>
                      {error}
                    </p>
                  </div>
                )}

                {/* Cedula field */}
                <div className="se-slide-up se-delay-3">
                  <label
                    htmlFor="se-cedula"
                    style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--se-text-secondary)', marginBottom: '7px' }}
                  >
                    Cédula de identidad
                  </label>
                  <div className="se-input-wrap">
                    <div
                      style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        paddingLeft: '14px', display: 'flex', alignItems: 'center', pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    >
                      <User size={15} style={{ color: 'var(--se-text-muted)' }} aria-hidden="true" />
                    </div>
                    <input
                      id="se-cedula"
                      type="text"
                      inputMode="numeric"
                      autoComplete="username"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value)}
                      placeholder="Ej: 1010101010"
                      required
                      style={{
                        width: '100%',
                        paddingLeft: '40px',
                        paddingRight: '14px',
                        paddingTop: '11px',
                        paddingBottom: '11px',
                        background: 'var(--se-bg)',
                        border: '1.5px solid var(--se-border)',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        color: 'var(--se-text-primary)',
                        outline: 'none',
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                        display: 'block',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'transparent';
                        e.target.style.background = '#fff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--se-border)';
                        e.target.style.background = 'var(--se-bg)';
                      }}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="se-slide-up se-delay-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
                    <label
                      htmlFor="se-password"
                      style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--se-text-secondary)' }}
                    >
                      Contraseña
                    </label>
                    <a
                      href="#"
                      style={{ fontSize: '0.75rem', color: 'var(--se-accent)', fontWeight: 500, textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.target.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.target.style.textDecoration = 'none')}
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  <div className="se-input-wrap">
                    <div
                      style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        paddingLeft: '14px', display: 'flex', alignItems: 'center', pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    >
                      <Lock size={15} style={{ color: 'var(--se-text-muted)' }} aria-hidden="true" />
                    </div>
                    <input
                      id="se-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      style={{
                        width: '100%',
                        paddingLeft: '40px',
                        paddingRight: '44px',
                        paddingTop: '11px',
                        paddingBottom: '11px',
                        background: 'var(--se-bg)',
                        border: '1.5px solid var(--se-border)',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        color: 'var(--se-text-primary)',
                        outline: 'none',
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                        display: 'block',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'transparent';
                        e.target.style.background = '#fff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--se-border)';
                        e.target.style.background = 'var(--se-bg)';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0,
                        paddingRight: '13px', display: 'flex', alignItems: 'center',
                        color: 'var(--se-text-muted)', background: 'none', border: 'none',
                        cursor: 'pointer', zIndex: 2, transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--se-accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--se-text-muted)')}
                    >
                      {showPassword
                        ? <EyeOff size={15} aria-hidden="true" />
                        : <Eye size={15} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Conjunto selector — appears when backend returns 300 */}
                {conjuntos.length > 0 && (
                  <div
                    className="se-slide-up se-delay-1"
                    style={{
                      padding: '14px',
                      background: 'var(--se-accent-dim)',
                      border: '1.5px solid rgba(14,165,233,0.22)',
                      borderRadius: '12px',
                    }}
                    role="group"
                    aria-labelledby="conjunto-label"
                  >
                    <p
                      id="conjunto-label"
                      style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--se-accent)', marginBottom: '8px' }}
                    >
                      Selecciona tu conjunto residencial
                    </p>
                    <select
                      id="se-conjunto"
                      value={selectedConjuntoId}
                      onChange={(e) => setSelectedConjuntoId(e.target.value)}
                      aria-labelledby="conjunto-label"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#fff',
                        border: '1.5px solid var(--se-border)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        color: 'var(--se-text-primary)',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'auto',
                      }}
                    >
                      <option value="">-- Seleccionar conjunto --</option>
                      {conjuntos.map((c) => (
                        <option key={c.conjuntoId} value={c.conjuntoId}>
                          {c.conjuntoNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Submit */}
                <div className="se-slide-up se-delay-5 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="se-submit-btn"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '13px 20px',
                      background: loading
                        ? 'var(--se-text-secondary)'
                        : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                      color: '#fff',
                      fontFamily: "'Syne', sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 4px 18px var(--se-accent-glow)',
                    }}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <svg
                          width="15" height="15" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5"
                          style={{ animation: 'se-arc-spin 0.75s linear infinite', flexShrink: 0 }}
                          aria-hidden="true"
                        >
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        Verificando identidad…
                      </>
                    ) : (
                      <>
                        Iniciar Sesión
                        <ArrowRight
                          size={15}
                          aria-hidden="true"
                          style={{ transition: 'transform 0.2s ease' }}
                          className="group-hover:translate-x-1"
                        />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Visitor CTA at bottom */}
            <div
              className="se-slide-up se-delay-7 mt-5 pt-5 sm:mt-8 sm:pt-6"
              style={{ borderTop: '1px solid var(--se-border)' }}
            >
              <p
                style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--se-text-muted)', marginBottom: '10px', fontWeight: 400 }}
              >
                ¿Eres visitante con código de acceso?
              </p>
              <button
                type="button"
                onClick={onVisitanteAcceso}
                className="se-visitor-btn"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 20px',
                  background: 'var(--se-amber-dim)',
                  border: '1.5px solid rgba(245,158,11,0.30)',
                  borderRadius: '10px',
                  color: '#B45309',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                aria-label="Acceder como visitante con código QR"
              >
                <ShieldCheck size={15} style={{ color: 'var(--se-amber)', flexShrink: 0 }} aria-hidden="true" />
                Ingresar como Visitante
                <ArrowRight size={13} style={{ color: '#D97706', marginLeft: 'auto' }} aria-hidden="true" />
              </button>
            </div>

            {/* Footer — visible en el panel del formulario */}
            <div className="flex lg:hidden items-center justify-between" style={{ paddingTop: '16px', borderTop: '1px solid var(--se-border)', marginTop: '1.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--se-text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                © {new Date().getFullYear()} SafeEntry
              </span>
              <div style={{ display: 'flex', gap: '16px' }}>
                {['Soporte', 'Términos', 'Privacidad'].map((l) => (
                  <a key={l} href="#" style={{ fontSize: '0.7rem', color: 'var(--se-text-muted)', fontWeight: 400, textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => (e.target.style.color = 'var(--se-text-primary)')}
                    onMouseLeave={(e) => (e.target.style.color = 'var(--se-text-muted)')}
                  >{l}</a>
                ))}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════
              RIGHT — Branding panel (lg+ only)
          ════════════════════════════════════ */}
          <div
            className="hidden lg:flex flex-1 flex-col relative overflow-hidden"
            style={{ background: 'var(--se-panel-bg)' }}
            aria-hidden="true"
          >
            {/* Architectural grid */}
            <div className="se-grid-overlay absolute inset-0" />

            {/* Scanline sweep */}
            <div
              className="se-scanline absolute inset-x-0 pointer-events-none z-10"
              style={{
                height: '2px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.5) 40%, rgba(14,165,233,0.8) 50%, rgba(14,165,233,0.5) 60%, transparent 100%)',
                boxShadow: '0 0 16px 4px rgba(14,165,233,0.25)',
              }}
            />

            {/* Ambient glow blobs */}
            <div
              style={{
                position: 'absolute', top: '-10%', right: '-10%',
                width: '480px', height: '480px',
                background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 65%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute', bottom: '-8%', left: '-8%',
                width: '380px', height: '380px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)',
                pointerEvents: 'none',
              }}
            />

            {/* Corner brackets */}
            <div className="se-corner-tl" />
            <div className="se-corner-br" />

            {/* ── Content ── */}
            <div className="relative z-10 flex flex-col h-full p-11 overflow-y-auto">

              {/* Top status bar */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '28px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className="se-blink"
                    style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Sistema en línea
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Wifi size={11} style={{ color: '#64748B' }} />
                  <span style={{ fontFamily: "'DM Sans', monospace", fontSize: '0.72rem', color: '#94A3B8', letterSpacing: '0.05em' }}>
                    {currentTime}
                  </span>
                </div>
              </div>

              {/* Radar / logo hero section */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', height: '180px' }}>

                {/* Radar pulse rings */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="se-radar-ring"
                    style={{
                      position: 'absolute',
                      width: '160px', height: '160px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(14,165,233,0.45)',
                      animationDelay: `${i * 1.05}s`,
                    }}
                  />
                ))}

                {/* Outer rotating dashed arc */}
                <div
                  className="se-arc-spin"
                  style={{
                    position: 'absolute',
                    width: '190px', height: '190px',
                    borderRadius: '50%',
                    border: '1px dashed rgba(14,165,233,0.18)',
                  }}
                />
                {/* Inner counter-rotating arc */}
                <div
                  className="se-arc-spin-rev"
                  style={{
                    position: 'absolute',
                    width: '130px', height: '130px',
                    borderRadius: '50%',
                    border: '1px dashed rgba(99,102,241,0.20)',
                  }}
                />

                {/* Logo centered */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <Logo variant="hero" theme="dark" subtitle={null} />
                </div>
              </div>

              {/* Headline */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2
                  className="se-heading"
                  style={{
                    fontSize: '2rem', fontWeight: 800,
                    color: '#fff', letterSpacing: '-0.025em',
                    lineHeight: 1.2, marginBottom: '12px',
                  }}
                >
                  Seguridad inteligente<br />
                  <span
                    style={{
                      background: 'linear-gradient(90deg, #0EA5E9, #818CF8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    para tu conjunto.
                  </span>
                </h2>
                <p
                  style={{
                    fontSize: '0.8125rem', color: '#94A3B8',
                    lineHeight: 1.65, maxWidth: '320px',
                    margin: '0 auto', fontWeight: 300,
                  }}
                >
                  Control de acceso vehicular con IA, gestión de residentes, auditoría forense y accesos QR dinámicos en una sola plataforma.
                </p>
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px', marginBottom: '20px',
                }}
              >
                {PANEL_STATS.map((s) => (
                  <div
                    key={s.label}
                    style={{
                      textAlign: 'center',
                      padding: '14px 8px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(14,165,233,0.09)',
                      borderRadius: '10px',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <p
                      className="se-heading"
                      style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0EA5E9', letterSpacing: '-0.02em', marginBottom: '3px' }}
                    >
                      {s.value}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Footer */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: '18px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span
                  className="se-heading"
                  style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  © {new Date().getFullYear()} SafeEntry
                </span>
                <div style={{ display: 'flex', gap: '18px' }}>
                  {['Soporte', 'Términos', 'Privacidad'].map((l) => (
                    <a
                      key={l}
                      href="#"
                      style={{
                        fontSize: '0.7rem', color: '#64748B', fontWeight: 400,
                        textDecoration: 'none', transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.target.style.color = '#CBD5E1')}
                      onMouseLeave={(e) => (e.target.style.color = '#64748B')}
                    >
                      {l}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

      </div>
    </>
  );
}
