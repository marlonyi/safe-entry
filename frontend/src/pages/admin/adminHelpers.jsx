/**
 * Shared UI primitives used across AdminDashboard sub-views.
 * Kept in one file to avoid prop-drilling of style constants.
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const labelStyle = {
  display: 'block',
  marginBottom: 5,
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--se-text-secondary)',
};

export function TabBtn({ active, onClick, count, accentColor = 'var(--se-accent)', children }) {
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

export function Modal({ children, onClose, accentColor = 'var(--se-accent)' }) {
  const firstFocusableRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (firstFocusableRef.current) {
        const focusable = firstFocusableRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) focusable.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0.5rem',
        background: 'rgba(8,13,20,0.75)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={firstFocusableRef}
        className="se-slide-up se-card"
        style={{
          borderRadius: 16, overflow: 'hidden',
          width: '100%', maxWidth: 500,
          maxHeight: '95vh', overflowY: 'auto',
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, #6366F1)` }} />
        <div style={{ padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalHeader({ icon: Icon, iconBg, iconColor, title, subtitle, onClose }) {
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
