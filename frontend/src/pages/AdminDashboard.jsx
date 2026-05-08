import React, { useState, useEffect } from 'react';
import { Users, Car, UserCheck, ShieldCheck, Activity, Edit2, Trash2, Plus, Building, UserPlus, Video, QrCode, X, Clock, BarChart3 } from 'lucide-react';
import api from '../services/api';

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');

  const [usuarios, setUsuarios] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [visitantes, setVisitantes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [conjuntos, setConjuntos] = useState([]);

  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [torreSeleccionada, setTorreSeleccionada] = useState('privados');
  const [conjuntoSeleccionado, setConjuntoSeleccionado] = useState(null);
  const [usuariosConjuntoFilter, setUsuariosConjuntoFilter] = useState('todos');
  const [visitantesConjuntoFilter, setVisitantesConjuntoFilter] = useState('todos');
  const [parkData, setParkData] = useState(null);
  const [parkStats, setParkStats] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [showConjuntoModal, setShowConjuntoModal] = useState(false);
  const [conjuntoData, setConjuntoData] = useState({ estado: 'activo' });
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // ===== Auditoria =====
  const [audFiltros, setAudFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    tipoAcceso: '',
    tipoUsuario: '',
    placa: '',
    conjunto: ''
  });
  const [audPage, setAudPage] = useState(1);
  const [audLimit] = useState(50);
  const [audMeta, setAudMeta] = useState({ total: 0, totalPages: 0 });
  const [audStats, setAudStats] = useState(null);
  const [audLoading, setAudLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const usersResp = await api.get('/usuarios');
        const usrData = Array.isArray(usersResp.data?.data) ? usersResp.data.data : (Array.isArray(usersResp.data) ? usersResp.data : []);
        setUsuarios(usrData);

        const parkResp = await api.get('/parqueaderos');
        const parkDataResp = Array.isArray(parkResp.data?.data) ? parkResp.data.data : (Array.isArray(parkResp.data) ? parkResp.data : []);
        setParqueaderos(parkDataResp);

        try {
          const statsResp = await api.get('/parqueaderos/estadisticas');
          setParkStats(statsResp.data?.data || statsResp.data);
        } catch (e) {}

        try {
          const torreResp = await api.get('/parqueaderos/por-torre');
          setParkData(torreResp.data?.data || torreResp.data);
        } catch (e) {}

        if (view === 'dashboard' || view === 'visitantes') {
          const visResp = await api.get('/visitantes').catch(() => ({data:[]}));
          const vistData = Array.isArray(visResp.data?.data) ? visResp.data.data : (Array.isArray(visResp.data) ? visResp.data : []);
          setVisitantes(vistData);
        }

        // La auditoria se maneja en un useEffect dedicado mas abajo

        if (view === 'auditoria' || view === 'conjuntos' || view === 'usuarios' || view === 'visitantes') {
          const conjResp = await api.get('/conjuntos').catch(() => ({data: { conjuntos: [] }}));
          setConjuntos(conjResp.data?.conjuntos || conjResp.data?.data?.conjuntos || []);
        }

      } catch (error) {
        console.error("Error cargando dashboard de Admin", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view]);

  // ===== Carga de auditoria con filtros y paginacion =====
  useEffect(() => {
    if (view !== 'auditoria') return;
    const cargarAuditoria = async () => {
      try {
        setAudLoading(true);
        const params = new URLSearchParams();
        Object.entries(audFiltros).forEach(([k, v]) => { if (v) params.append(k, v); });
        params.append('page', audPage);
        params.append('limit', audLimit);

        const statsParams = new URLSearchParams();
        ['fechaInicio', 'fechaFin', 'conjunto'].forEach(k => {
          if (audFiltros[k]) statsParams.append(k, audFiltros[k]);
        });

        const [histResp, statsResp] = await Promise.all([
          api.get(`/parqueaderos/historial?${params.toString()}`).catch(() => ({ data: { data: { items: [], total: 0, totalPages: 0 } } })),
          api.get(`/parqueaderos/historial/estadisticas?${statsParams.toString()}`).catch(() => ({ data: { data: null } }))
        ]);

        const payload = histResp.data?.data || histResp.data || {};
        setHistorial(Array.isArray(payload.items) ? payload.items : []);
        setAudMeta({ total: payload.total || 0, totalPages: payload.totalPages || 0 });
        setAudStats(statsResp.data?.data || statsResp.data || null);
      } catch (e) {
        console.error('Error cargando auditoria', e);
      } finally {
        setAudLoading(false);
      }
    };
    cargarAuditoria();
  }, [view, audFiltros, audPage, audLimit]);

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
      alert("Error al guardar usuario: " + (error.response?.data?.details?.[0]?.msg || error.response?.data?.error || error.message));
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
      alert("Error al crear conjunto.");
    }
  };

  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    ...(user?.rol === 'superadmin' ? [{ id: 'conjuntos', label: 'Gestión Conjuntos', icon: Building }] : []),
    { id: 'usuarios', label: 'Gestión Usuarios', icon: Users },
    { id: 'visitantes', label: 'Visitantes', icon: UserCheck },
    { id: 'parqueaderos', label: 'Parqueaderos', icon: Car },
    { id: 'auditoria', label: 'Auditoría / Accesos', icon: Activity },
    { id: 'simulador', label: 'Simulador Cámaras', icon: Video }
  ];

  const POWERBI_EMBED_URL = import.meta.env.VITE_POWERBI_EMBED_URL || '';

  const renderDashboard = () => (
    <div className="relative">
      {/* Power BI Dashboard */}
      {POWERBI_EMBED_URL ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-40 animate-pulse" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                  <BarChart3 size={28} className="text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
                  Dashboard Analítico
                </h1>
                <p className="text-slate-500 text-sm">Visualizaciones en tiempo real • Power BI</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-sm">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <span className="text-sm font-semibold text-emerald-700">En vivo</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
                <Clock size={14} className="text-slate-500" />
                <span className="text-sm text-slate-600">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Power BI Container with Premium Design */}
          <div className="relative group">
            {/* Animated Gradient Border */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-40 group-hover:opacity-60 blur-sm transition-all duration-700" />

            {/* Inner Container */}
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Top Bar - macOS Style */}
              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer shadow-lg shadow-red-500/30" />
                    <div className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer shadow-lg shadow-amber-500/30" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-pointer shadow-lg shadow-emerald-500/30" />
                  </div>
                  <div className="h-4 w-px bg-slate-700" />
                  <span className="text-xs text-slate-400 font-medium">Power BI Report</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-lg bg-slate-700/50 text-xs text-slate-300 font-mono">
                    admin_residencial
                  </div>
                </div>
              </div>

              {/* Gradient Accent Line */}
              <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-pink-500" />

              {/* iframe */}
              <iframe
                title="Dashboard Power BI - Admin Residencial"
                width="100%"
                height="700px"
                src={POWERBI_EMBED_URL}
                frameBorder="0"
                allowFullScreen={true}
                style={{ border: 'none', display: 'block' }}
              />
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-500" />
                <span>Usuarios activos</span>
              </div>
              <div className="flex items-center gap-2">
                <Car size={16} className="text-emerald-500" />
                <span>Parqueaderos monitoreados</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-purple-500" />
                <span>Accesos registrados</span>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Actualizado automáticamente
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <BarChart3 size={32} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-amber-800 mb-2">Configuración Requerida</h3>
            <p className="text-amber-700 text-sm mb-4">
              Agrega la URL de Power BI en <code className="bg-amber-100 px-2 py-1 rounded">frontend/.env</code>
            </p>
            <code className="block text-xs bg-white p-3 rounded-lg border border-amber-200 text-slate-600">
              VITE_POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...
            </code>
          </div>
        </div>
      )}
    </div>
  );

  const renderConjuntos = () => (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-100">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100">
              <Building className="text-purple-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Gestión de Conjuntos</h2>
          </div>
          <button onClick={() => setShowConjuntoModal(true)} className="group relative px-5 py-2.5 rounded-xl font-semibold text-white overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-300 group-hover:scale-110" />
            <span className="relative flex items-center gap-2"><Plus size={18} /> Nuevo Conjunto</span>
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-600 text-sm">
                <th className="p-4 font-semibold rounded-tl-lg">Nombre</th>
                <th className="p-4 font-semibold">NIT</th>
                <th className="p-4 font-semibold">Ciudad</th>
                <th className="p-4 font-semibold rounded-tr-lg">Estado</th>
              </tr>
            </thead>
            <tbody>
              {conjuntos.map((c, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-purple-50 hover:to-transparent transition-all duration-200">
                  <td className="p-4 font-bold text-slate-800">{c.nombre}</td>
                  <td className="p-4 text-slate-600 font-mono text-sm">{c.nit || 'S/N'}</td>
                  <td className="p-4 text-slate-600">{c.ciudad || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${c.estado === 'activo' ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-200' : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200'}`}>
                      {c.estado ? c.estado.toUpperCase() : 'ACTIVO'}
                    </span>
                  </td>
                </tr>
              ))}
              {conjuntos.length === 0 && <tr><td colSpan="4" className="text-center p-8 text-slate-400">No hay conjuntos registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderUsuarios = () => {
    const usuariosFiltrados = (usuarios || []).filter(u => {
      if (usuariosConjuntoFilter === 'todos') return true;
      if (usuariosConjuntoFilter === 'sin-conjunto') return !u.conjunto;
      const cId = typeof u.conjunto === 'object' ? u.conjunto?._id : u.conjunto;
      return cId === usuariosConjuntoFilter;
    });

    const contarPorConjunto = (cId) => {
      if (cId === 'todos') return (usuarios || []).length;
      if (cId === 'sin-conjunto') return (usuarios || []).filter(u => !u.conjunto).length;
      return (usuarios || []).filter(u => {
        const id = typeof u.conjunto === 'object' ? u.conjunto?._id : u.conjunto;
        return id === cId;
      }).length;
    };

    const haySinConjunto = (usuarios || []).some(u => !u.conjunto);

    return (
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-100">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100">
                <Users className="text-blue-600" size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Residentes y Personal</h2>
            </div>
            <button onClick={async () => {
              const conjResp = await api.get('/conjuntos').catch(() => ({data:{conjuntos: []}}));
              setConjuntos(conjResp.data?.conjuntos || conjResp.data?.data?.conjuntos || []);
              setEditMode(false);
              setEditUserId(null);
              setFormData({});
              setShowModal(true);
            }} className="group relative px-5 py-2.5 rounded-xl font-semibold text-white overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300 group-hover:scale-110" />
              <span className="relative flex items-center gap-2"><UserPlus size={18} /> Agregar Usuario</span>
            </button>
          </div>

          {/* Tabs de conjunto */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Filtrar por conjunto</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setUsuariosConjuntoFilter('todos')}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                  usuariosConjuntoFilter === 'todos'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg scale-105'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  usuariosConjuntoFilter === 'todos' ? 'bg-white/20' : 'bg-slate-200'
                }`}>
                  {contarPorConjunto('todos')}
                </span>
              </button>
              {conjuntos.map(c => (
                <button
                  key={c._id}
                  onClick={() => setUsuariosConjuntoFilter(c._id)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                    usuariosConjuntoFilter === c._id
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg scale-105'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.nombre}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    usuariosConjuntoFilter === c._id ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    {contarPorConjunto(c._id)}
                  </span>
                </button>
              ))}
              {haySinConjunto && (
                <button
                  onClick={() => setUsuariosConjuntoFilter('sin-conjunto')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                    usuariosConjuntoFilter === 'sin-conjunto'
                      ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg scale-105'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sin conjunto (Superadmin)
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    usuariosConjuntoFilter === 'sin-conjunto' ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    {contarPorConjunto('sin-conjunto')}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-600 text-sm">
                  <th className="p-4 font-semibold rounded-tl-lg">Nombre</th>
                  <th className="p-4 font-semibold">Documento</th>
                  <th className="p-4 font-semibold">Rol</th>
                  <th className="p-4 font-semibold">Ubicación</th>
                  <th className="p-4 font-semibold rounded-tr-lg">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">
                      No hay usuarios en este conjunto.
                    </td>
                  </tr>
                ) : usuariosFiltrados.map((u, i) => (
                  <tr key={u._id || i} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200">
                    <td className="p-4 font-medium text-slate-800">{u.nombre} {u.apellido}</td>
                    <td className="p-4 text-slate-600">{u.cedula}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${u.rol === 'admin' || u.rol === 'ADMIN' ? 'bg-gradient-to-r from-purple-100 to-fuchsia-100 text-purple-700 border border-purple-200' : u.rol === 'porteria' || u.rol === 'PORTERO' ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200' : u.rol === 'superadmin' ? 'bg-gradient-to-r from-slate-200 to-slate-300 text-slate-700 border border-slate-300' : 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">T{u.torre || '-'} / Apto {u.apartamento || '-'}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleEditarUsuario(u)} className="p-2 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-all duration-200 hover:scale-110" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        {(user?.rol === 'superadmin' || user?.rol === 'admin') && u.rol !== 'superadmin' && (
                          <button onClick={() => handleEliminarUsuario(u)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 transition-all duration-200 hover:scale-110" title="Eliminar">
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
      </div>
    );
  };

  const renderVisitantes = () => (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-100">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-100">
            <UserCheck className="text-emerald-600" size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Control de Visitantes</h2>
        </div>

        {(() => {
          const visitantesFiltrados = (visitantes || []).filter(v => {
            if (visitantesConjuntoFilter === 'todos') return true;
            const cId = typeof v.conjunto === 'object' ? v.conjunto?._id : v.conjunto;
            return cId === visitantesConjuntoFilter;
          });
          const contar = (cId) => {
            if (cId === 'todos') return (visitantes || []).length;
            return (visitantes || []).filter(v => {
              const id = typeof v.conjunto === 'object' ? v.conjunto?._id : v.conjunto;
              return id === cId;
            }).length;
          };

          return (
            <>
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Filtrar por conjunto</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setVisitantesConjuntoFilter('todos')}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                      visitantesConjuntoFilter === 'todos'
                        ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg scale-105'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      visitantesConjuntoFilter === 'todos' ? 'bg-white/20' : 'bg-slate-200'
                    }`}>
                      {contar('todos')}
                    </span>
                  </button>
                  {conjuntos.map(c => (
                    <button
                      key={c._id}
                      onClick={() => setVisitantesConjuntoFilter(c._id)}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                        visitantesConjuntoFilter === c._id
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.nombre}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        visitantesConjuntoFilter === c._id ? 'bg-white/20' : 'bg-slate-200'
                      }`}>
                        {contar(c._id)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-600 text-sm">
                      <th className="p-4 font-semibold rounded-tl-lg">Visitante</th>
                      <th className="p-4 font-semibold">Cédula</th>
                      <th className="p-4 font-semibold">Placa Vehículo</th>
                      <th className="p-4 font-semibold">Autoriza</th>
                      <th className="p-4 font-semibold rounded-tr-lg">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitantesFiltrados.length === 0 ? (
                      <tr><td colSpan="5" className="text-center p-8 text-slate-400">No hay visitantes en este conjunto</td></tr>
                    ) : visitantesFiltrados.map((v, i) => (
                      <tr key={v._id || i} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-transparent transition-all duration-200">
                        <td className="p-4 font-medium text-slate-800">{v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}</td>
                        <td className="p-4 text-slate-600">{v.cedulaVisitante || v.cedula}</td>
                        <td className="p-4 font-mono text-slate-700 bg-slate-50 rounded px-2">{v.placaVisitante || v.placaVehiculo || 'N/A'}</td>
                        <td className="p-4 text-slate-500">{v.usuarioId?.nombre || v.residenteId?.nombre || '-'}</td>
                        <td className="p-4">
                          <button onClick={() => handleVerQR(v)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium transition-all duration-200 hover:scale-105 shadow-lg shadow-emerald-500/30">
                            <QrCode size={16} /> Ver QR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex w-full font-sans text-slate-800">
      {/* Modern Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 hidden md:flex flex-col fixed h-full z-20 shadow-2xl overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Logo */}
        <div className="relative p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-lg opacity-50 animate-pulse" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <ShieldCheck size={26} className="text-white" />
              </div>
            </div>
            <div>
              <p className="font-bold text-xl text-white tracking-wide">SafeEntry</p>
              <p className="text-xs text-slate-400">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 p-4 space-y-1.5">
          {menu.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setView(m.id)}
              className={`group relative w-full p-3.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 ${
                view === m.id
                  ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-white border border-blue-400/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {view === m.id && (
                <div className="absolute left-0 w-1 h-8 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
              )}
              <m.icon size={20} className={`transition-transform duration-300 group-hover:scale-110 ${view === m.id ? 'text-blue-400' : ''}`} />
              <span>{m.label}</span>
              {view === m.id && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="relative p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {user?.nombre?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.nombre || 'Administrador'}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.rol || 'admin'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-4 lg:p-8">
        {/* Header */}
        <header className="relative mb-8 overflow-hidden rounded-2xl bg-white shadow-lg border border-slate-100">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100">
                <BarChart3 size={24} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent capitalize">
                  {view === 'dashboard' ? 'Panel Principal' : `Gestión de ${view}`}
                </h1>
                <p className="text-sm text-slate-500">Bienvenido, {user?.nombre || 'Administrador'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-slate-700">Sistema Activo</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium flex items-center gap-2 shadow-lg shadow-blue-500/30">
                <ShieldCheck size={18} />
                <span className="text-sm">Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Views */}
        <div className="animate-in fade-in duration-500">
          {view === 'dashboard' && renderDashboard()}
          {view === 'conjuntos' && renderConjuntos()}
          {view === 'usuarios' && renderUsuarios()}
          {view === 'visitantes' && renderVisitantes()}

          {view === 'parqueaderos' && (
            <div className="space-y-6">
              {parkStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { title: 'Residentes Carro', data: parkStats.porCategoria?.privado?.carro, gradient: 'from-blue-500 to-blue-600', icon: Car },
                    { title: 'Residentes Moto', data: parkStats.porCategoria?.privado?.moto, gradient: 'from-purple-500 to-purple-600', icon: Car },
                    { title: 'Visitantes Carro', data: parkStats.porCategoria?.visitante?.carro, gradient: 'from-emerald-500 to-emerald-600', icon: Car },
                    { title: 'Visitantes Moto', data: parkStats.porCategoria?.visitante?.moto, gradient: 'from-orange-500 to-orange-600', icon: Car }
                  ].map((item, i) => (
                    <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.gradient} p-5 shadow-xl`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="relative flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                          <item.icon size={24} className="text-white opacity-90" />
                        </div>
                        <div>
                          <p className="text-sm text-white/80 font-medium">{item.title}</p>
                          <p className="text-2xl font-bold text-white">
                            {item.data?.disponibles || 0}<span className="text-lg opacity-70">/{item.data?.total || 0}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-100 p-6">
                {(() => {
                  const conjuntosList = parkData?.conjuntos || [];
                  const activeConjuntoId = conjuntoSeleccionado || conjuntosList[0]?._id;
                  const activeConjunto = conjuntosList.find(c => c._id === activeConjuntoId);

                  const seccionesActivas = torreSeleccionada === 'visitantes'
                    ? [
                        { title: 'Carros', data: activeConjunto?.visitantesCarro, color: 'emerald' },
                        { title: 'Motos', data: activeConjunto?.visitantesMoto, color: 'orange' }
                      ]
                    : [
                        { title: 'Carros', data: activeConjunto?.privadosCarro, color: 'blue' },
                        { title: 'Motos', data: activeConjunto?.privadosMoto, color: 'purple' }
                      ];

                  const colorClassesDisponible = {
                    emerald: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300',
                    orange: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300',
                    blue: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300',
                    purple: 'bg-gradient-to-br from-purple-50 to-violet-50 border-purple-300'
                  };
                  const textColorDisponible = {
                    emerald: 'text-emerald-600',
                    orange: 'text-orange-600',
                    blue: 'text-blue-600',
                    purple: 'text-purple-600'
                  };

                  return (
                    <>
                      {conjuntosList.length > 0 && (
                        <div className="mb-5">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Conjunto</p>
                          <div className="flex flex-wrap gap-2">
                            {conjuntosList.map(c => (
                              <button
                                key={c._id}
                                onClick={() => setConjuntoSeleccionado(c._id)}
                                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${
                                  activeConjuntoId === c._id
                                    ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg scale-105'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {c.nombre}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-6 border-t border-slate-100 pt-5">
                        <button
                          onClick={() => setTorreSeleccionada('privados')}
                          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                            torreSeleccionada === 'privados'
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-105'
                          }`}
                        >
                          Residentes
                        </button>
                        <button
                          onClick={() => setTorreSeleccionada('visitantes')}
                          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                            torreSeleccionada === 'visitantes'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-105'
                          }`}
                        >
                          Visitantes
                        </button>
                      </div>

                      {!activeConjunto ? (
                        <p className="text-center text-slate-500 py-8">No hay conjuntos disponibles.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {seccionesActivas.map((section, i) => (
                            <div key={i}>
                              <h3 className="font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                <Car size={18} /> {section.title}
                                <span className="text-xs text-slate-400 font-normal">
                                  ({section.data?.length || 0})
                                </span>
                              </h3>
                              {(section.data?.length || 0) === 0 ? (
                                <p className="text-sm text-slate-400 italic">Sin parqueaderos</p>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                  {section.data
                                    .slice()
                                    .sort((a, b) => (a.numero || '').localeCompare(b.numero || ''))
                                    .map((p, j) => (
                                    <div key={j} className={`p-3 rounded-xl border-2 text-center transition-all duration-200 hover:scale-105 ${
                                      p.estado === 'DISPONIBLE'
                                        ? colorClassesDisponible[section.color]
                                        : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                                    }`}>
                                      <p className="font-bold text-sm text-slate-800">{p.numero}</p>
                                      <p className={`text-xs font-medium ${
                                        p.estado === 'DISPONIBLE' ? textColorDisponible[section.color] : 'text-red-600'
                                      }`}>
                                        {p.estado === 'DISPONIBLE' ? 'Disponible' : 'Ocupado'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {view === 'auditoria' && (
            <div className="space-y-6">
              {/* Cards de resumen */}
              {audStats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Total', value: audStats.total, gradient: 'from-slate-600 to-slate-700' },
                    { label: 'Hoy', value: audStats.hoy, gradient: 'from-orange-500 to-amber-500' },
                    { label: 'Entradas', value: audStats.entradas, gradient: 'from-emerald-500 to-teal-500' },
                    { label: 'Salidas', value: audStats.salidas, gradient: 'from-rose-500 to-pink-500' },
                    { label: 'Residentes', value: audStats.residentes, gradient: 'from-blue-500 to-indigo-500' },
                    { label: 'Visitantes', value: audStats.visitantes, gradient: 'from-purple-500 to-violet-500' }
                  ].map((c, i) => (
                    <div key={i} className={`rounded-2xl bg-gradient-to-br ${c.gradient} p-4 shadow-lg`}>
                      <p className="text-xs text-white/80 font-medium">{c.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{(c.value || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Filtros */}
              <div className="rounded-2xl bg-white shadow-xl border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={18} className="text-orange-600" />
                  <h3 className="font-bold text-slate-800">Filtros</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Desde</label>
                    <input
                      type="date"
                      value={audFiltros.fechaInicio}
                      onChange={e => { setAudFiltros({ ...audFiltros, fechaInicio: e.target.value }); setAudPage(1); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Hasta</label>
                    <input
                      type="date"
                      value={audFiltros.fechaFin}
                      onChange={e => { setAudFiltros({ ...audFiltros, fechaFin: e.target.value }); setAudPage(1); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Conjunto</label>
                    <select
                      value={audFiltros.conjunto}
                      onChange={e => { setAudFiltros({ ...audFiltros, conjunto: e.target.value }); setAudPage(1); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Todos</option>
                      {conjuntos.map(c => (
                        <option key={c._id} value={c._id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo acceso</label>
                    <select
                      value={audFiltros.tipoAcceso}
                      onChange={e => { setAudFiltros({ ...audFiltros, tipoAcceso: e.target.value }); setAudPage(1); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Todos</option>
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo usuario</label>
                    <select
                      value={audFiltros.tipoUsuario}
                      onChange={e => { setAudFiltros({ ...audFiltros, tipoUsuario: e.target.value }); setAudPage(1); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Todos</option>
                      <option value="residente">Residente</option>
                      <option value="visitante">Visitante</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Placa</label>
                    <input
                      type="text"
                      placeholder="Buscar placa..."
                      value={audFiltros.placa}
                      onChange={e => { setAudFiltros({ ...audFiltros, placa: e.target.value }); setAudPage(1); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent uppercase"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => { setAudFiltros({ fechaInicio: '', fechaFin: '', tipoAcceso: '', tipoUsuario: '', placa: '', conjunto: '' }); setAudPage(1); }}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>

              {/* Tabla */}
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-100">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-orange-100">
                        <Activity className="text-orange-600" size={20} />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800">Historial y Auditoría</h2>
                    </div>
                    <span className="text-sm text-slate-500">
                      {audMeta.total.toLocaleString()} registros
                    </span>
                  </div>

                  {audLoading ? (
                    <p className="text-center py-12 text-slate-500">Cargando...</p>
                  ) : historial.length === 0 ? (
                    <p className="text-center py-12 text-slate-500">No se encontraron accesos con los filtros aplicados.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-600 text-sm">
                            <th className="p-3 font-semibold rounded-tl-lg">Fecha y hora</th>
                            <th className="p-3 font-semibold">Conjunto</th>
                            <th className="p-3 font-semibold">Acceso</th>
                            <th className="p-3 font-semibold">Tipo usuario</th>
                            <th className="p-3 font-semibold">Nombre</th>
                            <th className="p-3 font-semibold">Placa</th>
                            <th className="p-3 font-semibold rounded-tr-lg">Plaza</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historial.map((h, i) => (
                            <tr key={h._id || i} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-orange-50 hover:to-transparent transition-all duration-200">
                              <td className="p-3 text-slate-600 text-sm">{new Date(h.fechaHora).toLocaleString()}</td>
                              <td className="p-3 text-slate-700 text-sm">{h.conjunto?.nombre || '-'}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  h.tipoAcceso === 'entrada'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {h.tipoAcceso}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  h.tipoUsuario === 'residente'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {h.tipoUsuario}
                                </span>
                              </td>
                              <td className="p-3 text-slate-700 text-sm">{h.nombreUsuario || '-'}</td>
                              <td className="p-3 font-mono text-slate-800 text-sm">{h.placa || '-'}</td>
                              <td className="p-3 text-slate-600 text-sm">{h.plaza || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Paginacion */}
                  {audMeta.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        Página {audPage} de {audMeta.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAudPage(1)}
                          disabled={audPage === 1}
                          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⟪
                        </button>
                        <button
                          onClick={() => setAudPage(p => Math.max(1, p - 1))}
                          disabled={audPage === 1}
                          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ‹ Anterior
                        </button>
                        <button
                          onClick={() => setAudPage(p => Math.min(audMeta.totalPages, p + 1))}
                          disabled={audPage >= audMeta.totalPages}
                          className="px-3 py-1.5 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Siguiente ›
                        </button>
                        <button
                          onClick={() => setAudPage(audMeta.totalPages)}
                          disabled={audPage >= audMeta.totalPages}
                          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⟫
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'simulador' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'LPR (Cámara Placas)', desc: 'Modelo de IA YOLOv8 para detección de placas', icon: Video, gradient: 'from-blue-600 to-indigo-700', endpoint: '/scripts/lpr' },
                { title: 'Escáner Pases QR', desc: 'Validación de códigos QR de visitantes', icon: QrCode, gradient: 'from-emerald-600 to-teal-700', endpoint: '/scripts/qr' }
              ].map((item, i) => (
                <div key={i} className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-8 shadow-xl border border-slate-700">
                  <div className="relative text-center">
                    <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-6 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                      <item.icon size={40} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{item.title}</h2>
                    <p className="text-slate-400 mb-6">{item.desc}</p>
                    <button
                      onClick={async () => {
                        try {
                          await api.post(item.endpoint);
                          alert('Sistema iniciado!');
                        } catch (error) {
                          alert('Error al iniciar.');
                        }
                      }}
                      className={`w-full px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${item.gradient} hover:opacity-90 transition-all duration-300 shadow-lg hover:scale-105`}
                    >
                      Iniciar Sistema
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {showConjuntoModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 rounded-t-2xl" />
              <button onClick={() => setShowConjuntoModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors">
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-100">
                  <Building className="text-purple-600" size={22} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Nuevo Conjunto</h2>
              </div>
              <form onSubmit={handleCrearConjunto} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-slate-600 block mb-1.5">Nombre del Conjunto *</label>
                  <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" onChange={e => setConjuntoData({...conjuntoData, nombre: e.target.value})} placeholder="Ej: Torres del Parque" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600 block mb-1.5">NIT</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" onChange={e => setConjuntoData({...conjuntoData, nit: e.target.value})} placeholder="900123456-1" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600 block mb-1.5">Estado</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" value={conjuntoData.estado} onChange={e => setConjuntoData({...conjuntoData, estado: e.target.value})}>
                    <option value="activo">Activo</option>
                    <option value="suspendido">Suspendido</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-slate-600 block mb-1.5">Dirección</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" onChange={e => setConjuntoData({...conjuntoData, direccion: e.target.value})} placeholder="Calle 100 #15-25" />
                </div>
                <button type="submit" className="col-span-2 mt-2 p-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 transition-all duration-300 shadow-lg shadow-purple-500/30">
                  Guardar Conjunto
                </button>
              </form>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-t-2xl" />
              <button onClick={() => {setShowModal(false); setEditMode(false); setEditUserId(null);}} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors">
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-100">
                  <UserPlus className="text-blue-600" size={22} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">{editMode ? 'Editar Usuario' : 'Registrar Usuario'}</h2>
              </div>
              <form onSubmit={handleCrearUsuario} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1.5">Nombre</label>
                    <input required value={formData.nombre || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1.5">Apellido</label>
                    <input required value={formData.apellido || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, apellido: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600 block mb-1.5">Cédula</label>
                  <input required value={formData.cedula || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, cedula: e.target.value})} />
                </div>
                {!editMode && (
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1.5">Contraseña</label>
                    <input required type="password" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, password: e.target.value})} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1.5">Torre</label>
                    <input value={formData.torre || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, torre: e.target.value})} placeholder="Ej: 1" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1.5">Apartamento</label>
                    <input value={formData.apartamento || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, apartamento: e.target.value})} placeholder="Ej: 101" />
                  </div>
                </div>
                {user?.rol === 'superadmin' && (
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1.5">Conjunto Residencial</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" value={formData.conjuntoId || ''} onChange={e => setFormData({...formData, conjuntoId: e.target.value})}>
                      <option value="">Selecciona el conjunto</option>
                      {conjuntos && conjuntos.map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-semibold text-slate-600 block mb-1.5">Rol</label>
                  <select required value={formData.rol || ''} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onChange={e => setFormData({...formData, rol: e.target.value})}>
                    <option value="">Seleccione Rol</option>
                    <option value="admin">Administrador</option>
                    <option value="porteria">Portero</option>
                    <option value="residente">Residente</option>
                  </select>
                </div>
                <button type="submit" className="w-full p-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-blue-500/30">
                  {editMode ? 'Actualizar Usuario' : 'Guardar Usuario'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showQRModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-2xl" />
              <button onClick={() => {setShowQRModal(false); setQrData(null); setSelectedVisitante(null);}} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors">
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-emerald-100">
                  <QrCode className="text-emerald-600" size={22} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Código QR de Visitante</h2>
              </div>
              {selectedVisitante && (
                <div className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                  <p className="text-slate-800 font-semibold">{selectedVisitante.nombreVisitante || selectedVisitante.nombre} {selectedVisitante.apellidoVisitante || selectedVisitante.apellido}</p>
                  <p className="text-sm text-slate-500 mt-1">Cédula: {selectedVisitante.cedulaVisitante || selectedVisitante.cedula}</p>
                </div>
              )}
              {qrLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                  <span className="ml-3 text-slate-600 font-medium">Generando código QR...</span>
                </div>
              ) : qrData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Token de acceso:</p>
                    <code className="text-xs break-all text-slate-700 bg-white p-3 rounded-lg block border border-slate-100">{qrData.token}</code>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500 mb-2 font-medium">URL de verificación:</p>
                    <code className="text-xs break-all text-slate-700 bg-white p-3 rounded-lg block border border-slate-100">{qrData.url}</code>
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