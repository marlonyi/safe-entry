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

  // Focus primer input de código al montar
  useEffect(() => {
    if (step === 'form' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // Manejar input individual de cada dígito del código
  const handleCodigoChange = (index, value) => {
    if (value.length > 1) {
      // Si se pega un código completo
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

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codigo[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const codigoCompleto = codigo.join('');

    if (!cedula.trim()) {
      setError('Por favor ingresa tu número de cédula.');
      return;
    }
    if (codigoCompleto.length !== 6) {
      setError('El código debe tener 6 dígitos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Usar axios directamente (sin interceptor de api.js que corrompe esta respuesta)
      const resp = await axios.post(`${API_BASE}/visitantes/verificar-acceso`, {
        cedula: cedula.trim(),
        codigo: codigoCompleto
      });

      const data = resp.data;

      if (data.success === false) {
        setError(data.error || 'Error al verificar acceso.');
        return;
      }

      // Éxito: construir resultado con QR
      setResultado({
        visitante: data.visitante,
        qr: data.qr
      });
      setStep('success');
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al verificar. Intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute top-0 left-0 w-full h-[420px] bg-gradient-to-br from-teal-600 via-emerald-600 to-green-700 rounded-b-[80px] -translate-y-4 z-0">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-teal-300 rounded-full blur-3xl"></div>
        </div>
      </div>

      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl relative z-10 overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 pb-10 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <Shield size={200} className="absolute -right-10 -bottom-12 rotate-12" />
          </div>
          <button
            type="button"
            onClick={onBack}
            className="relative z-10 flex items-center gap-2 text-emerald-100 hover:text-white transition mb-4 text-sm font-medium group cursor-pointer"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Volver al inicio
          </button>
          <div className="relative z-10 flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Fingerprint size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Acceso Visitante</h1>
              <p className="text-emerald-100 text-sm">Ingresa con tu código de invitación</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 -mt-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex items-start gap-3">
            <KeyRound size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-emerald-800 text-xs leading-relaxed">
              Ingresa tu <strong>cédula</strong> y el <strong>código de 6 dígitos</strong> que te compartió el residente. El código cambia cada 10 minutos.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-5 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Cédula */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cédula de Identidad
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserCheck size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-700 font-medium"
                placeholder="Ej: 1010101010"
              />
            </div>
          </div>

          {/* Código de 6 dígitos */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Código de Acceso
            </label>
            <div className="flex gap-2 justify-between">
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
                  className="w-12 h-14 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
              ))}
            </div>
            <p className="text-slate-400 text-xs mt-2 flex items-center gap-1">
              <Clock size={12} /> El código cambia cada 10 min. Solicita uno nuevo si expiró.
            </p>
          </div>

          {/* Botón de acceso */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-70 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex justify-center items-center gap-2 group"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Verificando...
              </>
            ) : (
              <>
                <Shield size={18} />
                Verificar Acceso
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  const renderSuccess = () => {
    const baseUrl = window.location.origin;
    const qrUrl = resultado?.qr?.url || `${baseUrl}/verificar/${resultado?.qr?.token}`;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Fondo decorativo éxito */}
        <div className="absolute top-0 left-0 w-full h-[420px] bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-b-[80px] -translate-y-4 z-0">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          </div>
        </div>

        <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl relative z-10 overflow-hidden border border-slate-100">
          {/* Header éxito */}
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <CheckCircle2 size={200} className="absolute -right-10 -top-10" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={36} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-1">¡Acceso Autorizado!</h2>
              <p className="text-emerald-100 text-sm">Presenta este código QR en portería</p>
            </div>
          </div>

          {/* Contenido QR */}
          <div className="p-6 text-center">
            {/* Info del visitante */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
              <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-semibold">Visitante</p>
              <p className="text-slate-900 text-lg font-bold">
                {resultado?.visitante?.nombre} {resultado?.visitante?.apellido}
              </p>
              <p className="text-slate-500 text-sm">
                Cédula: {resultado?.visitante?.cedula}
              </p>
              {resultado?.visitante?.placa && (
                <p className="text-slate-500 text-sm font-mono">
                  Placa: {resultado.visitante.placa}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200 shadow-sm inline-block mb-4">
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="H"
                includeMargin={true}
                fgColor="#064e3b"
                bgColor="#ffffff"
              />
            </div>

            {/* Expiración */}
            {resultado?.qr?.expiracion && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-4">
                <Clock size={14} className="text-emerald-500" />
                <span>
                  Válido hasta: {new Date(resultado.qr.expiracion).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            )}

            {/* Instrucciones */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5">
              <p className="text-emerald-800 text-sm font-medium mb-1">📱 Instrucciones</p>
              <p className="text-emerald-700 text-xs leading-relaxed">
                Muestra esta pantalla al portero cuando llegues al conjunto. El código QR será escaneado para registrar tu ingreso.
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('form');
                  setCedula('');
                  setCodigo(['', '', '', '', '', '']);
                  setResultado(null);
                  setError('');
                }}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition text-sm"
              >
                Nueva consulta
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition text-sm"
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
