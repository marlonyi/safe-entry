import React, { useState, useEffect } from 'react';
import {
  Users, Car, UserCheck, ShieldCheck, Activity, Edit2, Plus,
  Building, UserPlus, Video, QrCode, X, Clock, BarChart3, Calculator
} from 'lucide-react';
import api from '../services/api';
import Logo from '../components/Logo';
import Pagination from '../components/Pagination';
import ModeloMatematico from '../components/ModeloMatematico';

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

  const [usuariosPage, setUsuariosPage] = useState(1);
  const [usuariosPageSize, setUsuariosPageSize] = useState(10);
  const [visitantesPage, setVisitantesPage] = useState(1);
  const [visitantesPageSize, setVisitantesPageSize] = useState(10);

  const [showInitModal, setShowInitModal] = useState(false);
  const [initConjuntoTarget, setInitConjuntoTarget] = useState(null);
  const [initConfig, setInitConfig] = useState({
    torres: 'A,B', pisos: 5, apartamentosPorPiso: 2,
    residenteMoto: 10, visitanteCarro: 10, visitanteMoto: 5
  });
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState(null);
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

  const [audFiltros, setAudFiltros] = useState({
    fechaInicio: '', fechaFin: '', tipoAcceso: '', tipoUsuario: '', placa: '', conjunto: ''
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
      setShowModal(false); setEditMode(false); setEditUserId(null); setFormData({});
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
      nombre: usuario.nombre || '', apellido: usuario.apellido || '',
      cedula: usuario.cedula || '', rol: usuario.rol?.toUpperCase() || 'RESIDENTE',
      torre: usuario.torre || '', apartamento: usuario.apartamento || '',
      telefono: usuario.telefono || '', email: usuario.email || ''
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

  const isSuperAdmin = user?.rol === 'superadmin';

  const menu = [
    { id: 'dashboard',   label: 'Dashboard',          icon: BarChart3  },
    ...(isSuperAdmin ? [{ id: 'conjuntos', label: 'Gestión Conjuntos', icon: Building }] : []),
    { id: 'usuarios',    label: 'Gestión Usuarios',   icon: Users      },
    { id: 'visitantes',  label: 'Visitantes',          icon: UserCheck  },
    { id: 'parqueaderos',label: 'Parqueaderos',        icon: Car        },
    { id: 'auditoria',   label: 'Auditoría / Accesos', icon: Activity   },
    { id: 'modelo',      label: 'Modelo Matemático',   icon: Calculator },
    { id: 'simulador',   label: 'Simulador Cámaras',   icon: Video      },
  ];

  const POWERBI_EMBED_URL = import.meta.env.VITE_POWERBI_EMBED_URL || '';

  /* ────────────────────────────────
     HELPERS COMUNES
  ──────────────────────────────── */

  // Tabs de filtro de conjunto reutilizables
  const ConjuntoTabs = ({ value, onChange, counter, accentColor = 'var(--se-accent)' }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--se-text-muted)', marginBottom: 8 }}>
        Filtrar por conjunto
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <TabBtn active={value === 'todos'} onClick={() => onChange('todos')} count={counter('todos')} accentColor="#64748B">
          Todos
        </TabBtn>
        {conjuntos.map(c => (
          <TabBtn key={c._id} active={value === c._id} onClick={() => onChange(c._id)} count={counter(c._id)} accentColor={accentColor}>
            {c.nombre}
          </TabBtn>
        ))}
      </div>
    </div>
  );

  /* ── RENDER DASHBOARD ── */
  const renderDashboard = () => (
    <div className="se-fade-in">
      {POWERBI_EMBED_URL ? (
        <div className="space-y-4">
          <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            {/* macOS-style bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', background: 'var(--se-panel-bg)', borderBottom: '1px solid var(--se-panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#EF4444','#F59E0B','#10B981'].map((c,i) => (
                    <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>Power BI Report</span>
              </div>
              <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#475569', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
                admin_residencial
              </span>
            </div>
            <div style={{ height: 2, background: 'linear-gradient(90deg, #0EA5E9, #6366F1, #8B5CF6)' }} />
            <iframe
              title="Dashboard Power BI - Admin Residencial"
              width="100%" height="700px"
              src={POWERBI_EMBED_URL}
              frameBorder="0" allowFullScreen
              style={{ border: 'none', display: 'block' }}
            />
          </div>
          <div className="se-card" style={{ borderRadius: 12, padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              {[
                { icon: Users, label: 'Usuarios activos', color: 'var(--se-accent)' },
                { icon: Car, label: 'Parqueaderos monitoreados', color: '#10B981' },
                { icon: Activity, label: 'Accesos registrados', color: '#8B5CF6' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <item.icon size={15} style={{ color: item.color }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--se-text-secondary)' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--se-text-muted)' }}>Actualizado automáticamente</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 480 }}>
          <div className="se-card" style={{ borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--se-amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <BarChart3 size={26} style={{ color: 'var(--se-amber)' }} />
            </div>
            <h3 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)', marginBottom: 6 }}>
              Configuración Requerida
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--se-text-secondary)', marginBottom: '1rem' }}>
              Agrega la URL de Power BI en{' '}
              <code style={{ background: 'var(--se-bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--se-border)', fontSize: '0.78rem' }}>
                frontend/.env
              </code>
            </p>
            <code style={{ display: 'block', fontSize: '0.72rem', background: 'var(--se-bg)', padding: '0.75rem', borderRadius: 10, border: '1px solid var(--se-border)', color: 'var(--se-text-secondary)', wordBreak: 'break-all' }}>
              VITE_POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...
            </code>
          </div>
        </div>
      )}
    </div>
  );

  /* ── RENDER CONJUNTOS ── */
  const renderConjuntos = () => (
    <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #8B5CF6, #6366F1)' }} />
      <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building size={18} style={{ color: '#8B5CF6' }} />
          </div>
          <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
            Gestión de Conjuntos
          </h2>
        </div>
        <button onClick={() => setShowConjuntoModal(true)} className="se-btn-primary" style={{ borderRadius: 10, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
          <Plus size={16} /> Nuevo Conjunto
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full se-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Nombre</th>
              <th style={{ textAlign: 'left' }}>NIT</th>
              <th style={{ textAlign: 'left' }}>Ciudad</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {conjuntos.map((c, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: 'var(--se-text-primary)' }}>{c.nombre}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--se-text-secondary)' }}>{c.nit || 'S/N'}</td>
                <td style={{ color: 'var(--se-text-secondary)' }}>{c.ciudad || '—'}</td>
                <td>
                  <span className="se-badge" style={
                    c.estado === 'activo'
                      ? { background: 'rgba(16,185,129,0.10)', color: '#065F46' }
                      : { background: 'var(--se-error-dim)', color: 'var(--se-error)' }
                  }>
                    {c.estado ? c.estado.toUpperCase() : 'ACTIVO'}
                  </span>
                </td>
              </tr>
            ))}
            {conjuntos.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>No hay conjuntos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── RENDER USUARIOS ── */
  const renderUsuarios = () => {
    const usuariosBase = (usuarios || []).filter(u => u.rol !== 'superadmin');
    const usuariosFiltrados = usuariosBase.filter(u => {
      if (usuariosConjuntoFilter === 'todos') return true;
      const cId = typeof u.conjunto === 'object' ? u.conjunto?._id : u.conjunto;
      return cId === usuariosConjuntoFilter;
    });
    const usuariosPaginados = usuariosFiltrados.slice(
      (usuariosPage - 1) * usuariosPageSize, usuariosPage * usuariosPageSize
    );
    const contarPorConjunto = (cId) => {
      if (cId === 'todos') return usuariosBase.length;
      return usuariosBase.filter(u => {
        const id = typeof u.conjunto === 'object' ? u.conjunto?._id : u.conjunto;
        return id === cId;
      }).length;
    };
    const rolBadge = (rol) => {
      const map = {
        admin:    { bg: 'rgba(139,92,246,0.12)', color: '#7C3AED' },
        porteria: { bg: 'rgba(245,158,11,0.12)',  color: '#B45309' },
        residente:{ bg: 'var(--se-accent-dim)',   color: '#0369A1' },
      };
      return map[rol?.toLowerCase()] || { bg: '#F1F5F9', color: 'var(--se-text-secondary)' };
    };

    return (
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--se-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: 'var(--se-accent)' }} />
            </div>
            <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Residentes y Personal
            </h2>
          </div>
          <button onClick={async () => {
            const conjResp = await api.get('/conjuntos').catch(() => ({data:{conjuntos: []}}));
            setConjuntos(conjResp.data?.conjuntos || conjResp.data?.data?.conjuntos || []);
            setEditMode(false); setEditUserId(null); setFormData({}); setShowModal(true);
          }} className="se-btn-primary" style={{ borderRadius: 10 }}>
            <UserPlus size={16} /> Agregar Usuario
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem 0' }}>
          <ConjuntoTabs
            value={usuariosConjuntoFilter}
            onChange={(v) => { setUsuariosConjuntoFilter(v); setUsuariosPage(1); }}
            counter={contarPorConjunto}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full se-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Nombre</th>
                <th style={{ textAlign: 'left' }}>Documento</th>
                <th style={{ textAlign: 'left' }}>Rol</th>
                <th style={{ textAlign: 'left' }}>Ubicación</th>
                <th style={{ textAlign: 'left' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>No hay usuarios en este conjunto.</td></tr>
              ) : usuariosPaginados.map((u, i) => {
                const badge = rolBadge(u.rol);
                return (
                  <tr key={u._id || i}>
                    <td style={{ fontWeight: 600, color: 'var(--se-text-primary)' }}>{u.nombre} {u.apellido}</td>
                    <td style={{ color: 'var(--se-text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.cedula}</td>
                    <td>
                      <span className="se-badge" style={{ background: badge.bg, color: badge.color }}>
                        {u.rol}
                      </span>
                    </td>
                    <td style={{ color: 'var(--se-text-muted)', fontSize: '0.82rem' }}>
                      T{u.torre || '—'} / Apto {u.apartamento || '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleEditarUsuario(u)}
                        title="Editar"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--se-bg)', border: '1px solid var(--se-border)',
                          color: 'var(--se-text-secondary)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--se-accent-dim)'; e.currentTarget.style.color = 'var(--se-accent)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--se-bg)'; e.currentTarget.style.color = 'var(--se-text-secondary)'; e.currentTarget.style.borderColor = 'var(--se-border)'; }}
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
          <Pagination
            currentPage={usuariosPage}
            totalItems={usuariosFiltrados.length}
            pageSize={usuariosPageSize}
            onPageChange={setUsuariosPage}
            onPageSizeChange={(s) => { setUsuariosPageSize(s); setUsuariosPage(1); }}
          />
        </div>
      </div>
    );
  };

  /* ── RENDER VISITANTES ── */
  const renderVisitantes = () => {
    const visitantesFiltrados = (visitantes || []).filter(v => {
      if (visitantesConjuntoFilter === 'todos') return true;
      const cId = typeof v.conjunto === 'object' ? v.conjunto?._id : v.conjunto;
      return cId === visitantesConjuntoFilter;
    });
    const visitantesPaginados = visitantesFiltrados.slice(
      (visitantesPage - 1) * visitantesPageSize, visitantesPage * visitantesPageSize
    );
    const contar = (cId) => {
      if (cId === 'todos') return (visitantes || []).length;
      return (visitantes || []).filter(v => {
        const id = typeof v.conjunto === 'object' ? v.conjunto?._id : v.conjunto;
        return id === cId;
      }).length;
    };

    return (
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />
        <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={18} style={{ color: '#10B981' }} />
          </div>
          <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
            Control de Visitantes
          </h2>
        </div>

        <div style={{ padding: '1rem 1.25rem 0' }}>
          <ConjuntoTabs
            value={visitantesConjuntoFilter}
            onChange={(v) => { setVisitantesConjuntoFilter(v); setVisitantesPage(1); }}
            counter={contar}
            accentColor="#10B981"
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full se-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Visitante</th>
                <th style={{ textAlign: 'left' }}>Cédula</th>
                <th style={{ textAlign: 'left' }}>Placa Vehículo</th>
                <th style={{ textAlign: 'left' }}>Autoriza</th>
                <th style={{ textAlign: 'left' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visitantesFiltrados.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>No hay visitantes en este conjunto</td></tr>
              ) : visitantesPaginados.map((v, i) => (
                <tr key={v._id || i}>
                  <td style={{ fontWeight: 600, color: 'var(--se-text-primary)' }}>
                    {v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}
                  </td>
                  <td style={{ color: 'var(--se-text-secondary)' }}>{v.cedulaVisitante || v.cedula}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--se-text-primary)', background: 'var(--se-bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--se-border)' }}>
                      {v.placaVisitante || v.placaVehiculo || 'N/A'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--se-text-muted)', fontSize: '0.82rem' }}>
                    {v.usuarioId?.nombre || v.residenteId?.nombre || '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => handleVerQR(v)}
                      className="se-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: 8, background: 'linear-gradient(135deg, #10B981, #0EA5E9)', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}
                    >
                      <QrCode size={13} /> Ver QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
          <Pagination
            currentPage={visitantesPage}
            totalItems={visitantesFiltrados.length}
            pageSize={visitantesPageSize}
            onPageChange={setVisitantesPage}
            onPageSizeChange={(s) => { setVisitantesPageSize(s); setVisitantesPage(1); }}
          />
        </div>
      </div>
    );
  };

  /* ── MAIN LAYOUT ── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--se-bg)' }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col" style={{
        width: 260, flexShrink: 0,
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 20,
        background: 'var(--se-panel-bg)',
        borderRight: '1px solid var(--se-panel-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 32px)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--se-panel-border)', position: 'relative' }}>
          <Logo theme="dark" subtitle="Admin Dashboard" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto', position: 'relative' }}>
          {menu.map((m) => (
            <button
              key={m.id}
              onClick={() => setView(m.id)}
              className={`se-nav-item ${view === m.id ? 'active' : ''}`}
              style={{ marginBottom: 3, position: 'relative' }}
            >
              {view === m.id && (
                <div style={{ position: 'absolute', left: 0, width: 3, height: 22, background: 'var(--se-accent)', borderRadius: '0 4px 4px 0' }} />
              )}
              <m.icon size={18} className="se-nav-icon" />
              <span>{m.label}</span>
              {view === m.id && (
                <span className="se-pulse-dot" style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--se-accent)' }} />
              )}
            </button>
          ))}
        </nav>

        {/* User card */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--se-panel-border)', position: 'relative' }}>
          <div className="se-user-card">
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: isSuperAdmin
                ? 'linear-gradient(135deg, #8B5CF6, #6366F1)'
                : 'linear-gradient(135deg, #0EA5E9, #0284C7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color: '#fff',
              boxShadow: `0 2px 8px ${isSuperAdmin ? 'rgba(99,102,241,0.3)' : 'rgba(14,165,233,0.3)'}`,
            }}>
              {user?.nombre?.charAt(0) || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.nombre || 'Administrador'}
              </p>
              <p style={{ fontSize: '0.7rem', textTransform: 'capitalize', color: isSuperAdmin ? '#A78BFA' : '#60A5FA' }}>
                {user?.rol || 'admin'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 260, padding: '2rem', minWidth: 0 }}>

        {/* Header */}
        <header className="se-card" style={{ borderRadius: 14, overflow: 'hidden', marginBottom: '2rem' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1, #8B5CF6)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--se-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={20} style={{ color: 'var(--se-accent)' }} />
              </div>
              <div>
                <h1 className="se-heading" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--se-text-primary)', textTransform: 'capitalize' }}>
                  {view === 'dashboard' ? 'Panel Principal' : view}
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)' }}>
                  Bienvenido, {user?.nombre || 'Administrador'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {view === 'dashboard' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.375rem 0.75rem', borderRadius: 999, background: 'var(--se-bg)', border: '1px solid var(--se-border)' }}>
                  <Clock size={12} style={{ color: 'var(--se-text-muted)' }} />
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--se-text-secondary)' }}>
                    {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <span className="se-badge" style={{ background: 'rgba(16,185,129,0.10)', color: '#065F46', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                Sistema Activo
              </span>
              <span className="se-badge" style={isSuperAdmin
                ? { background: 'rgba(139,92,246,0.12)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.25)' }
                : { background: 'var(--se-accent-dim)', color: 'var(--se-accent)', border: '1px solid rgba(14,165,233,0.25)' }
              }>
                <ShieldCheck size={12} />
                {isSuperAdmin ? 'SuperAdmin' : 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Views */}
        {view === 'dashboard'   && renderDashboard()}
        {view === 'conjuntos'   && renderConjuntos()}
        {view === 'usuarios'    && renderUsuarios()}
        {view === 'visitantes'  && renderVisitantes()}

        {/* ── PARQUEADEROS ── */}
        {view === 'parqueaderos' && (
          <div className="space-y-6 se-fade-in">
            {parkStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { title: 'Residentes Carro', data: parkStats.porCategoria?.privado?.carro,    accentColor: '#0EA5E9' },
                  { title: 'Residentes Moto',  data: parkStats.porCategoria?.privado?.moto,     accentColor: '#8B5CF6' },
                  { title: 'Visitantes Carro', data: parkStats.porCategoria?.visitante?.carro,  accentColor: '#10B981' },
                  { title: 'Visitantes Moto',  data: parkStats.porCategoria?.visitante?.moto,   accentColor: '#F59E0B' },
                ].map((item, i) => (
                  <div key={i} className="se-card" style={{ borderRadius: 14, padding: '1.25rem' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, marginBottom: 10,
                      background: `${item.accentColor}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Car size={18} style={{ color: item.accentColor }} />
                    </div>
                    <p className="se-heading" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--se-text-primary)', lineHeight: 1 }}>
                      {item.data?.disponibles || 0}
                      <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--se-text-muted)' }}>/{item.data?.total || 0}</span>
                    </p>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginTop: 4 }}>
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, #6366F1, #0EA5E9)' }} />
              <div style={{ padding: '1.25rem' }}>
                {(() => {
                  const conjuntosList = (parkData?.conjuntos || []).filter(c => {
                    const nombre = (c?.nombre || '').toLowerCase();
                    return c?._id && nombre !== 'sin conjunto' && nombre !== 'sin-conjunto';
                  });
                  const activeConjuntoId = conjuntoSeleccionado || conjuntosList[0]?._id;
                  const activeConjunto = conjuntosList.find(c => c._id === activeConjuntoId);
                  const seccionesActivas = torreSeleccionada === 'visitantes'
                    ? [
                        { title: 'Carros',  data: activeConjunto?.visitantesCarro, colorBorder: '#6EE7B7', colorBg: '#ECFDF5', colorText: '#065F46' },
                        { title: 'Motos',   data: activeConjunto?.visitantesMoto,  colorBorder: '#FCD34D', colorBg: '#FFFBEB', colorText: '#92400E' },
                      ]
                    : [
                        { title: 'Carros',  data: activeConjunto?.privadosCarro,  colorBorder: '#93C5FD', colorBg: '#EFF6FF', colorText: '#1D4ED8' },
                        { title: 'Motos',   data: activeConjunto?.privadosMoto,   colorBorder: '#C4B5FD', colorBg: '#F5F3FF', colorText: '#7C3AED' },
                      ];
                  const totalPlazasActive = (activeConjunto?.privadosCarro?.length || 0)
                    + (activeConjunto?.privadosMoto?.length || 0)
                    + (activeConjunto?.visitantesCarro?.length || 0)
                    + (activeConjunto?.visitantesMoto?.length || 0);
                  const conjuntoSinPlazas = activeConjunto && totalPlazasActive === 0;

                  return (
                    <>
                      {/* Tabs de conjunto */}
                      {conjuntosList.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--se-text-muted)', marginBottom: 8 }}>Conjunto</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {conjuntosList.map(c => (
                              <TabBtn key={c._id} active={activeConjuntoId === c._id} onClick={() => setConjuntoSeleccionado(c._id)} accentColor="var(--se-accent)">
                                {c.nombre}
                              </TabBtn>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Banner sin plazas */}
                      {conjuntoSinPlazas && (
                        <div style={{
                          marginBottom: '1rem', padding: '1rem 1.125rem',
                          borderRadius: 12,
                          background: 'var(--se-amber-dim)', border: '1px solid rgba(245,158,11,0.25)',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Car size={17} style={{ color: 'var(--se-amber)' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
                              El conjunto "{activeConjunto.nombre}" aún no tiene parqueaderos
                            </p>
                            <p style={{ fontSize: '0.78rem', color: '#92400E', marginBottom: '0.75rem' }}>
                              Genera plazas automáticamente con la configuración que prefieras.
                            </p>
                            <button
                              onClick={() => {
                                setInitConjuntoTarget(activeConjunto);
                                setInitConfig({ torres: 'A,B', pisos: 5, apartamentosPorPiso: 2, residenteMoto: 10, visitanteCarro: 10, visitanteMoto: 5 });
                                setShowInitModal(true);
                              }}
                              className="se-btn-primary"
                              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)', borderRadius: 10 }}
                            >
                              Configurar e inicializar parqueaderos
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tabs Residentes / Visitantes */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--se-border)' }}>
                        {[
                          { id: 'privados',   label: 'Residentes', color: 'var(--se-accent)' },
                          { id: 'visitantes', label: 'Visitantes',  color: '#10B981' },
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTorreSeleccionada(t.id)}
                            style={{
                              padding: '0.5rem 1.125rem', borderRadius: 10,
                              fontSize: '0.82rem', fontWeight: 700,
                              cursor: 'pointer', transition: 'all 0.15s',
                              ...(torreSeleccionada === t.id
                                ? { background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, boxShadow: `0 2px 8px ${t.color}20` }
                                : { background: 'var(--se-bg)', color: 'var(--se-text-secondary)', border: '1px solid var(--se-border)' })
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {!activeConjunto ? (
                        <p style={{ textAlign: 'center', color: 'var(--se-text-muted)', padding: '2rem 0' }}>No hay conjuntos disponibles.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {seccionesActivas.map((section, i) => (
                            <div key={i}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)', marginBottom: 10 }}>
                                {section.title} ({section.data?.length || 0})
                              </p>
                              {(section.data?.length || 0) === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', fontStyle: 'italic' }}>Sin parqueaderos</p>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                  {section.data.slice().sort((a, b) => (a.numero || '').localeCompare(b.numero || '')).map((p, j) => (
                                    <div key={j} style={{
                                      borderRadius: 12, padding: '0.5rem',
                                      textAlign: 'center', cursor: 'default',
                                      border: `2px solid ${p.estado === 'DISPONIBLE' ? section.colorBorder : '#FCA5A5'}`,
                                      background: p.estado === 'DISPONIBLE' ? section.colorBg : '#FFF1F2',
                                      transition: 'transform 0.15s',
                                    }}
                                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                      <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>{p.numero}</p>
                                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: p.estado === 'DISPONIBLE' ? section.colorText : '#EF4444' }}>
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
          </div>
        )}

        {/* ── AUDITORÍA ── */}
        {view === 'auditoria' && (
          <div className="space-y-5 se-fade-in">
            {/* Stats */}
            {audStats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total',      value: audStats.total,      accentColor: '#64748B' },
                  { label: 'Hoy',        value: audStats.hoy,        accentColor: '#F59E0B' },
                  { label: 'Entradas',   value: audStats.entradas,   accentColor: '#10B981' },
                  { label: 'Salidas',    value: audStats.salidas,    accentColor: '#EF4444' },
                  { label: 'Residentes', value: audStats.residentes, accentColor: '#0EA5E9' },
                  { label: 'Visitantes', value: audStats.visitantes, accentColor: '#8B5CF6' },
                ].map((c, i) => (
                  <div key={i} className="se-card" style={{ borderRadius: 12, padding: '1rem' }}>
                    <p className="se-heading" style={{ fontSize: '1.625rem', fontWeight: 800, color: c.accentColor, lineHeight: 1 }}>
                      {(c.value || 0).toLocaleString()}
                    </p>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginTop: 4 }}>
                      {c.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Filtros */}
            <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--se-amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={17} style={{ color: 'var(--se-amber)' }} />
                </div>
                <h3 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>Filtros</h3>
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  {[
                    { label: 'Desde',       key: 'fechaInicio', type: 'date' },
                    { label: 'Hasta',       key: 'fechaFin',    type: 'date' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type={f.type} value={audFiltros[f.key]} onChange={e => { setAudFiltros({ ...audFiltros, [f.key]: e.target.value }); setAudPage(1); }} className="se-input" />
                    </div>
                  ))}

                  <div>
                    <label style={labelStyle}>Conjunto</label>
                    <select value={audFiltros.conjunto} onChange={e => { setAudFiltros({ ...audFiltros, conjunto: e.target.value }); setAudPage(1); }} className="se-input">
                      <option value="">Todos</option>
                      {conjuntos.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Tipo acceso</label>
                    <select value={audFiltros.tipoAcceso} onChange={e => { setAudFiltros({ ...audFiltros, tipoAcceso: e.target.value }); setAudPage(1); }} className="se-input">
                      <option value="">Todos</option>
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Tipo usuario</label>
                    <select value={audFiltros.tipoUsuario} onChange={e => { setAudFiltros({ ...audFiltros, tipoUsuario: e.target.value }); setAudPage(1); }} className="se-input">
                      <option value="">Todos</option>
                      <option value="residente">Residente</option>
                      <option value="visitante">Visitante</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Placa</label>
                    <input
                      type="text" placeholder="Buscar placa..."
                      value={audFiltros.placa}
                      onChange={e => { setAudFiltros({ ...audFiltros, placa: e.target.value }); setAudPage(1); }}
                      className="se-input" style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setAudFiltros({ fechaInicio: '', fechaFin: '', tipoAcceso: '', tipoUsuario: '', placa: '', conjunto: '' }); setAudPage(1); }}
                    className="se-btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.875rem', borderRadius: 8 }}
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla historial */}
            <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }} />
              <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={17} style={{ color: 'var(--se-amber)' }} />
                  </div>
                  <h2 className="se-heading" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
                    Historial y Auditoría
                  </h2>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)' }}>
                  {audMeta.total.toLocaleString()} registros
                </span>
              </div>

              {audLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
                  <div style={{ width: 32, height: 32, border: '2px solid var(--se-border)', borderTopColor: 'var(--se-amber)', borderRadius: '50%', margin: '0 auto 10px', animation: 'se-arc-spin 0.8s linear infinite' }} />
                  Cargando...
                </div>
              ) : historial.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
                  No se encontraron accesos con los filtros aplicados.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="w-full se-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Fecha y hora</th>
                        <th style={{ textAlign: 'left' }}>Conjunto</th>
                        <th style={{ textAlign: 'left' }}>Acceso</th>
                        <th style={{ textAlign: 'left' }}>Tipo usuario</th>
                        <th style={{ textAlign: 'left' }}>Nombre</th>
                        <th style={{ textAlign: 'left' }}>Placa</th>
                        <th style={{ textAlign: 'left' }}>Plaza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h, i) => (
                        <tr key={h._id || i}>
                          <td style={{ fontSize: '0.78rem', color: 'var(--se-text-secondary)', fontFamily: 'monospace' }}>
                            {new Date(h.fechaHora).toLocaleString()}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{h.conjunto?.nombre || '—'}</td>
                          <td>
                            <span className="se-badge" style={
                              h.tipoAcceso === 'entrada'
                                ? { background: 'rgba(16,185,129,0.10)', color: '#065F46' }
                                : { background: 'rgba(239,68,68,0.10)', color: '#B91C1C' }
                            }>{h.tipoAcceso}</span>
                          </td>
                          <td>
                            <span className="se-badge" style={
                              h.tipoUsuario === 'residente'
                                ? { background: 'var(--se-accent-dim)', color: '#0369A1' }
                                : { background: 'rgba(139,92,246,0.12)', color: '#7C3AED' }
                            }>{h.tipoUsuario}</span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{h.nombreUsuario || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700 }}>{h.placa || '—'}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--se-text-muted)' }}>{h.plaza || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
                <Pagination
                  currentPage={audPage}
                  totalItems={audMeta.total || 0}
                  pageSize={audLimit}
                  onPageChange={setAudPage}
                />
              </div>
            </div>
          </div>
        )}

        {view === 'modelo' && <ModeloMatematico />}

        {/* ── SIMULADOR ── */}
        {view === 'simulador' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 se-fade-in">
            {[
              { title: 'LPR (Cámara Placas)', desc: 'Modelo de IA YOLOv8 para detección de placas vehiculares', icon: Video, accentColor: '#0EA5E9', endpoint: '/scripts/lpr' },
              { title: 'Escáner Pases QR',    desc: 'Validación de códigos QR de acceso para visitantes',       icon: QrCode, accentColor: '#10B981', endpoint: '/scripts/qr'  },
            ].map((item, i) => (
              <div key={i} className="se-card" style={{ borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ height: 3, background: `${item.accentColor}` }} />
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 18, margin: '0 auto 1.25rem',
                    background: `${item.accentColor}18`,
                    border: `1px solid ${item.accentColor}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <item.icon size={30} style={{ color: item.accentColor }} />
                  </div>
                  <h2 className="se-heading" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--se-text-primary)', marginBottom: 6 }}>
                    {item.title}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--se-text-secondary)', marginBottom: '1.5rem' }}>
                    {item.desc}
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await api.post(item.endpoint);
                        alert('Sistema iniciado!');
                      } catch (error) {
                        alert('Error al iniciar.');
                      }
                    }}
                    className="se-btn-primary"
                    style={{
                      width: '100%', justifyContent: 'center', borderRadius: 12,
                      background: `linear-gradient(135deg, ${item.accentColor}, ${item.accentColor}cc)`,
                      boxShadow: `0 4px 14px ${item.accentColor}35`,
                    }}
                  >
                    Iniciar Sistema
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MODALS ── */}

        {/* Modal: Nuevo Conjunto */}
        {showConjuntoModal && (
          <Modal onClose={() => setShowConjuntoModal(false)} accentColor="#8B5CF6">
            <ModalHeader icon={Building} iconBg="rgba(139,92,246,0.12)" iconColor="#8B5CF6" title="Nuevo Conjunto" onClose={() => setShowConjuntoModal(false)} />
            <form onSubmit={handleCrearConjunto} className="grid grid-cols-2 gap-4">
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nombre del Conjunto *</label>
                <input required className="se-input" onChange={e => setConjuntoData({...conjuntoData, nombre: e.target.value})} placeholder="Ej: Torres del Parque" />
              </div>
              <div>
                <label style={labelStyle}>NIT</label>
                <input className="se-input" onChange={e => setConjuntoData({...conjuntoData, nit: e.target.value})} placeholder="900123456-1" />
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <select className="se-input" value={conjuntoData.estado} onChange={e => setConjuntoData({...conjuntoData, estado: e.target.value})}>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Dirección</label>
                <input className="se-input" onChange={e => setConjuntoData({...conjuntoData, direccion: e.target.value})} placeholder="Calle 100 #15-25" />
              </div>
              <button type="submit" className="se-btn-primary" style={{ gridColumn: '1 / -1', justifyContent: 'center', borderRadius: 12, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                Guardar Conjunto
              </button>
            </form>
          </Modal>
        )}

        {/* Modal: Crear / Editar Usuario */}
        {showModal && (
          <Modal onClose={() => {setShowModal(false); setEditMode(false); setEditUserId(null);}} accentColor="var(--se-accent)">
            <ModalHeader icon={UserPlus} iconBg="var(--se-accent-dim)" iconColor="var(--se-accent)" title={editMode ? 'Editar Usuario' : 'Registrar Usuario'} onClose={() => {setShowModal(false); setEditMode(false); setEditUserId(null);}} />
            <form onSubmit={handleCrearUsuario} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input required value={formData.nombre || ''} className="se-input" onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                <div>
                  <label style={labelStyle}>Apellido</label>
                  <input required value={formData.apellido || ''} className="se-input" onChange={e => setFormData({...formData, apellido: e.target.value})} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Cédula</label>
                <input required value={formData.cedula || ''} className="se-input" onChange={e => setFormData({...formData, cedula: e.target.value})} />
              </div>
              {!editMode && (
                <div>
                  <label style={labelStyle}>Contraseña</label>
                  <input required type="password" className="se-input" onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Torre</label>
                  <input value={formData.torre || ''} className="se-input" onChange={e => setFormData({...formData, torre: e.target.value})} placeholder="Ej: 1" />
                </div>
                <div>
                  <label style={labelStyle}>Apartamento</label>
                  <input value={formData.apartamento || ''} className="se-input" onChange={e => setFormData({...formData, apartamento: e.target.value})} placeholder="Ej: 101" />
                </div>
              </div>
              {isSuperAdmin && (
                <div>
                  <label style={labelStyle}>Conjunto Residencial</label>
                  <select className="se-input" value={formData.conjuntoId || ''} onChange={e => setFormData({...formData, conjuntoId: e.target.value})}>
                    <option value="">Selecciona el conjunto</option>
                    {conjuntos && conjuntos.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Rol</label>
                <select required value={formData.rol || ''} className="se-input" onChange={e => setFormData({...formData, rol: e.target.value})}>
                  <option value="">Seleccione Rol</option>
                  <option value="admin">Administrador</option>
                  <option value="porteria">Portero</option>
                  <option value="residente">Residente</option>
                </select>
              </div>
              <button type="submit" className="se-btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 12 }}>
                {editMode ? 'Actualizar Usuario' : 'Guardar Usuario'}
              </button>
            </form>
          </Modal>
        )}

        {/* Modal: Inicializar Parqueaderos */}
        {showInitModal && initConjuntoTarget && (
          <Modal onClose={() => { setShowInitModal(false); setInitError(null); }} accentColor="var(--se-amber)">
            <ModalHeader icon={Car} iconBg="rgba(245,158,11,0.12)" iconColor="var(--se-amber)" title="Inicializar parqueaderos" subtitle={initConjuntoTarget.nombre} onClose={() => { setShowInitModal(false); setInitError(null); }} />

            <div className="space-y-4">
              <div>
                <label style={labelStyle}>Torres (separadas por coma)</label>
                <input type="text" value={initConfig.torres} onChange={e => setInitConfig({ ...initConfig, torres: e.target.value })} className="se-input" placeholder="A,B,C" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Pisos por torre</label>
                  <input type="number" min="1" value={initConfig.pisos} onChange={e => setInitConfig({ ...initConfig, pisos: Number(e.target.value) || 1 })} className="se-input" />
                </div>
                <div>
                  <label style={labelStyle}>Aptos por piso</label>
                  <input type="number" min="1" value={initConfig.apartamentosPorPiso} onChange={e => setInitConfig({ ...initConfig, apartamentosPorPiso: Number(e.target.value) || 1 })} className="se-input" />
                </div>
              </div>
              <div style={{ padding: '0.875rem', borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <label style={{ ...labelStyle, color: '#7C3AED' }}>Plazas de MOTO para residentes</label>
                <input type="number" min="0" value={initConfig.residenteMoto} onChange={e => setInitConfig({ ...initConfig, residenteMoto: Number(e.target.value) || 0 })} className="se-input" placeholder="Ej: 10" />
                <p style={{ fontSize: '0.7rem', color: '#7C3AED', marginTop: 5 }}>Los carros se crean automáticamente (1 por apartamento). Esta cantidad es adicional para motos.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Visitantes carro</label>
                  <input type="number" min="0" value={initConfig.visitanteCarro} onChange={e => setInitConfig({ ...initConfig, visitanteCarro: Number(e.target.value) || 0 })} className="se-input" />
                </div>
                <div>
                  <label style={labelStyle}>Visitantes moto</label>
                  <input type="number" min="0" value={initConfig.visitanteMoto} onChange={e => setInitConfig({ ...initConfig, visitanteMoto: Number(e.target.value) || 0 })} className="se-input" />
                </div>
              </div>

              {/* Resumen */}
              <div style={{ padding: '0.75rem', borderRadius: 10, background: 'var(--se-amber-dim)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', color: '#92400E' }}>
                <strong>Resumen: </strong>
                <strong>{(initConfig.torres.split(',').filter(Boolean).length) * initConfig.pisos * initConfig.apartamentosPorPiso}</strong> carros residentes +{' '}
                <strong>{initConfig.residenteMoto}</strong> motos residentes +{' '}
                <strong>{initConfig.visitanteCarro}</strong> visitantes carro +{' '}
                <strong>{initConfig.visitanteMoto}</strong> visitantes moto ={' '}
                <strong>{(initConfig.torres.split(',').filter(Boolean).length) * initConfig.pisos * initConfig.apartamentosPorPiso + initConfig.residenteMoto + initConfig.visitanteCarro + initConfig.visitanteMoto}</strong> plazas en total
              </div>

              {initError && (
                <div style={{ padding: '0.625rem', borderRadius: 8, background: 'var(--se-error-dim)', color: 'var(--se-error)', fontSize: '0.8rem', fontWeight: 600 }}>
                  {initError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button onClick={() => { setShowInitModal(false); setInitError(null); }} className="se-btn-ghost" style={{ borderRadius: 10 }}>Cancelar</button>
                <button
                  disabled={initLoading}
                  onClick={async () => {
                    setInitLoading(true); setInitError(null);
                    try {
                      const body = {
                        torres: initConfig.torres.split(',').map(t => t.trim()).filter(Boolean),
                        pisos: Number(initConfig.pisos),
                        apartamentosPorPiso: Number(initConfig.apartamentosPorPiso),
                        residenteMoto: Number(initConfig.residenteMoto),
                        visitanteCarro: Number(initConfig.visitanteCarro),
                        visitanteMoto: Number(initConfig.visitanteMoto),
                      };
                      await api.post(`/parqueaderos/inicializar-conjunto/${initConjuntoTarget._id}`, body);
                      setShowInitModal(false);
                      const torreResp = await api.get('/parqueaderos/por-torre').catch(() => null);
                      if (torreResp) setParkData(torreResp.data?.data || torreResp.data);
                      const statsResp = await api.get('/parqueaderos/estadisticas').catch(() => null);
                      if (statsResp) setParkStats(statsResp.data?.data || statsResp.data);
                    } catch (e) {
                      setInitError(e.response?.data?.error || e.response?.data?.message || e.message);
                    } finally {
                      setInitLoading(false);
                    }
                  }}
                  className="se-btn-primary"
                  style={{ borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)', opacity: initLoading ? 0.6 : 1 }}
                >
                  {initLoading ? 'Creando...' : 'Crear parqueaderos'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: QR Visitante */}
        {showQRModal && (
          <Modal onClose={() => {setShowQRModal(false); setQrData(null); setSelectedVisitante(null);}}>
            <ModalHeader icon={QrCode} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981" title="Código QR de Visitante" onClose={() => {setShowQRModal(false); setQrData(null); setSelectedVisitante(null);}} />
            {selectedVisitante && (
              <div style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: 700, color: 'var(--se-text-primary)' }}>
                  {selectedVisitante.nombreVisitante || selectedVisitante.nombre} {selectedVisitante.apellidoVisitante || selectedVisitante.apellido}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', marginTop: 3 }}>
                  Cédula: {selectedVisitante.cedulaVisitante || selectedVisitante.cedula}
                </p>
              </div>
            )}
            {qrLoading ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, border: '3px solid var(--se-border)', borderTopColor: '#10B981', borderRadius: '50%', animation: 'se-arc-spin 0.8s linear infinite' }} />
                <span style={{ color: 'var(--se-text-secondary)', fontSize: '0.85rem' }}>Generando código QR...</span>
              </div>
            ) : qrData ? (
              <div className="space-y-3">
                <div style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '0.875rem 1rem' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 6 }}>Token de acceso:</p>
                  <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--se-text-secondary)', background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--se-border)', display: 'block' }}>
                    {qrData.token}
                  </code>
                </div>
                <div style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '0.875rem 1rem' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 6 }}>URL de verificación:</p>
                  <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--se-accent)', background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--se-border)', display: 'block' }}>
                    {qrData.url}
                  </code>
                </div>
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--se-text-muted)', padding: '1.5rem 0' }}>No se pudo generar el código QR</p>
            )}
          </Modal>
        )}
      </main>
    </div>
  );
}

/* ────────────────────────────────
   HELPERS COMPARTIDOS
──────────────────────────────── */

const labelStyle = {
  display: 'block',
  marginBottom: 5,
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--se-text-secondary)',
};

function TabBtn({ active, onClick, count, accentColor = 'var(--se-accent)', children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '0.4rem 0.875rem', borderRadius: 8,
        fontSize: '0.78rem', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.15s',
        ...(active
          ? { background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}35`, boxShadow: `0 2px 8px ${accentColor}18` }
          : { background: 'var(--se-bg)', color: 'var(--se-text-secondary)', border: '1px solid var(--se-border)' })
      }}
    >
      {children}
      {count !== undefined && (
        <span style={{
          fontSize: '0.65rem', fontWeight: 700,
          padding: '0 5px', borderRadius: 999,
          background: active ? `${accentColor}25` : '#F1F5F9',
          color: active ? accentColor : 'var(--se-text-muted)',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function Modal({ children, onClose, accentColor = 'var(--se-accent)' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      background: 'rgba(8,13,20,0.75)',
      backdropFilter: 'blur(8px)',
    }}>
      <div className="se-slide-up se-card" style={{
        borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 500,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, #6366F1)` }} />
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ icon: Icon, iconBg, iconColor, title, subtitle, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <div>
          <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)', marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--se-border)', background: 'var(--se-bg)', color: 'var(--se-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
