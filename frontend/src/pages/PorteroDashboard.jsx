import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, QrCode, MonitorPlay, Camera, Car, AlertTriangle, ArrowRightCircle, Users } from 'lucide-react';
import api from '../services/api';

export default function PorteroDashboard({ user }) {
  const [stats, setStats] = useState({ plazasLibres: 0, visitantesHoy: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [visitantes, setVisitantes] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
       try {
         setLoading(true);
         const parkResp = await api.get('/parqueaderos');
         const parkData = Array.isArray(parkResp.data) ? parkResp.data : [];
         setParqueaderos(parkData);
         
         const libres = parkData.filter(p => p.estado === 'DISPONIBLE').length || 0;
         setStats({ plazasLibres: libres, visitantesHoy: '...' });

         if (view === 'visitantes') {
            const visResp = await api.get('/visitantes');
            setVisitantes(Array.isArray(visResp.data) ? visResp.data : []);
         }

         if (view === 'dashboard' || view === 'auditoria') {
            const histResp = await api.get('/parqueaderos/historial');
            setHistorial(Array.isArray(histResp.data) ? histResp.data : []);
         }

       } catch (error) {
         console.error("Error al obtener datos en portería", error);
       } finally {
         setLoading(false);
       }
    };
    fetchData();
  }, [view]);

  const renderDashboard = () => (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { title: 'Ingresos Hoy', value: stats.visitantesHoy, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
          { title: 'Plazas Libres', value: loading ? '...' : stats.plazasLibres, icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { title: 'Placas Leídas', value: historial.filter(h=>h.metodo==='LPR_CAMERA').length || 0, icon: MonitorPlay, Camera, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { title: 'Alertas', value: '0', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.title}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
           <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">Control de Tránsito</h2>
           <div className="h-64 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
              <Camera size={40} className="text-slate-300 mb-2"/>
              <p className="text-slate-400 font-medium">Cámaras LPR en Vivo conectadas</p>
           </div>
         </div>

         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
           <h2 className="text-lg font-bold text-slate-900 mb-6">Últimos Accesos</h2>
           <div className="space-y-4 relative">
              {historial.slice(0, 5).map((item, i) => (
                <div key={i} className="flex gap-4 items-start relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 ${item.tipo === 'ENTRADA' ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                    <ArrowRightCircle size={18} className={item.tipo === 'SALIDA' && "rotate-180"} />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl w-full border border-slate-100">
                    <p className="text-sm font-bold text-slate-800">{item.tipo} - {item.metodo}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(item.fechaHora).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {historial.length === 0 && <p className="text-sm text-slate-500">No hay registros hoy</p>}
           </div>
         </div>
      </div>
    </>
  );

  const renderVisitantes = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Listado de Visitantes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="p-3">Nombre</th>
              <th className="p-3">Cédula</th>
              <th className="p-3">Placa</th>
              <th className="p-3">Parqueadero</th>
            </tr>
          </thead>
          <tbody>
            {visitantes.map((v, i) => (
               <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                 <td className="p-3">{v.nombre} {v.apellido}</td>
                 <td className="p-3">{v.cedula}</td>
                 <td className="p-3 font-mono">{v.placaVehiculo || 'N/A'}</td>
                 <td className="p-3">{v.parqueadero?.numero || '-'}</td>
               </tr>
            ))}
            {visitantes.length === 0 && (
               <tr><td colSpan="4" className="text-center p-4 text-slate-500">No hay visitantes activos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderParqueaderos = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Estado de Parqueaderos</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {parqueaderos.map((p, i) => (
           <div key={i} className={`p-4 rounded-xl border ${p.estado==='DISPONIBLE' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <h3 className="font-bold">{p.numero}</h3>
              <p className={`text-xs font-semibold ${p.estado==='DISPONIBLE' ? 'text-emerald-600' : 'text-red-600'}`}>{p.estado}</p>
              {p.placa && <p className="text-sm mt-2 font-mono bg-white inline-block px-2 rounded border border-slate-300">{p.placa}</p>}
           </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex w-full">
      <aside className="w-20 lg:w-64 bg-[#0F172A] flex-col fixed h-full z-10 shadow-2xl transition-all overflow-hidden hidden md:flex">
        <div className="p-6 border-b border-white/10 flex items-center justify-center lg:justify-start gap-3">
          <div className="w-10 h-10 min-w-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
            S
          </div>
          <div className="hidden lg:block whitespace-nowrap">
            <span className="font-bold text-white block tracking-wide">Portería</span>
            <span className="text-xs text-slate-400 font-medium">Control de Acceso</span>
          </div>
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
