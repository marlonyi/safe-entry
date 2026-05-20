import React, { useState, useEffect, useRef } from 'react';
import { Shield, ArrowLeft, KeyRound, UserCheck, QrCode, Clock, CheckCircle2, AlertCircle, Fingerprint } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

export default function VisitanteAcceso({ onBack }) {
  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [cedula, setCedula] = useState('');
  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === 'form' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const handleCodigoChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCodigo = [...codigo];
      digits.forEach((d, i) => {
        if (index + i < 6) newCodigo[index + i] = d;
      });
      setCodigo(newCodigo);
      const nextIdx = Math.min(index + digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }
    if (!/^\d*$/.test(value)) return;
    const newCodigo = [...codigo];
    newCodigo[index] = value;
    setCodigo(newCodigo);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codigo[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const codigoCompleto = codigo.join('');
    if (!cedula.trim()) { setError('Por favor ingresa tu número de cédula.'); return; }
    if (codigoCompleto.length !== 6) { setError('El código debe tener 6 dígitos.'); return; }

    setLoading(true);
    setError('');
    try {
      const resp = await axios.post(`${API_BASE}/visitantes/verificar-acceso`, {
        cedula: cedula.trim(),
        codigo: codigoCompleto
      });
      const data = resp.data;
      if (data.success === false) { setError(data.error || 'Error al verificar acceso.'); return; }
      setResultado({ visitante: data.visitante, qr: data.qr });
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al verificar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── FORM ─── */
  const renderForm = () => (
    <div className="min-h-screen flex items-center justify-center p-4 se-fade-in"
      style={{ background: 'var(--se-bg)', position: 'relative', overflow: 'hidden' }}>

      {/* Fondo decorativo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(14,165,233,0.12) 0%, transparent 70%)',
      }} />

      {/* Panel izquierdo oscuro — decorativo (solo md+) */}
      <div className="hidden md:block" style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '38%',
        background: 'var(--se-panel-bg)',
        borderRight: '1px solid var(--se-panel-border)',
        zIndex: 0,
      }}>
        {/* Scan line */}
        <div className="se-scanline" style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--se-accent), transparent)',
          opacity: 0.5,
        }} />
        {/* Decorative grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)',
        }} />
        {/* Shield mark */}
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          opacity: 0.04,
        }}>
          <Shield size={220} color="#fff" />
        </div>

        {/* Brand text */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            background: 'rgba(14,165,233,0.15)',
            border: '1px solid rgba(14,165,233,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Shield size={30} color="var(--se-accent)" />
          </div>
          <p className="se-heading" style={{ color: '#F1F5F9', fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
            SafeEntry
          </p>
          <p style={{ color: '#475569', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Control de Acceso
          </p>
        </div>
      </div>

      {/* Card central */}
      <div className="se-slide-up" style={{
        position: 'relative', zIndex: 1,
        background: 'var(--se-surface)',
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
        border: '1px solid var(--se-border)',
        width: '100%', maxWidth: 440,
        overflow: 'hidden',
      }}>
        {/* Accent top bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1)' }} />

        {/* Card header */}
        <div style={{ padding: '1.75rem 1.75rem 1.25rem' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.8rem', fontWeight: 600,
              color: 'var(--se-text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              marginBottom: '1.25rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--se-accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--se-text-muted)'}
          >
            <ArrowLeft size={14} />
            Volver al inicio
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--se-accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Fingerprint size={24} style={{ color: 'var(--se-accent)' }} />
            </div>
            <div>
              <h1 className="se-heading" style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--se-text-primary)', marginBottom: 2 }}>
                Acceso Visitante
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)' }}>
                Ingresa con tu código de invitación
              </p>
            </div>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} style={{ padding: '0 1.75rem 1.75rem' }}>

          {/* Info hint */}
          <div style={{
            background: 'var(--se-accent-dim)',
            border: '1px solid rgba(14,165,233,0.2)',
            borderRadius: 12,
            padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            marginBottom: '1.25rem',
          }}>
            <KeyRound size={16} style={{ color: 'var(--se-accent)', marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: '0.75rem', color: '#0369A1', lineHeight: 1.5 }}>
              Ingresa tu <strong>cédula</strong> y el <strong>código de 6 dígitos</strong> que te compartió el residente.
              El código cambia cada 10 minutos.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'var(--se-error-dim)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '0.65rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: '1rem',
            }}>
              <AlertCircle size={15} style={{ color: 'var(--se-error)', flexShrink: 0 }} />
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--se-error)' }}>{error}</p>
            </div>
          )}

          {/* Cédula */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block', marginBottom: 6,
              fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--se-text-secondary)',
            }}>
              Cédula de Identidad
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <UserCheck size={17} style={{ color: 'var(--se-text-muted)' }} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej: 1010101010"
                className="se-input"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          {/* Código 6 dígitos */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block', marginBottom: 6,
              fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--se-text-secondary)',
            }}>
              Código de Acceso
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {codigo.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleCodigoChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  style={{
                    width: 44, height: 52,
                    textAlign: 'center',
                    fontSize: '1.375rem', fontWeight: 800,
                    background: digit ? 'var(--se-accent-dim)' : 'var(--se-bg)',
                    border: `2px solid ${digit ? 'var(--se-accent)' : 'var(--se-border)'}`,
                    borderRadius: 12,
                    color: 'var(--se-text-primary)',
                    outline: 'none',
                    transition: 'all 0.15s',
                    boxShadow: digit ? '0 0 0 3px var(--se-accent-dim)' : 'none',
                  }}
                />
              ))}
            </div>
            <p style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--se-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> El código cambia cada 10 min. Solicita uno nuevo si expiró.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="se-btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.9rem', borderRadius: 14 }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'se-arc-spin 0.8s linear infinite',
                }} />
                Verificando...
              </>
            ) : (
              <>
                <Shield size={17} />
                Verificar Acceso
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  /* ─── SUCCESS ─── */
  const renderSuccess = () => {
    const baseUrl = window.location.origin;
    const qrUrl = resultado?.qr?.url || `${baseUrl}/verificar/${resultado?.qr?.token}`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 se-fade-in"
        style={{ background: 'var(--se-bg)', position: 'relative', overflow: 'hidden' }}>

        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.10) 0%, transparent 65%)',
        }} />

        <div className="se-slide-up" style={{
          position: 'relative', zIndex: 1,
          background: 'var(--se-surface)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
          border: '1px solid var(--se-border)',
          width: '100%', maxWidth: 440,
          overflow: 'hidden',
        }}>
          {/* Accent top bar — success */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />

          {/* Success header */}
          <div style={{
            background: 'var(--se-panel-bg)',
            borderBottom: '1px solid var(--se-panel-border)',
            padding: '2rem 1.75rem',
            textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <CheckCircle2 size={32} style={{ color: '#10B981' }} />
            </div>
            <h2 className="se-heading" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>
              Acceso Autorizado
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
              Presenta este código QR en portería
            </p>
          </div>

          {/* QR content */}
          <div style={{ padding: '1.5rem 1.75rem 1.75rem' }}>

            {/* Info visitante */}
            <div style={{
              background: 'var(--se-bg)',
              border: '1px solid var(--se-border)',
              borderRadius: 12,
              padding: '0.875rem 1rem',
              marginBottom: '1.25rem',
            }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 4 }}>
                Visitante
              </p>
              <p className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
                {resultado?.visitante?.nombre} {resultado?.visitante?.apellido}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--se-text-secondary)', marginTop: 2 }}>
                Cédula: {resultado?.visitante?.cedula}
              </p>
              {resultado?.visitante?.placa && (
                <p style={{ fontSize: '0.8rem', color: 'var(--se-text-secondary)', fontFamily: 'monospace' }}>
                  Placa: {resultado.visitante.placa}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{
                display: 'inline-block',
                padding: '1rem',
                borderRadius: 16,
                border: '2px solid rgba(14,165,233,0.25)',
                background: '#fff',
                boxShadow: '0 4px 20px rgba(14,165,233,0.12)',
              }}>
                <QRCodeSVG
                  value={qrUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                  fgColor="#0F1923"
                  bgColor="#ffffff"
                />
              </div>
            </div>

            {/* Expiración */}
            {resultado?.qr?.expiracion && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: '0.78rem', color: 'var(--se-text-muted)',
                marginBottom: '1rem',
              }}>
                <Clock size={13} style={{ color: 'var(--se-accent)' }} />
                Válido hasta: {new Date(resultado.qr.expiracion).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}

            {/* Instrucciones */}
            <div style={{
              background: 'var(--se-accent-dim)',
              border: '1px solid rgba(14,165,233,0.2)',
              borderRadius: 12, padding: '0.875rem 1rem',
              marginBottom: '1.25rem',
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <QrCode size={14} /> Instrucciones
              </p>
              <p style={{ fontSize: '0.75rem', color: '#0369A1', lineHeight: 1.6 }}>
                Muestra esta pantalla al portero cuando llegues al conjunto. El código QR será escaneado para registrar tu ingreso.
              </p>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setStep('form');
                  setCedula('');
                  setCodigo(['', '', '', '', '', '']);
                  setResultado(null);
                  setError('');
                }}
                className="se-btn-ghost"
                style={{ flex: 1, justifyContent: 'center', borderRadius: 12 }}
              >
                Nueva consulta
              </button>
              <button
                onClick={onBack}
                className="se-btn-primary"
                style={{ flex: 1, justifyContent: 'center', borderRadius: 12 }}
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return step === 'form' ? renderForm() : renderSuccess();
}
