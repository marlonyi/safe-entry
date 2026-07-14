import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ShieldCheck, UserCheck, MonitorPlay, Car, AlertTriangle, ArrowRightCircle, Clock, QrCode, Menu, ChevronLeft, ChevronRight, Box } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Logo from '../components/Logo';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
// Simulación 3D en su propio chunk: arrastra @react-three/fiber+drei+three
// (motor 3D pesado), que no debe entrar en el bundle de la portería salvo al
// mostrarse el panel.
const Conjunto3D = lazy(() => import('../components/Conjunto3D/Conjunto3D'));

export default function PorteroDashboard({ user }) {
  const { showToast, ToastContainer } = useToast();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'warning' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [view, setView] = useState('dashboard');
  const [busquedaVisitantes, setBusquedaVisitantes] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [tipoTab, setTipoTab] = useState('residentes');

  /* Track desktop breakpoint for sidebar offset */
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const openConfirm = (title, message, onConfirm, variant = 'warning') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  };
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false, onConfirm: null }));

  /* ── Helpers ── */
  const unwrap = (resp) => {
    const d = resp?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.data?.items)) return d.data.items;
    return [];
  };

  /* ── Queries ── */

  // Visitantes: refetch every 3 s (live access control data)
  const { data: visitantes = [], isError: visitantesError, isLoading: visitantesLoading } = useQuery({
    queryKey: ['porteriaVisitantes'],
    queryFn: async () => unwrap(await api.get('/visitantes')),
    refetchInterval: () => (!document.hidden ? 10000 : false),
    staleTime: 5000,
    retry: 2,
  });

  const { data: historial = [] } = useQuery({
    queryKey: ['porteriaHistorial'],
    queryFn: async () => unwrap(await api.get('/parqueaderos/historial?limit=20&page=1').catch(() => ({ data: [] }))),
    refetchInterval: () => (!document.hidden ? 10000 : false),
    staleTime: 5000,
  });

  const { data: statsHist = {} } = useQuery({
    queryKey: ['porteriaStatsHist'],
    queryFn: async () => {
      const res = await api.get('/parqueaderos/historial/estadisticas').catch(() => ({ data: {} }));
      return res.data || {};
    },
    refetchInterval: () => (!document.hidden ? 15000 : false),
    staleTime: 10000,
  });

  const { data: parqueaderos = [], isFetching: parkLoading, isError: parqueaderosError } = useQuery({
    queryKey: ['porteriaParqueaderos'],
    queryFn: async () => unwrap(await api.get('/parqueaderos')),
    staleTime: 300_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  /* ── Derived stats ── */
  const plazasLibres = parqueaderos.filter(p => p.estado === 'DISPONIBLE').length;
  const alertas = parqueaderos.filter(p =>
    p.estado === 'OCUPADO' && p.categoria === 'VISITANTE' && p.horaEntrada && p.tiempoMaximoHoras &&
    (Date.now() - new Date(p.horaEntrada).getTime()) / 3600000 > p.tiempoMaximoHoras
  ).length;

  const stats = {
    entradasHoy: statsHist.entradasHoy || 0,
    salidasHoy: statsHist.salidasHoy || 0,
    visitantesDentro: visitantes.filter(v => v.estado === 'ingresado').length,
    visitantesPendientes: visitantes.filter(v => v.estado === 'pendiente').length,
    plazasLibres,
    plazasTotal: parqueaderos.length,
    placasLeidas: historial.filter(h => h.metodo === 'LPR_CAMERA').length,
    alertas,
  };

  /* ── Mutations ── */
  const handleRegistrarIngreso = (visitante) => {
    openConfirm(
      'Registrar ingreso',
      `¿Confirmas el ingreso de ${visitante.nombre} ${visitante.apellido}?`,
      async () => {
        closeConfirm();
        try {
          await api.post(`/visitantes/${visitante._id || visitante.id}/registrar-ingreso`);
          showToast(`Ingreso de ${visitante.nombre} registrado`, 'success');
          queryClient.invalidateQueries({ queryKey: ['porteriaVisitantes'] });
          queryClient.invalidateQueries({ queryKey: ['porteriaHistorial'] });
          queryClient.invalidateQueries({ queryKey: ['porteriaStatsHist'] });
        } catch (e) {
          showToast('Error: ' + (e.response?.data?.error || e.message), 'error');
        }
      },
      'info'
    );
  };

  const handleRegistrarSalida = (visitante) => {
    openConfirm(
      'Registrar salida',
      `¿Confirmas la salida de ${visitante.nombre} ${visitante.apellido}?`,
      async () => {
        closeConfirm();
        try {
          await api.post(`/visitantes/${visitante._id || visitante.id}/registrar-salida`);
          showToast(`Salida de ${visitante.nombre} registrada`, 'success');
          queryClient.invalidateQueries({ queryKey: ['porteriaVisitantes'] });
          queryClient.invalidateQueries({ queryKey: ['porteriaHistorial'] });
          queryClient.invalidateQueries({ queryKey: ['porteriaStatsHist'] });
          queryClient.invalidateQueries({ queryKey: ['porteriaParqueaderos'] });
        } catch (e) {
          showToast('Error: ' + (e.response?.data?.error || e.message), 'error');
        }
      },
      'warning'
    );
  };

  /* ── Nav ── */
  const navItems = [
    { id: 'dashboard',    label: 'Panel Principal', icon: MonitorPlay },
    { id: 'visitantes',   label: 'Visitantes',      icon: UserCheck   },
    { id: 'parqueaderos', label: 'Parqueaderos',     icon: Car         },
  ];

  /* ── Dashboard view ── */
  const renderDashboard = () => {
    const statCards = [
      { title: 'Entradas Hoy',    value: stats.entradasHoy,          accentColor: '#10B981', icon: ArrowRightCircle, rotate: false },
      { title: 'Salidas Hoy',     value: stats.salidasHoy,           accentColor: '#EF4444', icon: ArrowRightCircle, rotate: true  },
      { title: 'Visit. Dentro',   value: stats.visitantesDentro,     accentColor: '#0EA5E9', icon: UserCheck,        rotate: false },
      { title: 'Pendientes',      value: stats.visitantesPendientes, accentColor: '#F59E0B', icon: Clock,            rotate: false },
      { title: 'Plazas Libres',   value: parkLoading ? '…' : `${stats.plazasLibres}/${stats.plazasTotal}`, accentColor: '#6366F1', icon: Car, rotate: false },
      { title: 'Alertas',         value: stats.alertas,              accentColor: stats.alertas > 0 ? '#EF4444' : '#94A3B8', icon: AlertTriangle, rotate: false },
    ];

    const visitantesPend   = visitantes.filter(v => v.estado === 'pendiente').slice(0, 5);
    const visitantesDentro = visitantes.filter(v => v.estado === 'ingresado').slice(0, 5);

    return (
      <div className="se-fade-in space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="se-card se-slide-up" style={{ borderRadius: 14, padding: '1.125rem', animationDelay: `${i * 0.06}s` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 10, background: `${s.accentColor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} style={{ color: s.accentColor, transform: s.rotate ? 'rotate(180deg)' : 'none' }} />
              </div>
              <p className="se-heading" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.625rem)', fontWeight: 800, color: 'var(--se-text-primary)', lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginTop: 4 }}>
                {s.title}
              </p>
            </div>
          ))}
        </div>

        {/* Vista 3D en vivo del conjunto */}
        <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
          <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box size={17} style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <h2 className="se-heading" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>
                  Simulación 3D del Conjunto
                </h2>
                <p style={{ fontSize: '0.7rem', color: 'var(--se-text-muted)', marginTop: 1 }}>
                  Visualización en vivo de accesos y plazas
                </p>
              </div>
            </div>
            <span className="se-badge se-badge-accent">
              <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--se-accent)', display: 'inline-block' }} />
              Tiempo real
            </span>
          </div>
          <div style={{ padding: '0.75rem' }}>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--se-text-muted)', fontSize: '0.85rem' }}>Cargando simulación 3D…</div>}>
              <Conjunto3D parqueaderos={parqueaderos} historial={historial} />
            </Suspense>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-5">

            <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--se-amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={17} style={{ color: 'var(--se-amber)' }} />
                  </div>
                  <h2 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>
                    Pendientes de ingreso
                  </h2>
                </div>
                <span className="se-badge se-badge-amber">{stats.visitantesPendientes} en total</span>
              </div>
              <div style={{ padding: '1rem' }}>
                {visitantesLoading ? (
                  <SkeletonRows count={2} />
                ) : visitantesPend.length === 0 ? (
                  <EmptyState icon={UserCheck} text="No hay visitantes pendientes" subtext="Aparecerán aquí cuando un residente registre a un visitante" />
                ) : (
                  <div className="space-y-2">
                    {visitantesPend.map((v, i) => (
                      <VisitanteRow
                        key={i} v={v}
                        accentColor="var(--se-amber)" accentBg="var(--se-amber-dim)"
                        action={<button onClick={() => handleRegistrarIngreso(v)} style={actionBtnStyle('#10B981')}>
                          <ArrowRightCircle size={13} /> Entrar
                        </button>}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--se-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCheck size={17} style={{ color: 'var(--se-accent)' }} />
                  </div>
                  <h2 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>
                    Visitantes dentro
                  </h2>
                </div>
                <span className="se-badge se-badge-accent">{stats.visitantesDentro} activos</span>
              </div>
              <div style={{ padding: '1rem' }}>
                {visitantesLoading ? (
                  <SkeletonRows count={2} />
                ) : visitantesDentro.length === 0 ? (
                  <EmptyState icon={UserCheck} text="No hay visitantes dentro" subtext="Los visitantes que ingresen aparecerán aquí en tiempo real" />
                ) : (
                  <div className="space-y-2">
                    {visitantesDentro.map((v, i) => (
                      <VisitanteRow
                        key={i} v={v}
                        accentColor="var(--se-accent)" accentBg="var(--se-accent-dim)"
                        action={<button onClick={() => handleRegistrarSalida(v)} style={actionBtnStyle('#EF4444')}>
                          <ArrowRightCircle size={13} style={{ transform: 'rotate(180deg)' }} /> Salir
                        </button>}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowRightCircle size={17} style={{ color: '#6366F1' }} />
              </div>
              <h2 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>
                Últimos accesos
              </h2>
            </div>
            <div className="se-scroll" style={{ padding: '1rem', maxHeight: 540, overflowY: 'auto' }}>
              {historial.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem 0', fontSize: '0.8rem', color: 'var(--se-text-muted)' }}>Sin registros</p>
              ) : historial.slice(0, 8).map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: item.tipoAcceso === 'entrada' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                    color: item.tipoAcceso === 'entrada' ? '#10B981' : '#EF4444',
                  }}>
                    <ArrowRightCircle size={14} style={item.tipoAcceso === 'salida' ? { transform: 'rotate(180deg)' } : {}} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                      <p style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--se-text-primary)', textTransform: 'capitalize' }}>
                        {item.tipoAcceso} · {item.tipoUsuario}
                      </p>
                      <span style={{ fontSize: '0.65rem', color: 'var(--se-text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                        {new Date(item.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--se-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.nombreUsuario || '—'}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--se-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                      {item.placa || '—'} {item.plaza ? `· ${item.plaza}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Visitantes view ── */
  const renderVisitantes = () => {
    const estadoBadge = (estado) => {
      const map = {
        pendiente: { bg: 'var(--se-amber-dim)',   color: '#B45309' },
        ingresado: { bg: 'rgba(16,185,129,0.10)', color: '#065F46' },
        salido:    { bg: '#F1F5F9',               color: 'var(--se-text-secondary)' },
      };
      return map[estado] || { bg: '#F1F5F9', color: 'var(--se-text-secondary)' };
    };

    const visitantesFiltrados = visitantes
      .filter(v => filtroEstado === 'todos' || v.estado === filtroEstado)
      .filter(v => {
        if (!busquedaVisitantes.trim()) return true;
        const q = busquedaVisitantes.toLowerCase();
        return (
          `${v.nombre} ${v.apellido}`.toLowerCase().includes(q) ||
          v.cedula?.toLowerCase().includes(q) ||
          v.placaVehiculo?.toLowerCase().includes(q)
        );
      });

    return (
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #F59E0B, #0EA5E9)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Listado de Visitantes
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)', marginTop: 2 }}>
              {visitantesFiltrados.length} de {visitantes.length} registrados
            </p>
          </div>
          <span className="se-badge se-badge-accent">
            <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--se-accent)', display: 'inline-block' }} />
            Actualización automática
          </span>
        </div>

        {/* Barra de búsqueda y filtros */}
        <div style={{ padding: '0 1rem 1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o placa..."
            value={busquedaVisitantes}
            onChange={e => setBusquedaVisitantes(e.target.value)}
            className="se-input"
            style={{ flex: 1, minWidth: 200, fontSize: '0.82rem' }}
          />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="se-input"
            style={{ width: 'auto', fontSize: '0.82rem', cursor: 'pointer' }}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="ingresado">Ingresado</option>
            <option value="salido">Salido</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full se-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Nombre</th>
                <th className="hidden sm:table-cell" style={{ textAlign: 'left' }}>Cédula</th>
                <th style={{ textAlign: 'left' }}>Placa</th>
                <th className="hidden md:table-cell" style={{ textAlign: 'left' }}>Destino</th>
                <th style={{ textAlign: 'left' }}>Estado</th>
                <th style={{ textAlign: 'left' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visitantesFiltrados.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
                  {busquedaVisitantes || filtroEstado !== 'todos' ? 'No se encontraron visitantes con ese criterio' : 'No hay visitantes registrados'}
                </td></tr>
              ) : visitantesFiltrados.map((v, i) => {
                const badge = estadoBadge(v.estado);
                return (
                  <tr key={v._id || i}>
                    <td style={{ fontWeight: 600, color: 'var(--se-text-primary)' }}>{v.nombre} {v.apellido}</td>
                    <td className="hidden sm:table-cell" style={{ color: 'var(--se-text-secondary)' }}>{v.cedula}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: 'var(--se-text-primary)', background: 'var(--se-bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--se-border)' }}>
                        {v.placaVehiculo || 'N/A'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell" style={{ color: 'var(--se-text-muted)', fontSize: '0.8rem' }}>
                      {v.torreDestino ? `T${v.torreDestino} ` : ''}{v.apartamentoDestino ? `· Apto ${v.apartamentoDestino}` : '—'}
                    </td>
                    <td>
                      <span className="se-badge" style={{ background: badge.bg, color: badge.color }}>
                        {v.estado || 'desconocido'}
                      </span>
                    </td>
                    <td>
                      {v.estado === 'pendiente' && (
                        <button onClick={() => handleRegistrarIngreso(v)} style={actionBtnStyle('#10B981')}>
                          <ArrowRightCircle size={13} /> Entrar
                        </button>
                      )}
                      {v.estado === 'ingresado' && (
                        <button onClick={() => handleRegistrarSalida(v)} style={actionBtnStyle('#EF4444')}>
                          <ArrowRightCircle size={13} style={{ transform: 'rotate(180deg)' }} /> Salir
                        </button>
                      )}
                      {v.estado === 'salido' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)', fontStyle: 'italic' }}>Finalizada</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ── Parqueaderos view ── */
  const renderParqueaderos = () => {
    const filtrados = parqueaderos.filter(p => tipoTab === 'residentes' ? p.categoria === 'PRIVADO' : p.categoria === 'VISITANTE');
    const carros = filtrados.filter(p => p.tipoVehiculo === 'CARRO');
    const motos  = filtrados.filter(p => p.tipoVehiculo === 'MOTO');

    const colorMap = {
      blue:    { border: '#93C5FD', bg: '#EFF6FF', text: '#1D4ED8', textOcc: '#EF4444' },
      purple:  { border: '#C4B5FD', bg: '#F5F3FF', text: '#7C3AED', textOcc: '#EF4444' },
      emerald: { border: '#6EE7B7', bg: '#ECFDF5', text: '#065F46', textOcc: '#EF4444' },
      amber:   { border: '#FCD34D', bg: '#FFFBEB', text: '#92400E', textOcc: '#EF4444' },
    };

    const renderGrid = (lista, colorKey) => {
      const c = colorMap[colorKey] || colorMap.blue;
      if (lista.length === 0) return <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', fontStyle: 'italic' }}>Sin parqueaderos</p>;
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {lista.sort((a, b) => (a.numero || '').localeCompare(b.numero || '')).map((p, i) => {
            const disponible = p.estado === 'DISPONIBLE';
            return (
              <div key={i} style={{
                borderRadius: 12, padding: '0.625rem', textAlign: 'center',
                border: `2px solid ${disponible ? c.border : '#FCA5A5'}`,
                background: disponible ? c.bg : '#FFF1F2',
                transition: 'transform 0.15s', cursor: 'default',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>{p.numero}</p>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: disponible ? c.text : c.textOcc, marginTop: 2 }}>
                  {disponible ? 'Libre' : 'Ocupado'}
                </p>
                {p.placaVehiculo && !disponible && (
                  <p style={{ fontSize: '0.58rem', fontFamily: 'monospace', color: 'var(--se-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.placaVehiculo}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #6366F1, #0EA5E9)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={18} style={{ color: '#6366F1' }} />
            </div>
            <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Estado de Parqueaderos
            </h2>
          </div>
          <span className="se-badge se-badge-accent">
            {parqueaderos.filter(p => p.estado === 'DISPONIBLE').length}/{parqueaderos.length} libres
          </span>
        </div>

        <div style={{ padding: '1rem 1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {[
              { id: 'residentes', label: 'Residentes', color: '#0EA5E9' },
              { id: 'visitantes', label: 'Visitantes',  color: '#F59E0B' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTipoTab(t.id)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: 10,
                  fontSize: '0.82rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  ...(tipoTab === t.id
                    ? { background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, boxShadow: `0 2px 8px ${t.color}20` }
                    : { background: 'var(--se-bg)', color: 'var(--se-text-secondary)', border: '1px solid var(--se-border)' })
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)', marginBottom: 10 }}>
                Carros <span style={{ fontWeight: 400, color: 'var(--se-text-muted)' }}>({carros.length})</span>
              </p>
              {renderGrid(carros, tipoTab === 'residentes' ? 'blue' : 'emerald')}
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)', marginBottom: 10 }}>
                Motos <span style={{ fontWeight: 400, color: 'var(--se-text-muted)' }}>({motos.length})</span>
              </p>
              {renderGrid(motos, tipoTab === 'residentes' ? 'purple' : 'amber')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Shared sidebar content ── */
  const renderSidebarContent = (onNavClick, collapsed = false) => (
    <>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 32px)',
        pointerEvents: 'none',
      }} />

      {/* Logo area */}
      <div style={{ padding: 0, borderBottom: '1px solid var(--se-panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img
          src="/safeentry-logo.png"
          alt="SafeEntry"
          style={{ width: '100%', height: collapsed ? 44 : 90, objectFit: collapsed ? 'contain' : 'cover', objectPosition: 'center' }}
        />
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: collapsed ? '1rem 0' : '1rem 0.75rem', position: 'relative' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id); onNavClick(); }}
            title={collapsed ? item.label : undefined}
            className={`se-nav-item ${view === item.id ? 'active' : ''}`}
            style={{
              marginBottom: 4,
              position: 'relative',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '0.625rem 0' : undefined,
            }}
          >
            {view === item.id && (
              <div style={{ position: 'absolute', left: 0, width: 3, height: 24, background: 'var(--se-accent)', borderRadius: '0 4px 4px 0' }} />
            )}
            <item.icon size={19} className="se-nav-icon" style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User card */}
      <div style={{ padding: collapsed ? '1rem 0' : '1rem', position: 'relative' }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 800, color: '#fff',
            }}>
              {user?.nombre?.charAt(0) || 'P'}
            </div>
          </div>
        ) : (
          <div className="se-user-card">
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color: '#fff',
              boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
            }}>
              {user?.nombre?.charAt(0) || 'P'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.nombre || 'Portero'}
              </p>
              <p style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'capitalize' }}>
                {user?.rol || 'porteria'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /* ── Main layout ── */
  const desktopWidth = sidebarCollapsed ? 64 : 250;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--se-bg)' }}>

      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        style={{
          width: desktopWidth,
          flexShrink: 0,
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 20,
          background: 'var(--se-panel-bg)',
          borderRight: '1px solid var(--se-panel-border)',
          overflow: 'visible',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Inner clip container */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderSidebarContent(() => {}, sidebarCollapsed)}
        </div>

        {/* Desktop toggle button — appears on hover */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            position: 'absolute', right: -13, top: 72, zIndex: 30,
            width: 26, height: 26,
            background: '#1E293B',
            border: '1px solid rgba(14,165,233,0.3)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            color: 'var(--se-accent)',
            opacity: sidebarHovered ? 1 : 0,
            transform: sidebarHovered ? 'scale(1)' : 'scale(0.8)',
            transition: 'opacity 0.2s ease, transform 0.2s ease, box-shadow 0.15s',
            pointerEvents: sidebarHovered ? 'auto' : 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.2), 0 4px 12px rgba(0,0,0,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; }}
        >
          {sidebarCollapsed ? <ChevronRight size={13} strokeWidth={2.5} /> : <ChevronLeft size={13} strokeWidth={2.5} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(8,13,20,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer — always expanded */}
      <aside
        className="md:hidden flex flex-col"
        style={{
          width: 250, flexShrink: 0,
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50,
          background: 'var(--se-panel-bg)',
          borderRight: '1px solid var(--se-panel-border)',
          overflow: 'hidden',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {renderSidebarContent(() => setSidebarOpen(false), false)}
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1, minWidth: 0,
          marginLeft: isDesktop ? desktopWidth : 0,
          transition: 'margin-left 0.3s ease-in-out',
        }}
        className="p-4 md:p-8"
      >

        <header className="se-card" style={{ borderRadius: 14, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
                style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--se-bg)', border: '1px solid var(--se-border)', color: 'var(--se-text-secondary)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <Menu size={18} />
              </button>
              <div>
                <h1 className="se-heading" style={{ fontSize: 'clamp(0.9rem, 4vw, 1.2rem)', fontWeight: 800, color: 'var(--se-text-primary)' }}>
                  <span className="hidden sm:inline">Bienvenido, </span>{user?.nombre || 'Portero'}
                </h1>
                <p className="hidden sm:block" style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)' }}>
                  Turno Actual · SafeEntry System
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="se-badge" style={{ background: 'rgba(16,185,129,0.10)', color: '#065F46', border: '1px solid rgba(16,185,129,0.2)' }}>
                <ShieldCheck size={13} /> <span className="hidden sm:inline">Sistema </span>Activo
              </span>
              <span className="se-badge se-badge-accent">
                <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--se-accent)', display: 'inline-block' }} />
                En turno
              </span>
            </div>
          </div>
        </header>

        {(visitantesError || parqueaderosError) && (
          <div style={{ background: 'var(--se-error-dim)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--se-error)', fontWeight: 600 }}>
            <span>⚠️</span> Error de conexión con el servidor. Los datos mostrados pueden no estar actualizados.
          </div>
        )}

        <div key={view} className="se-fade-in">
          {view === 'dashboard'    && renderDashboard()}
          {view === 'visitantes'   && renderVisitantes()}
          {view === 'parqueaderos' && renderParqueaderos()}
        </div>
      </main>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={closeConfirm}
      />

      <ToastContainer />
    </div>
  );
}

/* ── Helpers ── */

function VisitanteRow({ v, accentColor, accentBg, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.5rem 0.75rem', borderRadius: 10, background: accentBg, border: `1px solid ${accentColor}30`, flexWrap: 'nowrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${accentColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 800, color: accentColor }}>
          {(v.nombre || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--se-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.nombre} {v.apellido}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--se-text-muted)' }}>
            Apto {v.apartamentoDestino || '—'}{v.torreDestino ? ` · Torre ${v.torreDestino}` : ''}
            {v.motivoVisita ? ` · ${v.motivoVisita}` : ''}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'nowrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--se-text-primary)', background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--se-border)' }}>
          {v.placaVehiculo || 'sin placa'}
        </span>
        {action}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text, subtext }) {
  return (
    <div style={{ borderRadius: 12, padding: '2rem 1rem', textAlign: 'center', border: '2px dashed var(--se-border)', background: 'var(--se-bg)' }}>
      <Icon size={28} style={{ color: 'var(--se-border)', margin: '0 auto 8px' }} />
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--se-text-muted)' }}>{text}</p>
      {subtext && <p style={{ fontSize: '0.72rem', color: 'var(--se-text-muted)', marginTop: 4, opacity: 0.7 }}>{subtext}</p>}
    </div>
  );
}

function SkeletonRows({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', borderRadius: 10, background: 'var(--se-bg)', border: '1px solid var(--se-border)' }}>
          <div className="se-skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="se-skeleton" style={{ height: 12, width: '60%', borderRadius: 6 }} />
            <div className="se-skeleton" style={{ height: 10, width: '40%', borderRadius: 6 }} />
          </div>
          <div className="se-skeleton" style={{ height: 28, width: 64, borderRadius: 8, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

const actionBtnStyle = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '0.3rem 0.6rem', borderRadius: 8,
  fontSize: '0.72rem', fontWeight: 700,
  background: `${color}18`, color,
  border: `1px solid ${color}35`,
  cursor: 'pointer', transition: 'all 0.15s',
});
