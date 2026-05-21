import React from 'react';
import { Users, Car, Activity, BarChart3 } from 'lucide-react';

const POWERBI_EMBED_URL = import.meta.env.VITE_POWERBI_EMBED_URL || '';

export default function DashboardView() {
  return (
    <div className="se-fade-in">
      {POWERBI_EMBED_URL ? (
        <div className="space-y-4">
          <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', background: 'var(--se-panel-bg)', borderBottom: '1px solid var(--se-panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#EF4444', '#F59E0B', '#10B981'].map((c, i) => (
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
              width="100%" height="500px" className="sm:h-[700px]"
              src={POWERBI_EMBED_URL}
              frameBorder="0" allowFullScreen
              style={{ border: 'none', display: 'block' }}
            />
          </div>
          <div className="se-card" style={{ borderRadius: 12, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
}
