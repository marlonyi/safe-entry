import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, MonitorPlay, Car, AlertTriangle, ArrowRightCircle, Clock, QrCode, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Logo from '../components/Logo';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

export default function PorteroDashboard({ user }) {
  const { showToast, ToastContainer } = useToast();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'warning' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState('dashboard');
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
  const { data: visitantes = [] } = useQuery({
    queryKey: ['porteriaVisitantes'],
    queryFn: async () => unwrap(await api.get('/visitantes').catch(() => ({ data: [] }))),
    refetchInterval: () => (!document.hidden ? 3000 : false),
    staleTime: 0,
  });

  // Historial reciente: refetch every 3 s together with visitantes
  const { data: historial = [] } = useQuery({
    queryKey: ['porteriaHistorial'],
    queryFn: async () => unwrap(await api.get('/parqueaderos/historial?limit=20&page=1').catch(() => ({ data: [] }))),
    refetchInterval: () => (!document.hidden ? 3000 : false),
    staleTime: 0,
  });

  // Stats from historial endpoint: refetch every 3 s
  const { data: statsHist = {} } = useQuery({
    queryKey: ['porteriaStatsHist'],
    queryFn: async () => {
      const res = await api.get('/parqueaderos/historial/estadisticas').catch(() => ({ data: {} }));
      return res.data || {};
    },
    refetchInterval: () => (!document.hidden ? 3000 : false),
    staleTime: 0,
  });

  // Parqueaderos: low-frequency, 5 min stale — no need for 3 s polling
  const { data: parqueaderos = [], isFetching: parkLoading } = useQuery({
    queryKey: ['porteriaParqueaderos'],
    queryFn: async () => unwrap(await api.get('/parqueaderos').catch(() => ({ data: [] }))),
    staleTime: 300_000,
    refetchInterval: 60_000,
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
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
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
                {visitantesPend.length === 0 ? (
                  <EmptyState icon={UserCheck} text="No hay visitantes pendientes" />
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
                {visitantesDentro.length === 0 ? (
                  <EmptyState icon={UserCheck} text="No hay visitantes dentro" />
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

    return (
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #F59E0B, #0EA5E9)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Listado de Visitantes
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)', marginTop: 2 }}>
              {visitantes.length} registrados
            </p>
          </div>
          <span className="se-badge se-badge-accent">
            <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--se-accent)', display: 'inline-block' }} />
            Actualización automática
          </span>
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
              {visitantes.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>No hay visitantes</td></tr>
              ) : visitantes.map((v, i) => {
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
      <div style={{ padding: collapsed ? '1.25rem 0' : '1.5rem', borderBottom: '1px solid var(--se-panel-border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        {collapsed ? (
          <MonitorPlay size={22} style={{ color: 'var(--se-accent)' }} />
        ) : (
          <Logo theme="dark" subtitle="Portería · Control de Acceso" />
        )}
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

      {/* Live update indicator */}
      <div style={{ padding: collapsed ? '0.625rem 0' : '0.625rem 1rem', borderTop: '1px solid var(--se-panel-border)', borderBottom: '1px solid var(--se-panel-border)' }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span className="se-pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'block' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.75rem', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Actualización cada 3s</span>
          </div>
        )}
      </div>

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
        style={{
          width: desktopWidth,
          flexShrink: 0,
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 20,
          background: 'var(--se-panel-bg)',
          borderRight: '1px solid var(--se-panel-border)',
          overflow: 'hidden',
          transition: 'width 0.3s ease-in-out',
        }}
      >
        {/* Desktop toggle button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            position: 'absolute', right: -12, top: 72, zIndex: 30,
            width: 24, height: 24,
            background: 'var(--se-panel-bg)',
            border: '1px solid var(--se-panel-border)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'box-shadow 0.15s',
            color: 'var(--se-text-secondary)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'}
        >
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {renderSidebarContent(() => {}, sidebarCollapsed)}
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
                style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--se-bg)', border: '1px solid var(--se-border)', color: 'var(--se-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
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

        {view === 'dashboard'    && renderDashboard()}
        {view === 'visitantes'   && renderVisitantes()}
        {view === 'parqueaderos' && renderParqueaderos()}
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

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ borderRadius: 12, padding: '2rem 1rem', textAlign: 'center', border: '2px dashed var(--se-border)', background: 'var(--se-bg)' }}>
      <Icon size={28} style={{ color: 'var(--se-border)', margin: '0 auto 8px' }} />
      <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)' }}>{text}</p>
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
