import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Home, Users, Car, KeyRound, Plus, Shield, X, Clock, ArrowRightCircle, UserCheck, Activity, MapPin, Menu, ChevronLeft, ChevronRight, CheckCircle2, Copy, Check } from 'lucide-react';
import api from '../services/api';
import Logo from '../components/Logo';
import { useToast } from '../components/ui/Toast';

export default function ResidenteDashboard({ user }) {
  const { showToast, ToastContainer } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [view, setView] = useState('home');

  /* Track desktop breakpoint for sidebar offset */
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
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

  const [nuevoVisitante, setNuevoVisitante] = useState({ nombre: '', apellido: '', cedula: '', placaVehiculo: '' });
  const [placaVehiculo, setPlacaVehiculo] = useState(user?.placa || '');
  const [placa2Vehiculo, setPlaca2Vehiculo] = useState('');
  const [tieneVehiculo, setTieneVehiculo] = useState(!!user?.placa);
  const [vehiculoLoading, setVehiculoLoading] = useState(false);
  const [vehiculoSuccess, setVehiculoSuccess] = useState('');
  const [vehiculoError, setVehiculoError] = useState('');
  const [showCodigoModal, setShowCodigoModal] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState(null);
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [codigoDinamico, setCodigoDinamico] = useState(null);
  const [visitanteCreado, setVisitanteCreado] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const fetchVisitantes = async () => {
    try {
      setLoading(true);
      const resp = await api.get(`/visitantes/misVisitantes/${user.id}`);
      setVisitantes(unwrap(resp));
    } catch (error) {
      showToast('No se pudieron cargar los visitantes. Intenta de nuevo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHomeData = async () => {
    try {
      const perfilResp = await api.get(`/usuarios/perfil/${user.id}`).catch(() => ({ data: null }));
      const perfilData = perfilResp.data || null;
      setPerfil(perfilData);
      const visResp = await api.get(`/visitantes/misVisitantes/${user.id}`).catch(() => ({ data: [] }));
      setVisitantes(unwrap(visResp));
      const placa = perfilData?.placaVehiculo || user?.placa;
      if (placa) {
        const accResp = await api.get(`/parqueaderos/historial?placa=${placa}&limit=10`).catch(() => ({ data: { items: [] } }));
        setMisAccesos(unwrap(accResp));
      } else {
        setMisAccesos([]);
      }
      const parqAsignadoId = perfilData?.parqueaderoAsignado;
      if (parqAsignadoId) {
        const parqResp = await api.get('/parqueaderos').catch(() => ({ data: [] }));
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
    setLoading(true);
    try {
      const resp = await api.post('/visitantes', {
        nombreVisitante: nuevoVisitante.nombre,
        apellidoVisitante: nuevoVisitante.apellido,
        cedulaVisitante: nuevoVisitante.cedula,
        placaVisitante: nuevoVisitante.placaVehiculo || null,
        residenteId: user.id
      });
      const creado = resp.data?.visitante || resp.data;
      setVisitanteCreado(creado);
      setNuevoVisitante({ nombre: '', apellido: '', cedula: '', placaVehiculo: '' });
      fetchVisitantes();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Error al registrar visitante');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
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
      const r = await api.get(`/usuarios/perfil/${user.id}`).catch(() => ({ data: null }));
      if (r.data) setPerfil(r.data);
    } catch (err) {
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
      const resp = await api.get(`/visitantes/${visitante._id || visitante.id}/codigo-actual`);
      setCodigoDinamico(resp.data);
    } catch (error) {
      showToast('Error al obtener código de acceso: ' + (error.response?.data?.error || error.message), 'error');
      setShowCodigoModal(false);
    } finally {
      setLoadingCodigo(false);
    }
  };

  /* ── Sidebar menu items ── */
  const navItems = [
    { id: 'home',      label: 'Mi Hogar',      icon: Home },
    { id: 'visitantes',label: 'Mis Visitantes', icon: Users },
    { id: 'vehiculo',  label: 'Mi Vehículo',    icon: Car },
  ];

  /* ── RENDER HOME ── */
  const renderHome = () => {
    const visTotal  = visitantes.length;
    const visPend   = visitantes.filter(v => v.estado === 'pendiente').length;
    const visDentro = visitantes.filter(v => v.estado === 'ingresado').length;
    const inicioSemana = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const accesosSemana = misAccesos.filter(a => new Date(a.fechaHora).getTime() >= inicioSemana).length;

    const tieneVehiculoData  = perfil?.tieneVehiculo ?? user?.tieneVehiculo ?? false;
    const placaPrincipal     = perfil?.placaVehiculo || user?.placa || null;
    const placaSecundaria    = perfil?.placa2Vehiculo || null;

    const cards = [
      { title: 'Mis Visitantes', value: visTotal,       icon: Users,     accentColor: '#10B981' },
      { title: 'Pendientes',     value: visPend,        icon: Clock,     accentColor: '#F59E0B' },
      { title: 'Dentro Ahora',   value: visDentro,      icon: UserCheck, accentColor: '#0EA5E9' },
      { title: 'Accesos 7d',     value: accesosSemana,  icon: Activity,  accentColor: '#6366F1' },
    ];

    return (
      <div className="space-y-6 se-fade-in">

        {/* CTA Banner */}
        <div style={{
          borderRadius: 18,
          background: 'var(--se-panel-bg)',
          border: '1px solid var(--se-panel-border)',
          padding: 'clamp(1rem, 4vw, 1.75rem)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Scan line */}
          <div className="se-scanline" style={{
            position: 'absolute', left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--se-accent), transparent)',
            opacity: 0.3,
          }} />
          {/* Shield watermark */}
          <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.05, pointerEvents: 'none' }}>
            <Shield size={160} color="#fff" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 className="se-heading" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.375rem)', fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>
              Nuevo Visitante
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.25rem', maxWidth: 400 }}>
              Genera un código de acceso para que tu invitado entre sin demoras en portería.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => setView('crear')} className="se-btn-primary" style={{ borderRadius: 12 }}>
                <KeyRound size={16} /> Registrar Visitante
              </button>
              <button onClick={() => setView('visitantes')} className="se-btn-ghost"
                style={{ borderRadius: 12, borderColor: 'rgba(255,255,255,0.15)', color: '#94A3B8' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--se-accent)'; e.currentTarget.style.color = 'var(--se-accent)'; e.currentTarget.style.background = 'var(--se-accent-dim)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Users size={16} /> Ver Mis Visitantes
              </button>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {cards.map((c, i) => (
            <div key={i} className="se-card se-slide-up" style={{ borderRadius: 14, padding: '1.25rem', animationDelay: `${i * 0.07}s` }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `${c.accentColor}1a`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10,
              }}>
                <c.icon size={20} style={{ color: c.accentColor }} />
              </div>
              <p className="se-heading" style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 800, color: 'var(--se-text-primary)', lineHeight: 1 }}>
                {c.value}
              </p>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginTop: 4 }}>
                {c.title}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Mi vehículo / parqueadero */}
          <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Car size={17} style={{ color: '#10B981' }} />
              </div>
              <h3 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>
                Mi Vehículo
              </h3>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {tieneVehiculoData && placaPrincipal ? (
                <>
                  <div style={{ background: 'var(--se-bg)', borderRadius: 12, padding: '0.875rem 1rem', border: '1px solid var(--se-border)', marginBottom: 10 }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 4 }}>Placa Principal</p>
                    <p className="se-heading" style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--se-text-primary)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                      {placaPrincipal}
                    </p>
                  </div>
                  {placaSecundaria && (
                    <div style={{ background: 'var(--se-bg)', borderRadius: 12, padding: '0.875rem 1rem', border: '1px solid var(--se-border)', marginBottom: 10 }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 4 }}>Placa Adicional</p>
                      <p className="se-heading" style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--se-text-secondary)', fontFamily: 'monospace' }}>
                        {placaSecundaria}
                      </p>
                    </div>
                  )}
                  {parqueaderoInfo && (
                    <div style={{
                      background: 'rgba(16,185,129,0.08)',
                      borderRadius: 12, padding: '0.75rem 1rem',
                      border: '1px solid rgba(16,185,129,0.2)',
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                    }}>
                      <MapPin size={17} style={{ color: '#10B981' }} />
                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10B981' }}>Parqueadero Asignado</p>
                        <p className="se-heading" style={{ fontSize: 'clamp(0.9rem, 4vw, 1.1rem)', fontWeight: 800, color: 'var(--se-text-primary)' }}>{parqueaderoInfo.numero}</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setView('vehiculo')}
                    style={{
                      width: '100%', padding: '0.625rem', borderRadius: 10,
                      fontSize: '0.8rem', fontWeight: 600,
                      color: '#10B981', background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    Editar información
                  </button>
                </>
              ) : (
                <div style={{
                  borderRadius: 12, padding: '2rem 1rem',
                  textAlign: 'center',
                  border: '2px dashed var(--se-border)',
                  background: 'var(--se-bg)',
                }}>
                  <Car size={32} style={{ color: 'var(--se-border)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', marginBottom: 10 }}>No tienes vehículo registrado</p>
                  <button onClick={() => setView('vehiculo')} className="se-btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', borderRadius: 8 }}>
                    Registrar vehículo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mis accesos recientes */}
          <div className="se-card lg:col-span-2" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={17} style={{ color: '#6366F1' }} />
              </div>
              <h3 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>
                Mis Accesos Recientes
                {placaPrincipal && (
                  <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 400, color: 'var(--se-text-muted)' }}>
                    · {placaPrincipal}
                  </span>
                )}
              </h3>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              {!placaPrincipal ? (
                <EmptyState icon={Activity} text="Registra tu vehículo para ver tus accesos" />
              ) : misAccesos.length === 0 ? (
                <EmptyState icon={Activity} text="Sin registros de acceso aún" />
              ) : (
                <div className="se-scroll space-y-2" style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                  {misAccesos.slice(0, 10).map((a, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '0.625rem 0.75rem',
                      borderRadius: 10,
                      background: 'var(--se-bg)',
                      border: '1px solid var(--se-border)',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: a.tipoAcceso === 'entrada' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                        color: a.tipoAcceso === 'entrada' ? '#10B981' : '#EF4444',
                      }}>
                        <ArrowRightCircle size={15} style={a.tipoAcceso === 'salida' ? { transform: 'rotate(180deg)' } : {}} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--se-text-primary)', textTransform: 'capitalize' }}>{a.tipoAcceso}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--se-text-muted)' }}>{a.placa}{a.plaza ? ` · Plaza ${a.plaza}` : ''}</p>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--se-text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                        {new Date(a.fechaHora).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── RENDER VISITANTES ── */
  const renderVisitantes = () => {
    const estadoBadge = (estado) => {
      const map = {
        pendiente: { bg: 'var(--se-amber-dim)',   color: '#B45309',         label: 'Pendiente' },
        ingresado: { bg: 'rgba(16,185,129,0.10)', color: '#065F46',         label: 'Ingresado' },
        salido:    { bg: '#F1F5F9',               color: 'var(--se-text-secondary)', label: 'Salido' },
      };
      return map[estado] || { bg: '#F1F5F9', color: 'var(--se-text-secondary)', label: estado || 'pendiente' };
    };

    return (
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />

        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2 className="se-heading" style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Mis Visitantes / Autorizaciones
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)', marginTop: 2 }}>
              {visitantes.length} registrados en total
            </p>
          </div>
          <button onClick={() => setView('crear')} className="se-btn-primary" style={{ borderRadius: 10 }}>
            <Plus size={16} /> Nuevo Visitante
          </button>
        </div>

        <div style={{ padding: '0 0 0.5rem' }}>
          {loading ? (
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem', borderRadius: 10, border: '1px solid var(--se-border)', background: 'var(--se-bg)' }}>
                  <div className="se-skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div className="se-skeleton" style={{ height: 12, width: `${55 + i * 10}%`, borderRadius: 6 }} />
                    <div className="se-skeleton" style={{ height: 10, width: `${35 + i * 5}%`, borderRadius: 6 }} />
                  </div>
                  <div className="se-skeleton" style={{ height: 26, width: 72, borderRadius: 8, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full se-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Nombre</th>
                    <th className="hidden sm:table-cell" style={{ textAlign: 'left' }}>Cédula</th>
                    <th style={{ textAlign: 'left' }}>Placa</th>
                    <th className="hidden md:table-cell" style={{ textAlign: 'left' }}>Motivo</th>
                    <th style={{ textAlign: 'left' }}>Estado</th>
                    <th style={{ textAlign: 'left' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visitantes.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '0' }}>
                        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', borderTop: '1px solid var(--se-border)' }}>
                          <UserCheck size={32} style={{ color: 'var(--se-border)', margin: '0 auto 10px' }} />
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--se-text-muted)', marginBottom: 6 }}>
                            Aún no tienes visitantes registrados
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)', marginBottom: '1rem', opacity: 0.75 }}>
                            Registra a un visitante para generarle un código QR de acceso
                          </p>
                          <button onClick={() => setView('crear')} className="se-btn-primary" style={{ borderRadius: 10, padding: '0.5rem 1.25rem', fontSize: '0.82rem' }}>
                            <Plus size={15} /> Registrar Visitante
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : visitantes.map((v, i) => {
                    const badge = estadoBadge(v.estado);
                    return (
                      <tr key={v._id || i}>
                        <td style={{ fontWeight: 600, color: 'var(--se-text-primary)' }}>
                          {v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}
                        </td>
                        <td className="hidden sm:table-cell" style={{ color: 'var(--se-text-secondary)' }}>{v.cedulaVisitante || v.cedula}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: 'var(--se-text-primary)', background: 'var(--se-bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--se-border)' }}>
                            {v.placaVisitante || v.placaVehiculo || '—'}
                          </span>
                        </td>
                        <td className="hidden md:table-cell" style={{ color: 'var(--se-text-muted)', fontSize: '0.8rem' }}>{v.motivoVisita || '—'}</td>
                        <td>
                          <span className="se-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleVerCodigo(v)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '0.4rem 0.75rem', borderRadius: 8,
                              fontSize: '0.75rem', fontWeight: 700,
                              background: 'var(--se-accent-dim)', color: 'var(--se-accent)',
                              border: '1px solid rgba(14,165,233,0.25)',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            <KeyRound size={13} /> Ver Código
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── RENDER CREAR ── */
  const renderCrear = () => (
    <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden', maxWidth: 560 }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #10B981)' }} />
      <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--se-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserCheck size={18} style={{ color: 'var(--se-accent)' }} />
        </div>
        <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
          Registrar Invitado
        </h2>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {errorMsg && (
          <div style={{ background: 'var(--se-error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.65rem 0.875rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--se-error)', fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '0.65rem 0.875rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#065F46', fontWeight: 600 }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleCrearVisitante} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)' }}>Nombre</label>
              <input required value={nuevoVisitante.nombre} onChange={e => setNuevoVisitante({...nuevoVisitante, nombre: e.target.value})} className="se-input" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)' }}>Apellido</label>
              <input required value={nuevoVisitante.apellido} onChange={e => setNuevoVisitante({...nuevoVisitante, apellido: e.target.value})} className="se-input" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)' }}>Cédula</label>
            <input required value={nuevoVisitante.cedula} onChange={e => setNuevoVisitante({...nuevoVisitante, cedula: e.target.value})} className="se-input" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)' }}>Placa Vehículo <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--se-text-muted)' }}>(Opcional)</span></label>
            <input value={nuevoVisitante.placaVehiculo} onChange={e => setNuevoVisitante({...nuevoVisitante, placaVehiculo: e.target.value})} className="se-input" placeholder="Ej. ABC-123" />
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
            <button type="button" onClick={() => setView('home')} className="se-btn-ghost" style={{ borderRadius: 12 }}>
              Cancelar
            </button>
            <button type="submit" className="se-btn-primary" style={{ flex: 1, borderRadius: 12, justifyContent: 'center' }}>
              Registrar y Generar QR
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  /* ── RENDER VEHÍCULO ── */
  const renderVehiculo = () => (
    <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden', maxWidth: 640 }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />
      <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Car size={20} style={{ color: '#10B981' }} />
        </div>
        <div>
          <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>Mi Vehículo</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)' }}>Gestiona la información de tus vehículos para el control de acceso.</p>
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {vehiculoError && (
          <div style={{ background: 'var(--se-error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--se-error)', fontWeight: 600 }}>
            {vehiculoError}
          </div>
        )}
        {vehiculoSuccess && (
          <div className="se-fade-in" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} className="se-check-pop" style={{ color: '#10B981', flexShrink: 0 }} />
            {vehiculoSuccess}
          </div>
        )}

        <form onSubmit={handleGuardarVehiculo} className="space-y-5">
          {/* Toggle */}
          <div style={{ paddingBottom: '1.25rem', borderBottom: '1px solid var(--se-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tieneVehiculo}
                onChange={(e) => setTieneVehiculo(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--se-accent)' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--se-text-primary)' }}>
                Tengo vehículo(s) propio(s)
              </span>
            </label>
          </div>

          {tieneVehiculo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 se-fade-in">
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)' }}>
                  Placa Principal
                </label>
                <input
                  type="text"
                  value={placaVehiculo}
                  onChange={(e) => setPlacaVehiculo(e.target.value)}
                  placeholder="Ej. ABC-123"
                  className="se-input"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 700 }}
                />
                <p style={{ marginTop: 5, fontSize: '0.7rem', color: 'var(--se-text-muted)' }}>Sin guiones ni espacios si prefieres</p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)' }}>
                  Placa Adicional
                  <span className="se-badge se-badge-muted ml-2" style={{ fontSize: '0.6rem' }}>Opcional</span>
                </label>
                <input
                  type="text"
                  value={placa2Vehiculo}
                  onChange={(e) => setPlaca2Vehiculo(e.target.value)}
                  placeholder="Ej. XYZ-987"
                  className="se-input"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 700 }}
                />
              </div>
            </div>
          )}

          <div style={{ paddingTop: 8 }}>
            <button
              type="submit"
              disabled={vehiculoLoading}
              className="se-btn-primary"
              style={{ borderRadius: 12, minWidth: 200 }}
            >
              {vehiculoLoading ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'se-arc-spin 0.8s linear infinite' }} />
                  Guardando...
                </>
              ) : 'Guardar Información'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  /* ── SHARED SIDEBAR CONTENT ── */
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
              <div style={{
                position: 'absolute', left: 0,
                width: 3, height: 28,
                background: 'var(--se-accent)',
                borderRadius: '0 4px 4px 0',
              }} />
            )}
            <item.icon size={19} className="se-nav-icon" style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User card */}
      <div style={{ padding: collapsed ? '1rem 0' : '1rem', borderTop: '1px solid var(--se-panel-border)', position: 'relative' }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #10B981, #0EA5E9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 800, color: '#fff',
            }}>
              {user?.nombre?.charAt(0) || 'R'}
            </div>
          </div>
        ) : (
          <div className="se-user-card">
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #10B981, #0EA5E9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color: '#fff',
              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
            }}>
              {user?.nombre?.charAt(0) || 'R'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.825rem', fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.nombre || 'Residente'}
              </p>
              <p style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'capitalize' }}>
                {user?.rol || 'residente'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /* ── MAIN LAYOUT ── */
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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden"
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(8,13,20,0.65)',
            backdropFilter: 'blur(4px)',
          }}
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

        {/* Header */}
        <header className="se-card" style={{
          borderRadius: 14, overflow: 'hidden',
          marginBottom: '1.25rem',
        }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Mobile hamburger */}
              <button
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--se-bg)', border: '1px solid var(--se-border)',
                  color: 'var(--se-text-secondary)',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Menu size={18} />
              </button>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nombre || 'User')}&background=10b981&color=fff&bold=true`}
                alt="Profile"
                className="hidden sm:block" style={{ width: 46, height: 46, borderRadius: '50%', border: '2px solid var(--se-border)' }}
              />
              <div>
                <h1 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
                  Hola, {perfil?.nombre || user?.nombre || 'Residente'} {perfil?.apellido || user?.apellido || ''}
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)' }}>
                  {perfil?.conjunto?.nombre ? `${perfil.conjunto.nombre} · ` : ''}
                  Torre {perfil?.torre || user?.torre || '—'} · Apto {perfil?.apartamento || user?.apartamento || '—'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {perfil?.estadoExpensa && (
                <span className="se-badge" style={
                  perfil.estadoExpensa === 'al dia'
                    ? { background: 'rgba(16,185,129,0.10)', color: '#065F46' }
                    : { background: 'var(--se-error-dim)', color: 'var(--se-error)' }
                }>
                  Expensa: {perfil.estadoExpensa}
                </span>
              )}
              <span className="se-badge se-badge-accent">
                <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--se-accent)', display: 'inline-block' }} />
                Activo
              </span>
            </div>
          </div>
        </header>

        {/* Views */}
        <div key={view} className="se-fade-in">
          {view === 'home'      && renderHome()}
          {view === 'visitantes'&& renderVisitantes()}
          {view === 'crear'     && renderCrear()}
          {view === 'vehiculo'  && renderVehiculo()}
        </div>
      </main>

      {/* Global: Toasts */}
      <ToastContainer />

      {/* Modal QR post-creación */}
      {visitanteCreado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem', background: 'rgba(8,13,20,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => { setVisitanteCreado(null); setView('visitantes'); }}>
          <div style={{ background: 'var(--se-surface)', borderRadius: 20, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.4)', border: '1px solid var(--se-border)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header verde éxito */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              {/* Icono éxito */}
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CheckCircle2 size={28} style={{ color: '#10B981' }} />
              </div>
              <h3 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)', marginBottom: 4 }}>
                ¡Visitante registrado!
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', marginBottom: '1.25rem' }}>
                Comparte este QR con <strong style={{ color: 'var(--se-text-primary)' }}>{visitanteCreado?.nombreVisitante} {visitanteCreado?.apellidoVisitante}</strong>
              </p>

              {/* QR Code */}
              {visitanteCreado?.qrToken ? (
                <div style={{ background: '#fff', borderRadius: 16, padding: '1rem', display: 'inline-block', marginBottom: '1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                  <QRCodeSVG
                    value={`${window.location.origin}/acceso-visitante?token=${visitanteCreado.qrToken}`}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              ) : (
                <div style={{ background: 'var(--se-bg)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--se-text-muted)' }}>
                  El visitante debe obtener su código de acceso dinámico para ingresar.
                </div>
              )}

              {/* Info del visitante */}
              <div style={{ background: 'var(--se-bg)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1rem', textAlign: 'left' }}>
                {[
                  { label: 'Cédula', value: visitanteCreado?.cedulaVisitante },
                  { label: 'Placa', value: visitanteCreado?.placaVehiculo !== 'N/A' ? visitanteCreado?.placaVehiculo : null },
                ].filter(f => f.value).map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--se-border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--se-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>{value}</span>
                      <button onClick={() => handleCopy(value, label)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedField === label ? '#10B981' : 'var(--se-text-muted)', padding: 2 }}>
                        {copiedField === label ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setVisitanteCreado(null); setView('visitantes'); }} className="se-btn-ghost" style={{ flex: 1, borderRadius: 12, justifyContent: 'center' }}>
                  Ver mis visitantes
                </button>
                <button onClick={() => { setVisitanteCreado(null); }} className="se-btn-primary" style={{ flex: 1, borderRadius: 12, justifyContent: 'center' }}>
                  Registrar otro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Código de Acceso */}
      {showCodigoModal && selectedVisitante && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0.75rem',
          background: 'rgba(8,13,20,0.75)',
          backdropFilter: 'blur(8px)',
        }}>
          <div className="se-slide-up se-card" style={{ borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 400, maxHeight: '95vh', overflowY: 'auto' }}>
            {/* Modal header */}
            <div style={{ background: 'var(--se-panel-bg)', borderBottom: '1px solid var(--se-panel-border)', padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F1F5F9' }}>
                    Código de Acceso
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                    {selectedVisitante.nombre || selectedVisitante.nombreVisitante}{' '}
                    {selectedVisitante.apellido || selectedVisitante.apellidoVisitante}
                  </p>
                </div>
                <button
                  onClick={() => { setShowCodigoModal(false); setSelectedVisitante(null); setCodigoDinamico(null); }}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
              {loadingCodigo ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                  <div style={{ width: 40, height: 40, border: '3px solid var(--se-border)', borderTopColor: 'var(--se-accent)', borderRadius: '50%', margin: '0 auto 12px', animation: 'se-arc-spin 0.8s linear infinite' }} />
                  <p style={{ color: 'var(--se-text-muted)', fontSize: '0.85rem' }}>Generando código...</p>
                </div>
              ) : codigoDinamico?.codigo ? (
                <>
                  {/* TOTP display */}
                  <div style={{
                    background: 'var(--se-amber-dim)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 14, padding: '1.25rem',
                    marginBottom: '1.25rem',
                    textAlign: 'center',
                  }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#92400E', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <KeyRound size={13} /> Código Dinámico
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                      {codigoDinamico.codigo.split('').map((digit, i) => (
                        <span key={i} style={{
                          flex: 1, minWidth: 0, maxWidth: 46, height: 50, borderRadius: 10,
                          background: '#fff',
                          border: '2px solid rgba(245,158,11,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.5rem', fontWeight: 800,
                          color: '#92400E',
                          boxShadow: '0 2px 8px rgba(245,158,11,0.12)',
                        }}>
                          {digit}
                        </span>
                      ))}
                    </div>
                    <p style={{ marginTop: 12, fontSize: '0.75rem', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Clock size={12} /> Válido por {Math.floor((codigoDinamico.expiraEn || 600) / 60)} minutos más
                    </p>
                  </div>

                  {/* Instrucciones */}
                  <div style={{ background: 'var(--se-accent-dim)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1', marginBottom: 8 }}>Instrucciones</p>
                    <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                      {[
                        'Comparte este código con tu visitante (WhatsApp, SMS, etc.)',
                        'El visitante ingresa a "Acceso Visitante" en la página principal',
                        'Ingresa su cédula y este código para generar su QR de acceso',
                      ].map((t, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', color: '#0369A1', marginBottom: 6, lineHeight: 1.5 }}>{t}</li>
                      ))}
                    </ol>
                  </div>

                  <button
                    onClick={() => { setShowCodigoModal(false); setSelectedVisitante(null); setCodigoDinamico(null); }}
                    className="se-btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', borderRadius: 12 }}
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--se-text-muted)', fontSize: '0.85rem' }}>
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

/* ── Helper: empty state ── */
function EmptyState({ icon: Icon, text, subtext, actionLabel, onAction }) {
  return (
    <div style={{
      borderRadius: 12, padding: '2.5rem 1rem',
      textAlign: 'center',
      border: '2px dashed var(--se-border)',
      background: 'var(--se-bg)',
    }}>
      <Icon size={30} style={{ color: 'var(--se-border)', margin: '0 auto 10px' }} />
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--se-text-muted)' }}>{text}</p>
      {subtext && <p style={{ fontSize: '0.72rem', color: 'var(--se-text-muted)', marginTop: 4, opacity: 0.7 }}>{subtext}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="se-btn-primary"
          style={{ marginTop: '1rem', borderRadius: 10, padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
