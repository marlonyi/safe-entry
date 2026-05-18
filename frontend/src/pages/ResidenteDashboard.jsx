import React, { useState, useEffect } from 'react';
import { Home, Users, Car, KeyRound, Plus, Shield, X, Clock, ArrowRightCircle, UserCheck, Activity, MapPin } from 'lucide-react';
import api from '../services/api';
import Logo from '../components/Logo';

export default function ResidenteDashboard({ user }) {
  const [view, setView] = useState('home');
  const [visitantes, setVisitantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [misAccesos, setMisAccesos] = useState([]);
  const [parqueaderoInfo, setParqueaderoInfo] = useState(null);
  const [perfil, setPerfil] = useState(null);

  const unwrap = (resp) => {
    const d = resp?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.data?.items)) return d.data.items;
    return [];
  };

  // Form states
  const [nuevoVisitante, setNuevoVisitante] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    placaVehiculo: ''
  });

  // Vehicle states
  const [placaVehiculo, setPlacaVehiculo] = useState(user?.placa || '');
  const [placa2Vehiculo, setPlaca2Vehiculo] = useState('');
  const [tieneVehiculo, setTieneVehiculo] = useState(!!user?.placa);
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
      setVisitantes(unwrap(resp));
    } catch (error) {
      console.error("Error al cargar visitantes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHomeData = async () => {
    try {
      // 1. Cargar perfil completo (trae placa, parqueaderoAsignado, etc.)
      const perfilResp = await api.get(`/usuarios/perfil/${user.id}`).catch(() => ({ data: null }));
      const perfilData = perfilResp.data || null;
      setPerfil(perfilData);

      // 2. Cargar visitantes
      const visResp = await api.get(`/visitantes/misVisitantes/${user.id}`).catch(() => ({ data: [] }));
      setVisitantes(unwrap(visResp));

      // 3. Cargar accesos del residente filtrando por su placa (usa perfil completo)
      const placa = perfilData?.placaVehiculo || user?.placa;
      if (placa) {
        const accResp = await api.get(`/parqueaderos/historial?placa=${placa}&limit=10`).catch(() => ({ data: { items: [] } }));
        setMisAccesos(unwrap(accResp));
      } else {
        setMisAccesos([]);
      }

      // 4. Info del parqueadero asignado (si tiene)
      const parqAsignadoId = perfilData?.parqueaderoAsignado;
      if (parqAsignadoId) {
        const parqResp = await api.get(`/parqueaderos`).catch(() => ({ data: [] }));
        const todos = unwrap(parqResp);
        const idStr = typeof parqAsignadoId === 'object' ? parqAsignadoId._id : parqAsignadoId;
        const mio = todos.find(p => (p._id || p.id) === idStr);
        if (mio) setParqueaderoInfo(mio);
      } else {
        setParqueaderoInfo(null);
      }
    } catch (error) {
      console.error("Error cargando home residente:", error);
    }
  };

  useEffect(() => {
    if (view === 'home') fetchHomeData();
    if (view === 'visitantes') fetchVisitantes();
    if (view === 'vehiculo') {
      // Sincronizar campos con perfil real
      (async () => {
        const r = await api.get(`/usuarios/perfil/${user.id}`).catch(() => ({ data: null }));
        const p = r.data;
        if (p) {
          setPerfil(p);
          setPlacaVehiculo(p.placaVehiculo || '');
          setPlaca2Vehiculo(p.placa2Vehiculo || '');
          setTieneVehiculo(p.tieneVehiculo ?? !!p.placaVehiculo);
        }
      })();
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
      // Recargar perfil para reflejar cambios en Home
      const r = await api.get(`/usuarios/perfil/${user.id}`).catch(() => ({ data: null }));
      if (r.data) setPerfil(r.data);
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

  const renderHome = () => {
    const visTotal = visitantes.length;
    const visPend = visitantes.filter(v => v.estado === 'pendiente').length;
    const visDentro = visitantes.filter(v => v.estado === 'ingresado').length;
    const inicioSemana = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const accesosSemana = misAccesos.filter(a => new Date(a.fechaHora).getTime() >= inicioSemana).length;

    // Datos del perfil (con fallback al user del JWT)
    const tieneVehiculo = perfil?.tieneVehiculo ?? user?.tieneVehiculo ?? false;
    const placaPrincipal = perfil?.placaVehiculo || user?.placa || null;
    const placaSecundaria = perfil?.placa2Vehiculo || null;
    const conjuntoNombre = perfil?.conjunto?.nombre || null;
    const estadoExpensa = perfil?.estadoExpensa || null;

    const cards = [
      { title: 'Mis Visitantes', value: visTotal, icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-100' },
      { title: 'Pendientes', value: visPend, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100' },
      { title: 'Dentro Ahora', value: visDentro, icon: UserCheck, color: 'text-blue-700', bg: 'bg-blue-100' },
      { title: 'Mis Accesos 7d', value: accesosSemana, icon: Activity, color: 'text-indigo-700', bg: 'bg-indigo-100' }
    ];

    return (
      <div className="space-y-6">
        {/* Banner CTA */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 shadow-lg shadow-emerald-200 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Nuevo Visitante</h2>
            <p className="text-emerald-100 mb-6 max-w-sm">Genera un código de acceso para que tu invitado entre sin demoras en portería.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setView('crear')} className="bg-white text-emerald-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition hover:-translate-y-0.5">
                <KeyRound size={18} /> Registrar Visitante
              </button>
              <button onClick={() => setView('visitantes')} className="bg-white/10 text-white border border-white/30 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white/20 transition">
                <Users size={18} /> Ver Mis Visitantes
              </button>
            </div>
          </div>
          <Shield size={180} className="absolute -right-8 -bottom-10 text-emerald-500/20 rotate-12" />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${c.bg} ${c.color}`}>
                  <c.icon size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.title}</p>
                  <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mi vehículo / parqueadero */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Car size={20} className="text-emerald-600" /> Mi Vehículo
            </h3>
            {tieneVehiculo && placaPrincipal ? (
              <>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-3">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Placa Principal</p>
                  <p className="text-2xl font-bold text-slate-800 font-mono tracking-wider">{placaPrincipal}</p>
                </div>
                {placaSecundaria && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Placa Adicional</p>
                    <p className="text-xl font-bold text-slate-700 font-mono">{placaSecundaria}</p>
                  </div>
                )}
                {parqueaderoInfo && (
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 mt-3 flex items-center gap-3">
                    <MapPin size={20} className="text-emerald-600" />
                    <div>
                      <p className="text-xs text-emerald-700 font-semibold">Parqueadero asignado</p>
                      <p className="text-lg font-bold text-emerald-800">{parqueaderoInfo.numero}</p>
                    </div>
                  </div>
                )}
                <button onClick={() => setView('vehiculo')} className="w-full mt-3 text-sm text-emerald-700 font-semibold py-2 rounded-lg hover:bg-emerald-50 transition">
                  Editar información
                </button>
              </>
            ) : (
              <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
                <Car size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">No tienes vehículo registrado</p>
                <button onClick={() => setView('vehiculo')} className="text-sm text-emerald-700 font-semibold hover:underline">
                  Registrar vehículo
                </button>
              </div>
            )}
          </div>

          {/* Mis accesos recientes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-indigo-600" /> Mis Accesos Recientes
              {placaPrincipal && (
                <span className="text-xs font-normal text-slate-500 ml-1">· {placaPrincipal}</span>
              )}
            </h3>
            {!placaPrincipal ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
                <Activity size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Registra tu vehículo para ver tus accesos</p>
              </div>
            ) : misAccesos.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
                <Activity size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Sin registros de acceso aún</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {misAccesos.slice(0, 10).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${a.tipoAcceso === 'entrada' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      <ArrowRightCircle size={16} className={a.tipoAcceso === 'salida' ? 'rotate-180' : ''} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 capitalize">{a.tipoAcceso}</p>
                      <p className="text-xs text-slate-500">{a.placa} {a.plaza ? `· Plaza ${a.plaza}` : ''}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono shrink-0">
                      {new Date(a.fechaHora).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderVisitantes = () => {
    const badge = (estado) => ({
      pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
      ingresado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      salido: 'bg-slate-200 text-slate-600 border-slate-300'
    })[estado] || 'bg-slate-100 text-slate-600 border-slate-200';

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Mis Visitantes / Autorizaciones</h2>
            <p className="text-sm text-slate-500 mt-1">{visitantes.length} registrados en total</p>
          </div>
          <button onClick={() => setView('crear')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700 transition">
            <Plus size={16} /> Nuevo Visitante
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-center py-8">Cargando...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm">
                  <th className="p-3 font-semibold">Nombre</th>
                  <th className="p-3 font-semibold">Cédula</th>
                  <th className="p-3 font-semibold">Placa</th>
                  <th className="p-3 font-semibold">Motivo</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visitantes.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-slate-500">No tienes visitantes registrados aún.</td></tr>
                ) : visitantes.map((v, i) => (
                  <tr key={v._id || i} className="border-b border-slate-100 hover:bg-emerald-50/40 transition">
                    <td className="p-3 font-medium text-slate-800">{v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}</td>
                    <td className="p-3 text-slate-600">{v.cedulaVisitante || v.cedula}</td>
                    <td className="p-3 font-mono text-slate-700 bg-slate-50 rounded px-2">{v.placaVisitante || v.placaVehiculo || '-'}</td>
                    <td className="p-3 text-slate-600 text-sm">{v.motivoVisita || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge(v.estado)}`}>
                        {v.estado || 'pendiente'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleVerCodigo(v)}
                        className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition"
                      >
                        <KeyRound size={14}/> Ver Código
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

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
        <div className="p-6 border-b border-slate-100">
          <Logo theme="light" subtitle="Panel Residente" />
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

        {/* Perfil del usuario al fondo del sidebar */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
              {user?.nombre?.charAt(0) || 'R'}
            </div>
            <div className="flex-1 min-w-0 hidden lg:block">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.nombre || 'Residente'}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.rol || 'residente'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-20 lg:ml-64 p-4 lg:p-8">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 min-w-0">
            <img src={`https://ui-avatars.com/api/?name=${user?.nombre || 'User'}&background=10b981&color=fff`} alt="Profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">
                Hola, {perfil?.nombre || user?.nombre || "Residente"} {perfil?.apellido || user?.apellido || ''}
              </h1>
              <p className="text-sm text-slate-500 truncate">
                {perfil?.conjunto?.nombre ? `${perfil.conjunto.nombre} · ` : ''}
                Torre {perfil?.torre || user?.torre || '-'} · Apto {perfil?.apartamento || user?.apartamento || '-'}
              </p>
            </div>
          </div>
          {perfil?.estadoExpensa && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              perfil.estadoExpensa === 'al dia'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              Expensa: {perfil.estadoExpensa}
            </span>
          )}
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
