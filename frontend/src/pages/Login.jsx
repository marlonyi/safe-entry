import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, Fingerprint, ArrowRight, AlertCircle, Camera, QrCode, BarChart3, Bell } from 'lucide-react';
import api from '../services/api';
import Logo from '../components/Logo';

export default function Login({ onLoginSuccess, onVisitanteAcceso }) {
  const [showPassword, setShowPassword] = useState(false);
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Soporte para múltiples conjuntos si el backend devuelve 300
  const [conjuntos, setConjuntos] = useState([]);
  const [selectedConjuntoId, setSelectedConjuntoId] = useState('');

  const handleSupportLogin = async (e) => {
    e.preventDefault();
    if (!cedula || !password) {
      setError('Por favor ingresa cédula y contraseña.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const payload = { cedula, password };
      if (selectedConjuntoId) {
        payload.conjuntoId = selectedConjuntoId;
      }
      
      const response = await api.post('/usuarios/login', payload);
      
      // Si el backend pide selección de conjunto (status 300 manejado como valid response por axios si configuramos algo, pero 300 lanza error por defecto. Mejor atraparlo en catch).
      
      onLoginSuccess(response.data.data || response.data);
    } catch (err) {
      console.log(err.response);
      if (err.response && err.response.status === 300) {
        setConjuntos(err.response.data.conjuntos);
        setError('Por favor selecciona tu conjunto.');
      } else {
        setError(err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Elementos decorativos */}
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-600 rounded-b-[100px] shadow-2xl skew-y-2 -translate-y-10 z-0"></div>

      <div className="bg-white max-w-5xl w-full rounded-3xl shadow-2xl relative z-10 flex overflow-hidden border border-slate-100">
        
        {/* Lado Izquierdo: Formulario */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
          <div className="mb-10 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-6">
              <Logo variant="default" theme="light" subtitle="Control inteligente y acceso seguro" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido de nuevo</h1>
            <p className="text-slate-500 text-sm">Ingresa tus credenciales para acceder a tu ecosistema residencial</p>
          </div>

          <form className="space-y-6" onSubmit={handleSupportLogin}>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cédula de Identidad</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-700"                                            
                  placeholder="Ej: 1010101010"
                />
              </div>
            </div>

            <div>
               <div className="flex justify-between items-center mb-2">
                 <label className="block text-sm font-semibold text-slate-700">Contraseña</label>
                 <a href="#" className="font-semibold text-xs text-blue-600 hover:text-blue-800 transition">¿Olvidaste tu contraseña?</a>
               </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-700"                                           
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}     
                </button>
              </div>
            </div>

            {conjuntos.length > 0 && (
              <div className="mt-4 p-4 border border-blue-100 bg-blue-50/50 rounded-xl">
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccione su Conjunto:</label>
                 <select 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedConjuntoId}
                    onChange={(e) => setSelectedConjuntoId(e.target.value)}
                 >
                    <option value="">-- Seleccionar --</option>
                    {conjuntos.map(c => (
                      <option key={c.conjuntoId} value={c.conjuntoId}>{c.conjuntoNombre}</option>
                    ))}
                 </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2 group mt-6"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /> }
            </button>
          </form>

          {/* Separador + Botón Visitante */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-center text-slate-400 text-xs mb-3">¿Eres un visitante con código de acceso?</p>
            <button
              type="button"
              onClick={onVisitanteAcceso}
              className="w-full py-3 border-2 border-emerald-200 text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-all flex justify-center items-center gap-2 group"
            >
              <ShieldCheck size={18} className="text-emerald-500" />
              Entrar como Visitante
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Lado Derecho: Branding + Features */}
        <div className="hidden lg:flex w-1/2 flex-col p-12 relative overflow-hidden justify-center gap-10 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            {/* Patrón de fondo decorativo */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-20" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600 rounded-full blur-3xl opacity-10" />
              {/* Grid sutil */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }}
              />
            </div>

            {/* Logo + Hero text */}
            <div className="relative z-10 space-y-7">
               <div className="mb-2">
                  <Logo variant="hero" theme="dark" subtitle="Control inteligente y acceso seguro" />
               </div>
               <h2 className="text-4xl font-bold text-white leading-tight">
                 Seguridad <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Inteligente</span><br/>para tu Conjunto.
               </h2>
               <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                 Control de acceso vehicular con cámara de IA (YOLOv8), gestión de residentes, auditoría forense y accesos QR, todo acoplado en una misma plataforma.
               </p>

               {/* Feature pills */}
               <div className="grid grid-cols-2 gap-3 pt-2 max-w-md">
                 {[
                   { icon: Camera, label: 'Cámara IA · YOLOv8', color: 'from-blue-500 to-cyan-500' },
                   { icon: QrCode, label: 'Accesos QR dinámicos', color: 'from-emerald-500 to-teal-500' },
                   { icon: BarChart3, label: 'Dashboard Power BI', color: 'from-purple-500 to-fuchsia-500' },
                   { icon: Bell, label: 'Alertas en tiempo real', color: 'from-orange-500 to-amber-500' }
                 ].map((f, i) => (
                   <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/[0.06] transition-all">
                     <div className={`p-1.5 rounded-lg bg-gradient-to-br ${f.color} shadow-lg`}>
                       <f.icon size={14} className="text-white" />
                     </div>
                     <span className="text-xs text-slate-200 font-medium">{f.label}</span>
                   </div>
                 ))}
               </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 pt-6 mt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium">© {new Date().getFullYear()} SafeEntry</span>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-slate-300 transition">Soporte</a>
                <a href="#" className="hover:text-slate-300 transition">Términos</a>
                <a href="#" className="hover:text-slate-300 transition">Privacidad</a>
              </div>
            </div>
        </div>

      </div>
    </div>
  );
}
