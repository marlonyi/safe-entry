import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Car, UserCheck, ShieldCheck, Activity,
  Building, Video, QrCode, Clock, BarChart3, Calculator, Menu,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import Logo from '../components/Logo';
import ModeloMatematico from '../components/ModeloMatematico';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

import DashboardView    from './admin/DashboardView';
import ConjuntosView    from './admin/ConjuntosView';
import UsuariosView     from './admin/UsuariosView';
import VisitantesView   from './admin/VisitantesView';
import ParqueaderosView from './admin/ParqueaderosView';
import AuditoriaView    from './admin/AuditoriaView';

export default function AdminDashboard({ user }) {
  const { showToast, ToastContainer } = useToast();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, title: '', message: '', onConfirm: null, variant: 'danger',
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [view, setView] = useState('dashboard');
  const [tooltip, setTooltip] = useState({ visible: false, label: '', y: 0 });
  const sidebarRef = useRef(null);

  const openConfirm = (title, message, onConfirm, variant = 'danger') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant });
  };
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false, onConfirm: null }));

  const isSuperAdmin = user?.rol === 'superadmin';

  /* Track desktop breakpoint (≥768px) to apply sidebar offset only on desktop */
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* ── React Query: core data ── */
  const { data: usuarios = [], isError: usuariosError } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const res = await api.get('/usuarios');
      return Array.isArray(res.data) ? res.data : [];
    },
    retry: 2,
  });

  const { data: visitantes = [] } = useQuery({
    queryKey: ['visitantes'],
    queryFn: async () => {
      const res = await api.get('/visitantes').catch(() => ({ data: [] }));
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: parqueaderosStats } = useQuery({
    queryKey: ['parqueaderosStats'],
    queryFn: async () => {
      const res = await api.get('/parqueaderos/estadisticas').catch(() => ({ data: null }));
      return res.data || null;
    },
    staleTime: 120_000,
  });

  const { data: parqueaderosTorre } = useQuery({
    queryKey: ['parqueaderosTorre'],
    queryFn: async () => {
      const res = await api.get('/parqueaderos/por-torre').catch(() => ({ data: null }));
      return res.data || null;
    },
    staleTime: 120_000,
  });

  const { data: conjuntos = [] } = useQuery({
    queryKey: ['conjuntos'],
    queryFn: async () => {
      const res = await api.get('/conjuntos').catch(() => ({ data: {} }));
      // The conjuntos endpoint wraps in { conjuntos: [] } before the api.js interceptor
      // (no top-level "data" key in that response shape), so handle both forms.
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data?.conjuntos)) return res.data.conjuntos;
      return [];
    },
    staleTime: 300_000,
  });

  /* ── Menu ── */
  const menu = [
    { id: 'dashboard',    label: 'Dashboard',           icon: BarChart3  },
    ...(isSuperAdmin ? [{ id: 'conjuntos', label: 'Gestión Conjuntos', icon: Building }] : []),
    { id: 'usuarios',     label: 'Gestión Usuarios',    icon: Users      },
    { id: 'visitantes',   label: 'Visitantes',           icon: UserCheck  },
    { id: 'parqueaderos', label: 'Parqueaderos',         icon: Car        },
    { id: 'auditoria',    label: 'Auditoría / Accesos',  icon: Activity   },
    { id: 'modelo',       label: 'Modelo Matemático',    icon: Calculator },
    { id: 'simulador',    label: 'Simulador Cámaras',    icon: Video      },
  ];

  /* ── Avatar gradient by role ── */
  const avatarGradient = isSuperAdmin
    ? 'linear-gradient(135deg, #8B5CF6, #6366F1)'
    : 'linear-gradient(135deg, #0EA5E9, #0284C7)';
  const avatarShadow = isSuperAdmin
    ? 'rgba(99,102,241,0.35)'
    : 'rgba(14,165,233,0.35)';
  const roleColor = isSuperAdmin ? '#A78BFA' : '#60A5FA';

  /* ── Sidebar content ── */
  /* collapsed=true  → desktop collapsed mode (icons only)
     onNavClick      → called after navigation (used by mobile drawer to close itself) */
  const renderSidebarContent = (onNavClick, collapsed = false) => (
    <>
      {/* Subtle grid texture overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 32px)',
        pointerEvents: 'none',
      }} />

      {/* Logo area */}
      <div style={{
        padding: 0,
        borderBottom: '1px solid var(--se-panel-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <img
          src="/safeentry-logo.png"
          alt="SafeEntry"
          style={{
            width: '100%',
            height: collapsed ? 44 : 90,
            objectFit: collapsed ? 'contain' : 'cover',
            objectPosition: 'center',
          }}
        />
      </div>

      {/* Nav section label */}
      {!collapsed && (
        <div style={{ padding: '1rem 1.25rem 0.25rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)' }}>
            Navegación
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav style={{
        flex: 1,
        padding: collapsed ? '0.75rem 0.5rem' : '0.5rem 0.75rem',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
      }}>
        {menu.map((m) => (
          <div key={m.id} style={{ position: 'relative' }}>
            <button
              onClick={() => { setView(m.id); onNavClick(); }}
              className={`se-nav-item ${view === m.id ? 'active' : ''}`}
              style={{
                marginBottom: 2,
                position: 'relative',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '0.7rem 0' : '0.65rem 0.875rem',
                width: '100%',
                borderRadius: collapsed ? 10 : undefined,
              }}
              onMouseEnter={collapsed ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ visible: true, label: m.label, y: rect.top + rect.height / 2 });
              } : undefined}
              onMouseLeave={collapsed ? () => setTooltip({ visible: false, label: '', y: 0 }) : undefined}
            >
              {/* Active left-edge indicator */}
              {view === m.id && (
                <div style={{
                  position: 'absolute',
                  left: collapsed ? 'auto' : 0,
                  right: collapsed ? 'auto' : 'auto',
                  top: '50%',
                  transform: collapsed ? 'none' : 'translateY(-50%)',
                  ...(collapsed ? { bottom: 0, top: 'auto', left: '50%', transform: 'translateX(-50%)', width: 20, height: 2.5, borderRadius: 2 } : { left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: '0 3px 3px 0' }),
                  background: 'var(--se-accent)',
                }} />
              )}
              <m.icon
                size={17}
                className="se-nav-icon"
                style={{ flexShrink: 0, transition: 'color 0.2s' }}
              />
              {!collapsed && (
                <>
                  <span style={{ flex: 1, textAlign: 'left' }}>{m.label}</span>
                  {view === m.id && (
                    <span className="se-pulse-dot" style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: 'var(--se-accent)' }} />
                  )}
                </>
              )}
            </button>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div style={{
        padding: collapsed ? '0.875rem 0.5rem' : '0.875rem 0.75rem',
        borderTop: '1px solid var(--se-panel-border)',
        position: 'relative',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: avatarGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 800, color: '#fff',
                boxShadow: `0 2px 8px ${avatarShadow}`,
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ visible: true, label: user?.nombre || 'Administrador', y: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => setTooltip({ visible: false, label: '', y: 0 })}
            >
              {user?.nombre?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        ) : (
          <div className="se-user-card">
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: avatarGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 800, color: '#fff',
              boxShadow: `0 2px 8px ${avatarShadow}`,
            }}>
              {user?.nombre?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                {user?.nombre || 'Administrador'}
              </p>
              <p style={{ fontSize: '0.68rem', textTransform: 'capitalize', color: roleColor, marginTop: 1, lineHeight: 1.2 }}>
                {user?.rol || 'admin'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  /* ── Main layout ── */
  const SIDEBAR_EXPANDED = 256;
  const SIDEBAR_COLLAPSED = 64;
  const desktopWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--se-bg)' }}>

      {/* ── Tooltip portal for collapsed sidebar ── */}
      {tooltip.visible && sidebarCollapsed && isDesktop && (
        <div
          style={{
            position: 'fixed',
            left: SIDEBAR_COLLAPSED + 10,
            top: tooltip.y,
            transform: 'translateY(-50%)',
            zIndex: 200,
            background: '#1E293B',
            color: '#F1F5F9',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.35rem 0.7rem',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {tooltip.label}
          {/* Arrow */}
          <div style={{
            position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: '5px solid #1E293B',
          }} />
        </div>
      )}

      {/* Sidebar — desktop */}
      <aside
        ref={sidebarRef}
        className="hidden md:flex flex-col"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => { setSidebarHovered(false); setTooltip({ visible: false, label: '', y: 0 }); }}
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
        {/* Inner clip container — clips the content but not the toggle button */}
        <div style={{
          position: 'absolute', inset: 0,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          borderRight: 'none',
        }}>
          {renderSidebarContent(() => {}, sidebarCollapsed)}
        </div>

        {/* Toggle button — sits on the right edge, visible on hover */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            position: 'absolute',
            right: -13,
            top: 72,
            zIndex: 30,
            width: 26,
            height: 26,
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
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.2), 0 4px 12px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          }}
        >
          {sidebarCollapsed
            ? <ChevronRight size={13} strokeWidth={2.5} />
            : <ChevronLeft  size={13} strokeWidth={2.5} />
          }
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

      {/* Mobile sidebar drawer — always full width, never collapsed */}
      <aside
        className="md:hidden flex flex-col"
        style={{
          width: 264, flexShrink: 0,
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

      {/* Main content — margin-left tracks sidebar width on desktop, 0 on mobile */}
      <main
        style={{
          flex: 1, minWidth: 0,
          marginLeft: isDesktop ? desktopWidth : 0,
          transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
        className="p-4 md:p-8"
      >

        {/* Header */}
        <header className="se-card" style={{ borderRadius: 14, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1, #8B5CF6)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
                style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--se-bg)', border: '1px solid var(--se-border)', color: 'var(--se-text-secondary)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <Menu size={18} />
              </button>
              <div className="hidden sm:flex" style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--se-accent-dim)', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={20} style={{ color: 'var(--se-accent)' }} />
              </div>
              <div>
                <h1 className="se-heading" style={{ fontSize: 'clamp(0.9rem, 4vw, 1.2rem)', fontWeight: 800, color: 'var(--se-text-primary)', textTransform: 'capitalize' }}>
                  {view === 'dashboard' ? 'Panel Principal' : view}
                </h1>
                <p className="hidden sm:block" style={{ fontSize: '0.75rem', color: 'var(--se-text-muted)' }}>
                  Bienvenido, {user?.nombre || 'Administrador'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {view === 'dashboard' && (
                <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 6, padding: '0.375rem 0.75rem', borderRadius: 999, background: 'var(--se-bg)', border: '1px solid var(--se-border)' }}>
                  <Clock size={12} style={{ color: 'var(--se-text-muted)' }} />
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--se-text-secondary)' }}>
                    {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <span className="se-badge" style={{ background: 'rgba(16,185,129,0.10)', color: '#065F46', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                <span className="hidden sm:inline">Sistema </span>Activo
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
        {usuariosError && (
          <div style={{ background: 'var(--se-error-dim)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--se-error)', fontWeight: 600 }}>
            <span>⚠️</span> No se pudieron cargar los datos del servidor. Verifica tu conexión e intenta recargar la página.
          </div>
        )}

        <div key={view} className="se-fade-in">
          {view === 'dashboard' && <DashboardView />}

          {view === 'conjuntos' && (
            <ConjuntosView
              conjuntos={conjuntos}
              showToast={showToast}
            />
          )}

          {view === 'usuarios' && (
            <UsuariosView
              usuarios={usuarios}
              conjuntos={conjuntos}
              isSuperAdmin={isSuperAdmin}
              showToast={showToast}
              openConfirm={openConfirm}
              closeConfirm={closeConfirm}
            />
          )}

          {view === 'visitantes' && (
            <VisitantesView
              visitantes={visitantes}
              conjuntos={conjuntos}
              showToast={showToast}
            />
          )}

          {view === 'parqueaderos' && (
            <ParqueaderosView
              parkStats={parqueaderosStats}
              parkData={parqueaderosTorre}
              conjuntos={conjuntos}
              showToast={showToast}
            />
          )}

          {view === 'auditoria' && (
            <AuditoriaView conjuntos={conjuntos} />
          )}

          {view === 'modelo' && <ModeloMatematico />}

          {view === 'simulador' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { title: 'LPR (Cámara Placas)', desc: 'Modelo de IA YOLOv8 para detección de placas vehiculares', icon: Video,  accentColor: '#0EA5E9', endpoint: '/scripts/lpr' },
              { title: 'Escáner Pases QR',    desc: 'Validación de códigos QR de acceso para visitantes',       icon: QrCode, accentColor: '#10B981', endpoint: '/scripts/qr'  },
            ].map((item, i) => (
              <div key={i} className="se-card" style={{ borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ height: 3, background: item.accentColor }} />
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 1.25rem', background: `${item.accentColor}18`, border: `1px solid ${item.accentColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        showToast('Sistema iniciado correctamente', 'success');
                      } catch {
                        showToast('Error al iniciar el sistema.', 'error');
                      }
                    }}
                    className="se-btn-primary"
                    style={{ width: '100%', justifyContent: 'center', borderRadius: 12, background: `linear-gradient(135deg, ${item.accentColor}, ${item.accentColor}cc)`, boxShadow: `0 4px 14px ${item.accentColor}35` }}
                  >
                    Iniciar Sistema
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
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
