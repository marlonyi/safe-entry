import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, MonitorPlay, Camera, Car, AlertTriangle, ArrowRightCircle, Users, Clock, QrCode } from 'lucide-react';
import api from '../services/api';
import Logo from '../components/Logo';

export default function PorteroDashboard({ user }) {
  const [stats, setStats] = useState({
    plazasLibres: 0, plazasTotal: 0,
    entradasHoy: 0, salidasHoy: 0,
    visitantesDentro: 0, visitantesPendientes: 0,
    placasLeidas: 0, alertas: 0
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [visitantes, setVisitantes] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [tipoTab, setTipoTab] = useState('residentes');

  // Desempaqueta respuestas considerando que el interceptor de api.js
  // ya convierte { success, data, message } en data directamente.
  const unwrap = (resp) => {
    const d = resp?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;       // post-interceptor (paginado)
    if (Array.isArray(d?.data)) return d.data;         // raro: doble wrap
    if (Array.isArray(d?.data?.items)) return d.data.items;
    return [];
  };

  const recargar = async () => {
    setView(v => v); // forzar refetch
    const visResp = await api.get('/visitantes').catch(() => ({ data: { data: [] } }));
    setVisitantes(unwrap(visResp));
    const histResp = await api.get('/parqueaderos/historial?limit=20&page=1').catch(() => ({ data: { data: { items: [] } } }));
    setHistorial(unwrap(histResp));
    const statsResp = await api.get('/parqueaderos/historial/estadisticas').catch(() => ({ data: {} }));
    const sh = statsResp.data || {};
    setStats(s => ({
      ...s,
      entradasHoy: sh.entradasHoy || 0,
      salidasHoy: sh.salidasHoy || 0,
      visitantesDentro: unwrap(visResp).filter(v => v.estado === 'ingresado').length,
      visitantesPendientes: unwrap(visResp).filter(v => v.estado === 'pendiente').length
    }));
  };

  const handleRegistrarIngreso = async (visitante) => {
    if (!window.confirm(`Registrar ingreso de ${visitante.nombre} ${visitante.apellido}?`)) return;
    try {
      await api.post(`/visitantes/${visitante._id || visitante.id}/registrar-ingreso`);
      await recargar();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleRegistrarSalida = async (visitante) => {
    if (!window.confirm(`Registrar salida de ${visitante.nombre} ${visitante.apellido}?`)) return;
    try {
      await api.post(`/visitantes/${visitante._id || visitante.id}/registrar-salida`);
      await recargar();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Parqueaderos (siempre)
        const parkResp = await api.get('/parqueaderos').catch(() => ({ data: { data: [] } }));
        const parkArr = unwrap(parkResp);
        setParqueaderos(parkArr);
        const libres = parkArr.filter(p => p.estado === 'DISPONIBLE').length;

        // Visitantes
        const visResp = await api.get('/visitantes').catch(() => ({ data: { data: [] } }));
        const visArr = unwrap(visResp);
        setVisitantes(visArr);
        const pendientes = visArr.filter(v => v.estado === 'pendiente').length;
        const dentro = visArr.filter(v => v.estado === 'ingresado').length;

        // Historial reciente
        const histResp = await api.get('/parqueaderos/historial?limit=20&page=1').catch(() => ({ data: { data: { items: [] } } }));
        const histArr = unwrap(histResp);
        setHistorial(histArr);

        // Stats de historial (usa endpoint nuevo). El interceptor ya desempaqueta a statsResp.data
        const statsResp = await api.get('/parqueaderos/historial/estadisticas').catch(() => ({ data: {} }));
        const statsHist = statsResp.data || {};

        // Detectar alertas: visitantes con horaEntrada que exceden tiempoMaximoHoras
        const ahora = Date.now();
        const alertas = parkArr.filter(p =>
          p.estado === 'OCUPADO' &&
          p.categoria === 'VISITANTE' &&
          p.horaEntrada &&
          p.tiempoMaximoHoras &&
          (ahora - new Date(p.horaEntrada).getTime()) / 3600000 > p.tiempoMaximoHoras
        ).length;

        setStats({
          plazasLibres: libres,
          plazasTotal: parkArr.length,
          entradasHoy: statsHist.entradasHoy || 0,
          salidasHoy: statsHist.salidasHoy || 0,
          visitantesDentro: dentro,
          visitantesPendientes: pendientes,
          placasLeidas: histArr.filter(h => h.metodo === 'LPR_CAMERA').length || 0,
          alertas
        });
      } catch (error) {
        console.error('Error al obtener datos en porteria', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view]);

  const cardClass = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition";

  const renderDashboard = () => {
    const cards = [
      { title: 'Entradas Hoy', value: stats.entradasHoy, icon: ArrowRightCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
      { title: 'Salidas Hoy', value: stats.salidasHoy, icon: ArrowRightCircle, color: 'text-rose-600', bg: 'bg-rose-100', rotate: true },
      { title: 'Visitantes Dentro', value: stats.visitantesDentro, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
      { title: 'Pendientes', value: stats.visitantesPendientes, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
      { title: 'Plazas Libres', value: loading ? '...' : `${stats.plazasLibres}/${stats.plazasTotal}`, icon: Car, color: 'text-teal-600', bg: 'bg-teal-100' },
      { title: 'Alertas', value: stats.alertas, icon: AlertTriangle, color: stats.alertas > 0 ? 'text-red-600' : 'text-orange-600', bg: stats.alertas > 0 ? 'bg-red-100' : 'bg-orange-100' }
    ];

    const visitantesPend = visitantes.filter(v => v.estado === 'pendiente').slice(0, 5);

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          {cards.map((stat, i) => (
            <div key={i} className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={20} className={stat.rotate ? 'rotate-180' : ''} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{stat.title}</p>
                  <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visitantes pendientes para validar */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock size={20} className="text-amber-600" />
                Visitantes pendientes de ingreso
              </h2>
              <span className="text-xs text-slate-500">{stats.visitantesPendientes} en total</span>
            </div>
            {visitantesPend.length === 0 ? (
              <div className="h-48 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                <UserCheck size={36} className="text-slate-300 mb-2" />
                <p className="text-slate-400 font-medium">No hay visitantes pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visitantesPend.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-bold shrink-0">
                        {(v.nombre || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{v.nombre} {v.apellido}</p>
                        <p className="text-xs text-slate-500">
                          Apto {v.apartamentoDestino || '-'} {v.torreDestino ? `· Torre ${v.torreDestino}` : ''}
                          {v.motivoVisita ? ` · ${v.motivoVisita}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200">{v.placaVehiculo || 'sin placa'}</span>
                      <button
                        onClick={() => handleRegistrarIngreso(v)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition"
                        title="Registrar entrada"
                      >
                        <ArrowRightCircle size={14} /> Entrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimos accesos */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ArrowRightCircle size={20} className="text-blue-600" />
              Últimos accesos
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {historial.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No hay registros</p>
              ) : historial.slice(0, 8).map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${item.tipoAcceso === 'entrada' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    <ArrowRightCircle size={16} className={item.tipoAcceso === 'salida' ? 'rotate-180' : ''} />
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl w-full border border-slate-100 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-bold text-slate-800 capitalize truncate">{item.tipoAcceso} · {item.tipoUsuario}</p>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{new Date(item.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-slate-700 truncate">{item.nombreUsuario || '-'}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{item.placa || '-'} {item.plaza ? `· ${item.plaza}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderVisitantes = () => {
    const badge = (estado) => ({
      pendiente: 'bg-amber-100 text-amber-700',
      ingresado: 'bg-emerald-100 text-emerald-700',
      salido: 'bg-slate-200 text-slate-600'
    })[estado] || 'bg-slate-100 text-slate-600';

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck size={24} className="text-blue-600" /> Listado de Visitantes
          </h2>
          <span className="text-sm text-slate-500">{visitantes.length} registrados</span>
        </div>
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm">
                <th className="p-3 font-semibold">Nombre</th>
                <th className="p-3 font-semibold">Cédula</th>
                <th className="p-3 font-semibold">Placa</th>
                <th className="p-3 font-semibold">Destino</th>
                <th className="p-3 font-semibold">Estado</th>
                <th className="p-3 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {visitantes.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-8 text-slate-500">No hay visitantes</td></tr>
              ) : visitantes.map((v, i) => (
                <tr key={v._id || i} className="border-b border-slate-100 hover:bg-blue-50/50 transition">
                  <td className="p-3 font-medium text-slate-800">{v.nombre} {v.apellido}</td>
                  <td className="p-3 text-slate-600">{v.cedula}</td>
                  <td className="p-3 font-mono text-slate-700 bg-slate-50 rounded px-2">{v.placaVehiculo || 'N/A'}</td>
                  <td className="p-3 text-slate-600 text-sm">
                    {v.torreDestino ? `T${v.torreDestino} ` : ''}{v.apartamentoDestino ? `· Apto ${v.apartamentoDestino}` : '-'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(v.estado)}`}>
                      {v.estado || 'desconocido'}
                    </span>
                  </td>
                  <td className="p-3">
                    {v.estado === 'pendiente' && (
                      <button
                        onClick={() => handleRegistrarIngreso(v)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <ArrowRightCircle size={14} /> Entrar
                      </button>
                    )}
                    {v.estado === 'ingresado' && (
                      <button
                        onClick={() => handleRegistrarSalida(v)}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <ArrowRightCircle size={14} className="rotate-180" /> Salir
                      </button>
                    )}
                    {v.estado === 'salido' && (
                      <span className="text-xs text-slate-400 italic">Visita finalizada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderParqueaderos = () => {
    const filtrados = parqueaderos.filter(p => tipoTab === 'residentes' ? p.categoria === 'PRIVADO' : p.categoria === 'VISITANTE');
    const carros = filtrados.filter(p => p.tipoVehiculo === 'CARRO');
    const motos = filtrados.filter(p => p.tipoVehiculo === 'MOTO');

    const renderGrid = (lista, color) => {
      if (lista.length === 0) return <p className="text-sm text-slate-400 italic">Sin parqueaderos</p>;
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {lista.sort((a, b) => (a.numero || '').localeCompare(b.numero || '')).map((p, i) => (
            <div key={i} className={`p-3 rounded-xl border-2 text-center transition hover:scale-105 ${
              p.estado === 'DISPONIBLE'
                ? `border-${color}-300 bg-gradient-to-br from-${color}-50 to-${color}-100`
                : 'border-red-300 bg-gradient-to-br from-red-50 to-rose-50'
            }`}>
              <p className="font-bold text-sm text-slate-800">{p.numero}</p>
              <p className={`text-xs font-medium ${p.estado === 'DISPONIBLE' ? `text-${color}-700` : 'text-red-600'}`}>
                {p.estado === 'DISPONIBLE' ? 'Libre' : 'Ocupado'}
              </p>
              {p.placaVehiculo && p.estado === 'OCUPADO' && (
                <p className="text-[10px] mt-1 font-mono bg-white/70 rounded px-1 truncate">{p.placaVehiculo}</p>
              )}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Car size={24} className="text-emerald-600" /> Estado de Parqueaderos
          </h2>
          <span className="text-sm text-slate-500">{parqueaderos.filter(p => p.estado === 'DISPONIBLE').length}/{parqueaderos.length} libres</span>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTipoTab('residentes')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
              tipoTab === 'residentes'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >Residentes</button>
          <button
            onClick={() => setTipoTab('visitantes')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
              tipoTab === 'visitantes'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >Visitantes</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-600 mb-3 flex items-center gap-2">
              <Car size={18} /> Carros <span className="text-xs text-slate-400 font-normal">({carros.length})</span>
            </h3>
            {renderGrid(carros, tipoTab === 'residentes' ? 'blue' : 'emerald')}
          </div>
          <div>
            <h3 className="font-semibold text-slate-600 mb-3 flex items-center gap-2">
              <Car size={18} /> Motos <span className="text-xs text-slate-400 font-normal">({motos.length})</span>
            </h3>
            {renderGrid(motos, tipoTab === 'residentes' ? 'purple' : 'orange')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex w-full">
      <aside className="w-20 lg:w-64 bg-[#0F172A] flex-col fixed h-full z-10 shadow-2xl transition-all overflow-hidden hidden md:flex">
        <div className="p-6 border-b border-white/10">
          <Logo theme="dark" subtitle="Portería · Control de Acceso" />
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2">
          <button onClick={() => setView('dashboard')} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === 'dashboard' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <MonitorPlay size={22} /><span className="hidden lg:block">Panel Principal</span>
          </button>
          <button onClick={() => setView('visitantes')} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === 'visitantes' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <UserCheck size={22} /><span className="hidden lg:block">Visitantes</span>
          </button>
          <button onClick={() => setView('parqueaderos')} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === 'parqueaderos' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <Car size={22} /><span className="hidden lg:block">Parqueaderos</span>
          </button>
        </nav>

        {/* Perfil del usuario al fondo del sidebar */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
              {user?.nombre?.charAt(0) || 'P'}
            </div>
            <div className="flex-1 min-w-0 hidden lg:block">
              <p className="text-sm font-semibold text-white truncate">{user?.nombre || 'Portero'}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.rol || 'porteria'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-20 lg:ml-64 p-4 lg:p-8">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bienvenido, {user?.nombre || "Portero"}!</h1>
            <p className="text-sm text-slate-500 font-medium">Turno Actual • SafeEntry System</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl flex items-center gap-2 border border-emerald-100 shadow-sm">
              <ShieldCheck size={18} />
              <span className="font-bold text-sm">Sistema Activo</span>
            </div>
          </div>
        </header>

        {view === 'dashboard' && renderDashboard()}
        {view === 'visitantes' && renderVisitantes()}
        {view === 'parqueaderos' && renderParqueaderos()}
      </main>
    </div>
  );
}
