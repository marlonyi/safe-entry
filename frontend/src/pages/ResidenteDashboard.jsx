import React, { useState, useEffect } from 'react';
import { Home, Users, Car, KeyRound, Plus, Share2, Shield, Bell, X, Eye, Clock } from 'lucide-react';
import api from '../services/api';

export default function ResidenteDashboard({ user }) {
  const [view, setView] = useState('home');
  const [visitantes, setVisitantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [nuevoVisitante, setNuevoVisitante] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    placaVehiculo: ''
  });

  // Vehicle states
  const [placaVehiculo, setPlacaVehiculo] = useState(user?.placaVehiculo || '');
  const [placa2Vehiculo, setPlaca2Vehiculo] = useState(user?.placa2Vehiculo || '');
  const [tieneVehiculo, setTieneVehiculo] = useState(user?.tieneVehiculo ?? false);
  const [vehiculoLoading, setVehiculoLoading] = useState(false);
  const [vehiculoSuccess, setVehiculoSuccess] = useState('');
  const [vehiculoError, setVehiculoError] = useState('');

  // Código Modal states
  const [showCodigoModal, setShowCodigoModal] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState(null);
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [codigoDinamico, setCodigoDinamico] = useState(null);

  const fetchVisitantes = async () => {
    try {
      setLoading(true);
      const resp = await api.get(`/visitantes/misVisitantes/${user.id}`);
      setVisitantes(Array.isArray(resp.data?.data) ? resp.data.data : Array.isArray(resp.data) ? resp.data : []);
    } catch (error) {
      console.error("Error al cargar visitantes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'visitantes') {
      fetchVisitantes();
    }
  }, [view]);

  const handleCrearVisitante = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.post('/visitantes', {
        nombreVisitante: nuevoVisitante.nombre,
        apellidoVisitante: nuevoVisitante.apellido,
        cedulaVisitante: nuevoVisitante.cedula,
        placaVisitante: nuevoVisitante.placaVehiculo || 'N/A', // El backend exige placa, enviamos N/A si no tiene
        residenteId: user.id
      });
      setSuccessMsg('Visitante creado exitosamente.');
      setNuevoVisitante({ nombre: '', apellido: '', cedula: '', placaVehiculo: '' });
      fetchVisitantes();
      setTimeout(() => setView('visitantes'), 2000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Error al registrar visitante'); 
    }
  };

  const handleGuardarVehiculo = async (e) => {
    e.preventDefault();
    setVehiculoError('');
    setVehiculoSuccess('');
    setVehiculoLoading(true);
    try {
      await api.put(`/usuarios/${user.id}`, {
        tieneVehiculo,
        placaVehiculo: tieneVehiculo ? placaVehiculo.toUpperCase() : '',
        placa2Vehiculo: tieneVehiculo ? placa2Vehiculo.toUpperCase() : ''
      });
      setVehiculoSuccess('Datos del vehículo actualizados correctamente.');
    } catch (err) {
      console.error(err);
      setVehiculoError(err.response?.data?.error || 'Error al actualizar vehículo');
    } finally {
      setVehiculoLoading(false);
    }
  };

  const handleVerCodigo = async (visitante) => {
    setSelectedVisitante(visitante);
    setShowCodigoModal(true);
    setLoadingCodigo(true);
    setCodigoDinamico(null);
    try {
      // Obtener código dinámico TOTP
      const resp = await api.get(`/visitantes/${visitante._id || visitante.id}/codigo-actual`);
      setCodigoDinamico(resp.data);
    } catch (error) {
      console.error('Error al obtener código:', error);
      alert('Error al obtener código de acceso: ' + (error.response?.data?.error || error.message));
      setShowCodigoModal(false);
    } finally {
      setLoadingCodigo(false);
    }
  };

  const renderHome = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 shadow-lg shadow-emerald-200 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Nuevo Visitante</h2>
            <p className="text-emerald-100 mb-6 max-w-sm">Genera un código de acceso para que tu invitado entre sin demoras en portería.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setView('crear')} className="bg-white text-emerald-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition hover:-translate-y-0.5">
                <KeyRound size={18} /> Registrar Visitante
              </button>
            </div>
          </div>
          <Shield size={180} className="absolute -right-8 -bottom-10 text-emerald-500/20 rotate-12" />
        </div>
      </div>
    </div>
  );

  const renderVisitantes = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Mis Visitantes / Autorizaciones</h2>
        <button onClick={() => setView('crear')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
           <Plus size={16} /> Nuevo Visitante
        </button>
      </div>
      
      {loading ? (
        <p className="text-slate-500 text-center py-4">Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="p-3">Nombre</th>
                <th className="p-3">Cédula</th>
                <th className="p-3">Placa</th>
                <th className="p-3">Estado / QR</th>
              </tr>
            </thead>
            <tbody>
              {visitantes.map((v, i) => (
                <tr key={v._id || i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-3">{v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}</td>
                  <td className="p-3">{v.cedulaVisitante || v.cedula}</td>
                  <td className="p-3 font-mono">{v.placaVisitante || v.placaVehiculo || '-'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleVerCodigo(v)}
                      className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-100 text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition-colors"
                    >
                       <KeyRound size={14}/> Ver Código
                    </button>
                  </td>
                </tr>
              ))}
              {visitantes.length === 0 && (
                <tr><td colSpan="4" className="p-4 text-center text-slate-500">No tienes visitantes recientes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderCrear = () => (
    <div className="max-w-xl bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
       <h2 className="text-2xl font-bold text-slate-900 mb-6">Registrar Invitado</h2>
       {errorMsg && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{errorMsg}</div>}
       {successMsg && <div className="bg-emerald-50 text-emerald-600 p-3 rounded mb-4 text-sm">{successMsg}</div>}
       <form onSubmit={handleCrearVisitante} className="space-y-4">
         <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
             <input type="text" required value={nuevoVisitante.nombre} onChange={e => setNuevoVisitante({...nuevoVisitante, nombre: e.target.value})} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500" />
           </div>
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
             <input type="text" required value={nuevoVisitante.apellido} onChange={e => setNuevoVisitante({...nuevoVisitante, apellido: e.target.value})} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500" />
           </div>
         </div>
         <div>
           <label className="block text-sm font-medium text-slate-700 mb-1">Cédula</label>
           <input type="text" required value={nuevoVisitante.cedula} onChange={e => setNuevoVisitante({...nuevoVisitante, cedula: e.target.value})} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500" />
         </div>
         <div>
           <label className="block text-sm font-medium text-slate-700 mb-1">Placa Vehículo (Opcional)</label>
           <input type="text" value={nuevoVisitante.placaVehiculo} onChange={e => setNuevoVisitante({...nuevoVisitante, placaVehiculo: e.target.value})} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500" placeholder="Ej. ABC-123" />
         </div>
         <div className="pt-4 flex gap-3">
           <button type="button" onClick={() => setView('home')} className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50 text-slate-700 font-medium">Cancelar</button>
           <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium flex-1">Registrar y Generar QR</button>
         </div>
       </form>
    </div>
  );

  const renderVehiculo = () => (
    <div className="max-w-2xl bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
          <Car size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Mi Vehículo</h2>
          <p className="text-slate-500 text-sm">Gestiona la información de tus vehículos para el control de acceso.</p>
        </div>
      </div>

      {vehiculoError && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-red-100">{vehiculoError}</div>}
      {vehiculoSuccess && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-emerald-100">{vehiculoSuccess}</div>}

      <form onSubmit={handleGuardarVehiculo} className="space-y-6">
        <div className="pb-4 border-b border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={tieneVehiculo}
              onChange={(e) => setTieneVehiculo(e.target.checked)}
              className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 transition-all"
            />
            <span className="font-semibold text-slate-700">Tengo vehículo(s) propio(s)</span>
          </label>
        </div>

        {tieneVehiculo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Placa Principal</label>
              <input 
                type="text" 
                value={placaVehiculo}
                onChange={(e) => setPlacaVehiculo(e.target.value)}
                placeholder="Ej. ABC-123"
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono uppercase bg-slate-50 focus:bg-white" 
              />
              <p className="text-xs text-slate-400">Sin guiones ni espacios si prefieres</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Placa Adicional <span className="font-normal text-slate-400 border border-slate-200 px-2 py-0.5 rounded text-xs ml-1">Opcional</span></label>
              <input 
                type="text" 
                value={placa2Vehiculo}
                onChange={(e) => setPlaca2Vehiculo(e.target.value)}
                placeholder="Ej. XYZ-987"
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono uppercase bg-slate-50 focus:bg-white" 
              />
            </div>
          </div>
        )}

        <div className="pt-4 flex gap-4">
          <button 
            type="submit" 
            disabled={vehiculoLoading}
            className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-sm hover:shadow transition flex justify-center items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {vehiculoLoading ? 'Guardando...' : 'Guardar Información'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex w-full">
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex-col fixed h-full z-10 shadow-sm transition-all overflow-hidden hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center justify-center lg:justify-start gap-3">
          <div className="w-10 h-10 min-w-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-200">
            S
          </div>
          <div className="hidden lg:block whitespace-nowrap">
            <span className="font-bold text-slate-800 block">Torre {user?.torre || "2"}</span>
            <span className="text-xs text-slate-500">Apt {user?.apartamento || "405"}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2">
          <button onClick={() => setView('home')} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === 'home' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Home size={22} /><span className="hidden lg:block">Mi Hogar</span>
          </button>
          <button onClick={() => setView('visitantes')} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === 'visitantes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}>
             <Users size={22} /><span className="hidden lg:block">Mis Visitantes</span>
          </button>
          <button onClick={() => setView('vehiculo')} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === 'vehiculo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Car size={22} /><span className="hidden lg:block">Mi Vehículo</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 md:ml-20 lg:ml-64 p-4 lg:p-8">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <img src={`https://ui-avatars.com/api/?name=${user?.nombre || 'User'}&background=10b981&color=fff`} alt="Profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Hola, {user?.nombre || "Residente"}!</h1>
              <p className="text-sm text-slate-500">Apt {user?.apartamento || ""} - Torre {user?.torre || ""}</p>
            </div>
          </div>
        </header>

        {view === 'home' && renderHome()}
        {view === 'visitantes' && renderVisitantes()}
        {view === 'crear' && renderCrear()}
        {view === 'vehiculo' && renderVehiculo()}
      </main>

      {/* Modal Código de Acceso */}
      {showCodigoModal && selectedVisitante && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">Código de Acceso</h3>
                  <p className="text-emerald-100 text-sm mt-1">
                    {selectedVisitante.nombre || selectedVisitante.nombreVisitante} {selectedVisitante.apellido || selectedVisitante.apellidoVisitante}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCodigoModal(false);
                    setSelectedVisitante(null);
                    setCodigoDinamico(null);
                  }}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {loadingCodigo ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500">Generando código...</p>
                </div>
              ) : codigoDinamico?.codigo ? (
                <>
                  {/* Código TOTP */}
                  <div className="mb-6">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                      <p className="text-amber-800 text-sm font-medium mb-3 flex items-center gap-2 justify-center">
                        <KeyRound size={18} /> Código de Acceso Dinámico
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        {codigoDinamico.codigo.split('').map((digit, i) => (
                          <span
                            key={i}
                            className="w-12 h-14 bg-white border-2 border-amber-300 rounded-lg flex items-center justify-center text-3xl font-bold text-amber-700 shadow-sm"
                          >
                            {digit}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-amber-600 text-sm font-medium flex items-center justify-center gap-1">
                          <Clock size={14} /> Válido por {Math.floor((codigoDinamico.expiraEn || 600) / 60)} minutos más
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Instrucciones */}
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-emerald-800 text-sm font-medium mb-2">📱 Instrucciones</p>
                    <ul className="text-emerald-700 text-sm space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">1.</span>
                        Comparte este código de 6 dígitos con tu visitante (WhatsApp, SMS, etc.)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">2.</span>
                        El visitante ingresa a "Acceso Visitante" en la página principal
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">3.</span>
                        Ingresa su cédula y este código para generar su QR de acceso
                      </li>
                    </ul>
                  </div>

                  {/* Botón cerrar */}
                  <button
                    onClick={() => {
                      setShowCodigoModal(false);
                      setSelectedVisitante(null);
                      setCodigoDinamico(null);
                    }}
                    className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No se pudo generar el código. Intenta de nuevo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
