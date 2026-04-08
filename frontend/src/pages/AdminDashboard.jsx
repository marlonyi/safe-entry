import React, { useState, useEffect } from 'react';
import { Users, Car, UserCheck, ShieldCheck, Activity, Search, Edit2, Trash2, Plus, Building, UserPlus, MonitorPlay, Home, Video, QrCode, X, Eye } from 'lucide-react';
import api from '../services/api';

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState({ usuariosTotal: 0, plazasLibres: 0, visitantesHoy: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');

  const [usuarios, setUsuarios] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [visitantes, setVisitantes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [conjuntos, setConjuntos] = useState([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [showConjuntoModal, setShowConjuntoModal] = useState(false);
  const [conjuntoData, setConjuntoData] = useState({ estado: 'activo' });
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  // QR Modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const usersResp = await api.get('/usuarios');
        const usrData = Array.isArray(usersResp.data?.data) ? usersResp.data.data : (Array.isArray(usersResp.data) ? usersResp.data : []);
        setUsuarios(usrData);

        const parkResp = await api.get('/parqueaderos');
        const parkData = Array.isArray(parkResp.data?.data) ? parkResp.data.data : (Array.isArray(parkResp.data) ? parkResp.data : []);
        setParqueaderos(parkData);

        const libs = parkData.filter(p => p.estado === 'DISPONIBLE').length || 0;

        if (view === 'dashboard' || view === 'visitantes') {
          const visResp = await api.get('/visitantes').catch(() => ({data:[]}));
          const vistData = Array.isArray(visResp.data?.data) ? visResp.data.data : (Array.isArray(visResp.data) ? visResp.data : []);
          setVisitantes(vistData);
          setStats({ usuariosTotal: usrData.length, plazasLibres: libs, visitantesHoy: vistData.length });
        } else {
          setStats({ usuariosTotal: usrData.length, plazasLibres: libs, visitantesHoy: stats.visitantesHoy });
        }

        if (view === 'auditoria') {
          const histResp = await api.get('/parqueaderos/historial').catch(() => ({data:[]}));
          setHistorial(Array.isArray(histResp.data?.data) ? histResp.data.data : (Array.isArray(histResp.data) ? histResp.data : []));
        }

        if (view === 'conjuntos') {
          const conjResp = await api.get('/conjuntos').catch(() => ({data: { conjuntos: [] }}));
          setConjuntos(conjResp.data?.conjuntos || []);
        }

      } catch (error) {
        console.error("Error cargando dashboard de Admin", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view]);

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    try {
      if (formData.rol === 'ADMIN') formData.rol = 'admin';
      if (formData.rol === 'PORTERO') formData.rol = 'porteria';
      if (formData.rol === 'RESIDENTE') formData.rol = 'residente';

      if (editMode && editUserId) {
        await api.put(`/usuarios/${editUserId}`, formData);
        alert('Usuario actualizado correctamente');
      } else {
        await api.post('/usuarios/crear', formData);
        alert('Usuario creado correctamente');
      }
      setShowModal(false);
      setEditMode(false);
      setEditUserId(null);
      setFormData({});
      const res = await api.get('/usuarios');
      setUsuarios(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
    } catch (error) {
      alert("Error al guardar usuario. Verifica los datos: " + (error.response?.data?.details?.[0]?.msg || error.response?.data?.error || error.message));
    }
  };

  const handleEditarUsuario = (usuario) => {
    setEditMode(true);
    setEditUserId(usuario._id || usuario.id);
    setFormData({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      cedula: usuario.cedula || '',
      rol: usuario.rol?.toUpperCase() || 'RESIDENTE',
      torre: usuario.torre || '',
      apartamento: usuario.apartamento || '',
      telefono: usuario.telefono || '',
      email: usuario.email || ''
    });
    setShowModal(true);
  };

  const handleEliminarUsuario = async (usuario) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario ${usuario.nombre} ${usuario.apellido}?`)) return;
    try {
      await api.delete(`/usuarios/${usuario._id || usuario.id}`);
      alert('Usuario eliminado correctamente');
      const res = await api.get('/usuarios');
      setUsuarios(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
    } catch (error) {
      alert('Error al eliminar usuario: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleVerQR = async (visitante) => {
    setSelectedVisitante(visitante);
    setShowQRModal(true);
    setQrLoading(true);
    setQrData(null);
    try {
      const res = await api.post(`/visitantes/qr/generar/${visitante._id || visitante.id}`, { horasValidez: 24 });
      setQrData(res.data?.qr || res.data);
    } catch (error) {
      alert('Error al generar QR: ' + (error.response?.data?.error || error.message));
    } finally {
      setQrLoading(false);
    }
  };

  const handleCrearConjunto = async (e) => {
    e.preventDefault();
    try {
      await api.post('/conjuntos', conjuntoData);
      alert('Conjunto creado correctamente');
      setShowConjuntoModal(false);
      const res = await api.get('/conjuntos');
      setConjuntos(res.data?.conjuntos || []);
    } catch (error) {
      alert("Error al crear conjunto. Puede que ya exista o falten datos.");
    }
  };

  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    ...(user?.rol === 'superadmin' ? [{ id: 'conjuntos', label: 'Gestión Conjuntos', icon: Building }] : []),
    { id: 'usuarios', label: 'Gestión Usuarios', icon: Users },
    { id: 'visitantes', label: 'Visitantes', icon: UserCheck },
    { id: 'parqueaderos', label: 'Parqueaderos', icon: Car },
    { id: 'auditoria', label: 'Auditoría / Accesos', icon: Activity },
    { id: 'simulador', label: 'Simulador Cámaras', icon: Video }
  ];

  const renderDashboard = () => (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { title: 'Usuarios', value: stats.usuariosTotal, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { title: 'Plazas Libres', value: stats.plazasLibres, icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { title: 'Visitantes', value: stats.visitantesHoy, icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { title: 'Accesos Hoy', value: historial.length || 0, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-100' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center">
             <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
             </div>
             <div>
               <p className="text-xs font-semibold text-slate-500 uppercase">{stat.title}</p>
               <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
             </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderConjuntos = () => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Gestión de Conjuntos (SuperAdmin)</h2>
        <button onClick={() => setShowConjuntoModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700">
           <Plus size={16} /> Nuevo Conjunto
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left bg-slate-50 md:bg-white rounded-xl overflow-hidden shadow-sm md:shadow-none">
          <thead className="hidden md:table-header-group">
            <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
              <th className="p-4 font-semibold">Nombre</th>
              <th className="p-4 font-semibold">NIT</th>
              <th className="p-4 font-semibold">Ciudad</th>
              <th className="p-4 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {conjuntos.map((c, i) => (
               <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                 <td className="p-4 font-bold text-slate-800">{c.nombre}</td>
                 <td className="p-4 text-slate-600 font-mono text-sm">{c.nit || 'S/N'}</td>
                 <td className="p-4 text-slate-600">{c.ciudad || '-'}</td>
                 <td className="p-4">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {c.estado ? c.estado.toUpperCase() : 'ACTIVO'}
                     </span>
                 </td>
               </tr>
            ))}
            {conjuntos.length === 0 && <tr><td colSpan="4" className="text-center p-4">No hay conjuntos registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsuarios = () => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Residentes y Personal</h2>
        <button onClick={async () => {
             // Cargar conjuntos dinámicamente antes de abrir modal
             const conjResp = await api.get('/conjuntos').catch(() => ({data:{conjuntos: []}}));
             setConjuntos(conjResp.data?.conjuntos || []);
             setEditMode(false);
             setEditUserId(null);
             setFormData({});
             setShowModal(true);
        }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
           <UserPlus size={16} /> Agregar Usuario
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left bg-slate-50 md:bg-white rounded-xl overflow-hidden">
          <thead className="hidden md:table-header-group">
            <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
              <th className="p-4 font-semibold">Nombre</th>
              <th className="p-4 font-semibold">Documento</th>
              <th className="p-4 font-semibold">Rol</th>
              <th className="p-4 font-semibold">Ubicación</th>
              <th className="p-4 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios||[]).map((u, i) => (
               <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                 <td className="p-4 font-medium">{u.nombre} {u.apellido}</td>
                 <td className="p-4">{u.cedula}</td>
                 <td className="p-4">
                   <span className={`px-2 py-1 rounded text-xs font-bold ${u.rol === 'admin' || u.rol === 'ADMIN' ? 'bg-purple-100 text-purple-700' : u.rol === 'porteria' || u.rol === 'PORTERO' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.rol}
                   </span>
                 </td>
                 <td className="p-4 text-slate-500">T{u.torre || '-'} / Apto {u.apartamento || '-'}</td>
                 <td className="p-4">
                   <div className="flex gap-2">
                     <button onClick={() => handleEditarUsuario(u)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors" title="Editar">
                       <Edit2 size={16} />
                     </button>
                     {(user?.rol === 'superadmin' || user?.rol === 'admin') && u.rol !== 'superadmin' && (
                       <button onClick={() => handleEliminarUsuario(u)} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 transition-colors" title="Eliminar">
                         <Trash2 size={16} />
                       </button>
                     )}
                   </div>
                 </td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderVisitantes = () => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <h2 className="text-xl font-bold mb-6">Control de Visitantes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left bg-slate-50 md:bg-white rounded-xl overflow-hidden">
          <thead className="hidden md:table-header-group">
            <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
              <th className="p-4 font-semibold">Visitante</th>
              <th className="p-4 font-semibold">Cédula</th>
              <th className="p-4 font-semibold">Placa Vehículo</th>
              <th className="p-4 font-semibold">Autoriza (Residente)</th>
              <th className="p-4 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visitantes.map((v, i) => (
               <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                 <td className="p-4 font-medium">{v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}</td>
                 <td className="p-4">{v.cedulaVisitante || v.cedula}</td>
                 <td className="p-4 font-mono">{v.placaVisitante || v.placaVehiculo || 'N/A'}</td>
                 <td className="p-4 text-slate-500">{v.usuarioId?.nombre || v.residenteId?.nombre || '-'}</td>
                 <td className="p-4">
                   <button onClick={() => handleVerQR(v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors">
                     <QrCode size={14} /> Ver QR
                   </button>
                 </td>
               </tr>
            ))}
            {visitantes.length === 0 && <tr><td colSpan="5" className="text-center p-4">No hay visitantes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex w-full font-sans text-slate-800">
      <aside className="w-64 bg-[#0F172A] hidden md:flex flex-col fixed h-full z-10 shadow-xl overflow-y-auto">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl"><ShieldCheck size={24}/></div>
          <div><p className="font-bold text-white tracking-wide">Admin</p><p className="text-xs text-slate-400">SafeEntry System</p></div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menu.map(m => (
            <button key={m.id} onClick={() => setView(m.id)} className={`flex items-center gap-3 w-full p-3 rounded-xl font-medium transition-colors ${view === m.id ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <m.icon size={20} /><span>{m.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 p-4 lg:p-8">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div><h1 className="text-2xl font-bold text-slate-900 capitalize">Panel de {view}</h1></div>
          <div className="flex gap-4">
             <div className="bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-xl flex items-center gap-2">
                <ShieldCheck size={18} /> Administrador
             </div>
          </div>
        </header>

        {view === 'dashboard' && renderDashboard()}
        {view === 'conjuntos' && renderConjuntos()}
        {view === 'usuarios' && renderUsuarios()}
        {view === 'visitantes' && renderVisitantes()}
        
        {view === 'parqueaderos' && (
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <h2 className="text-xl font-bold mb-6">Parqueaderos y Estado</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
               {parqueaderos.map((p, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${p.estado==='DISPONIBLE' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                     <h3 className="font-bold">{p.numero}</h3>
                     <p className={`text-xs font-bold ${p.estado==='DISPONIBLE' ? 'text-emerald-600' : 'text-red-600'}`}>{p.estado}</p>
                     {p.placa && <p className="text-sm mt-2 font-mono bg-white inline-block px-2 rounded border border-slate-300">{p.placa}</p>}
                  </div>
               ))}
             </div>
           </div>
        )}
        
        {view === 'auditoria' && (
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <h2 className="text-xl font-bold mb-6">Historial y Auditoría</h2>
             <div className="overflow-x-auto">
               <table className="w-full text-left bg-slate-50 rounded-xl overflow-hidden">
                 <thead className="bg-slate-100 text-slate-500 text-sm">
                   <tr><th className="p-4">Fecha</th><th className="p-4">Tipo</th><th className="p-4">Placa / Detalle</th></tr>
                 </thead>
                 <tbody>
                   {historial.map((h, i) => (
                      <tr key={i} className="border-b border-slate-50"><td className="p-4">{new Date(h.fechaHora).toLocaleString()}</td><td className="p-4 font-bold">{h.tipo}</td><td className="p-4 font-mono">{h.placa || h.metodo || '-'}</td></tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {view === 'simulador' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-800 text-white text-center">
                <Video size={64} className="mx-auto text-slate-600 mb-4" />
                <h2 className="text-2xl font-bold mb-2">LPR (Cámara Placas)</h2>
                <p className="text-slate-400 mb-6">Inicia el modelo de IA YOLOv8 para entrada vehicular nativo.</p>
                <button 
                  onClick={async () => {
                    try {
                      await api.post('/scripts/lpr');
                      alert('Cámara LPR encendida! Revisa la ventana en tu escritorio.');
                    } catch (error) {
                      alert('Error al iniciar script LPR. Verifica la conexión.');
                    }
                  }}
                  className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-500/30 w-full">
                   Abrir Escáner de Placas
                </button>
             </div>
             
             <div className="bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-800 text-white text-center">
                <QrCode size={64} className="mx-auto text-slate-600 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Escáner Pases QR</h2>
                <p className="text-slate-400 mb-6">Inicia la cámara para validar códigos QR de visitantes.</p>
                <button 
                  onClick={async () => {
                    try {
                      await api.post('/scripts/qr');
                      alert('Cámara QR encendida! Revisa la ventana en tu escritorio.');
                    } catch (error) {
                      alert('Error al iniciar script QR. Verifica la conexión.');
                    }
                  }}
                  className="bg-emerald-600 px-6 py-3 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/30 w-full">
                   Abrir Escáner QR
                </button>
             </div>
           </div>
        )}

        {/* Modal Conjunto */}
        {showConjuntoModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
               <button onClick={() => setShowConjuntoModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">X</button>
               <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Building className="text-purple-600" /> Nuevo Conjunto (Tenant)</h2>
               <form onSubmit={handleCrearConjunto} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-slate-600">Nombre del Conjunto *</label>
                    <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setConjuntoData({...conjuntoData, nombre: e.target.value})} placeholder="Ej: Torres del Parque" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">NIT</label>
                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setConjuntoData({...conjuntoData, nit: e.target.value})} placeholder="900123456-1" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Estado</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" value={conjuntoData.estado} onChange={e => setConjuntoData({...conjuntoData, estado: e.target.value})}>
                        <option value="activo">Activo</option>
                        <option value="suspendido">Suspendido</option>
                        <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-slate-600">Dirección</label>
                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setConjuntoData({...conjuntoData, direccion: e.target.value})} placeholder="Calle 100 #15-25" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Ciudad</label>
                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setConjuntoData({...conjuntoData, ciudad: e.target.value})} placeholder="Bogotá" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Teléfono / Email</label>
                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setConjuntoData({...conjuntoData, telefono: e.target.value})} placeholder="Contacto" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-slate-600">Cantidad de Parqueaderos (Auto-generar)</label>
                    <input type="number" min="0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setConjuntoData({...conjuntoData, cantidadParqueaderos: parseInt(e.target.value) || 0})} placeholder="Ej: 50" />
                  </div>
                  <button type="submit" className="col-span-2 mt-4 bg-purple-600 text-white font-bold p-3 rounded-xl hover:bg-purple-700 transition-colors">
                     Guardar Conjunto
                  </button>
               </form>
            </div>
          </div>
        )}

        {/* Modal Usuario */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
               <button onClick={() => {setShowModal(false); setEditMode(false); setEditUserId(null);}} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
               <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <UserPlus className="text-blue-600" /> {editMode ? 'Editar Usuario' : 'Registrar Usuario'}
               </h2>
               <form onSubmit={handleCrearUsuario} className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Nombre</label>
                    <input required value={formData.nombre || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Apellido</label>
                    <input required value={formData.apellido || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, apellido: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Cédula</label>
                    <input required value={formData.cedula || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, cedula: e.target.value})} />
                  </div>
                  {!editMode && (
                    <div>
                      <label className="text-sm font-semibold text-slate-600">Contraseña</label>
                      <input required type="password" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, password: e.target.value})} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-600">Torre</label>
                      <input value={formData.torre || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, torre: e.target.value})} placeholder="Ej: 1" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-600">Apartamento</label>
                      <input value={formData.apartamento || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, apartamento: e.target.value})} placeholder="Ej: 101" />
                    </div>
                  </div>
                  {user?.rol === 'superadmin' && (
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Conjunto Residencial</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" value={formData.conjuntoId || ''} onChange={e => setFormData({...formData, conjuntoId: e.target.value})}>
                       <option value="">Selecciona el conjunto (Obligatorio)</option>
                       {conjuntos && conjuntos.map(c => (
                         <option key={c._id || c.id} value={c._id || c.id}>{c.nombre}</option>
                       ))}
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Rol</label>
                    <select required value={formData.rol || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl mt-1" onChange={e => setFormData({...formData, rol: e.target.value})}>
                       <option value="">Seleccione Rol</option>
                       <option value="admin">Administrador</option>
                       <option value="porteria">Portero</option>
                       <option value="residente">Residente</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold p-3 rounded-xl hover:bg-blue-700 transition">
                     {editMode ? 'Actualizar Usuario' : 'Guardar Usuario'}
                  </button>
               </form>
            </div>
          </div>
        )}

        {/* Modal QR Visitante */}
        {showQRModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
               <button onClick={() => {setShowQRModal(false); setQrData(null); setSelectedVisitante(null);}} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
               <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <QrCode className="text-emerald-600" /> Código QR de Visitante
               </h2>
               {selectedVisitante && (
                 <div className="mb-4">
                   <p className="text-slate-600"><span className="font-semibold">{selectedVisitante.nombreVisitante || selectedVisitante.nombre} {selectedVisitante.apellidoVisitante || selectedVisitante.apellido}</span></p>
                   <p className="text-sm text-slate-500">Cédula: {selectedVisitante.cedulaVisitante || selectedVisitante.cedula}</p>
                   {selectedVisitante.placaVisitante && <p className="text-sm text-slate-500">Placa: {selectedVisitante.placaVisitante}</p>}
                 </div>
               )}
               {qrLoading ? (
                 <div className="flex items-center justify-center py-8">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                   <span className="ml-3 text-slate-600">Generando código QR...</span>
                 </div>
               ) : qrData ? (
                 <div className="space-y-4">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                     <p className="text-xs text-slate-500 mb-2">Token de acceso:</p>
                     <code className="text-xs break-all text-slate-700 bg-slate-100 p-2 rounded block">{qrData.token}</code>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                     <p className="text-xs text-slate-500 mb-2">URL de verificación:</p>
                     <code className="text-xs break-all text-slate-700 bg-slate-100 p-2 rounded block">{qrData.url}</code>
                   </div>
                   {qrData.expiracion && (
                     <p className="text-sm text-amber-600">
                       Válido hasta: {new Date(qrData.expiracion).toLocaleString()}
                     </p>
                   )}
                   <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                     <p className="text-xs text-blue-700">
                       <strong>Instrucciones:</strong> Comparta el token o URL con el visitante. El visitante puede presentar este código en portería para su verificación.
                     </p>
                   </div>
                 </div>
               ) : (
                 <p className="text-slate-500 text-center py-4">No se pudo generar el código QR</p>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
