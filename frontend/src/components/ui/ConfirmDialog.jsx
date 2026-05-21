import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const VARIANT_CONFIG = {
  danger: {
    icon: AlertCircle,
    iconBg: 'rgba(239,68,68,0.12)',
    iconColor: '#EF4444',
    confirmBg: 'linear-gradient(135deg, #EF4444, #DC2626)',
    confirmShadow: 'rgba(239,68,68,0.35)',
    accentBar: 'linear-gradient(90deg, #EF4444, #DC2626)',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: '#F59E0B',
    confirmBg: 'linear-gradient(135deg, #F59E0B, #D97706)',
    confirmShadow: 'rgba(245,158,11,0.35)',
    accentBar: 'linear-gradient(90deg, #F59E0B, #D97706)',
  },
  info: {
    icon: Info,
    iconBg: 'var(--se-accent-dim)',
    iconColor: 'var(--se-accent)',
    confirmBg: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
    confirmShadow: 'rgba(14,165,233,0.35)',
    accentBar: 'linear-gradient(90deg, #0EA5E9, #6366F1)',
  },
};

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirmar acción',
  message = '¿Estás seguro de que deseas continuar?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
}) {
  const containerRef = useRef(null);
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger;
  const IconComponent = config.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const focusable = containerRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) focusable.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0.75rem',
        background: 'rgba(8,13,20,0.80)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={containerRef}
        className="se-slide-up se-card"
        style={{
          borderRadius: 16, overflow: 'hidden',
          width: '100%', maxWidth: 420, maxHeight: '95vh', overflowY: 'auto',
        }}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: config.accentBar }} />

        <div style={{ padding: '1.5rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: config.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconComponent size={22} style={{ color: config.iconColor }} />
              </div>
              <h2
                id="confirm-dialog-title"
                className="se-heading"
                style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onCancel}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--se-border)',
                background: 'var(--se-bg)',
                color: 'var(--se-text-muted)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Message */}
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--se-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
            paddingLeft: 'clamp(0px, 10vw, 56px)',
          }}>
            {message}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={onCancel}
              className="se-btn-ghost"
              style={{ borderRadius: 10, padding: '0.6rem 1.25rem' }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '0.6rem 1.25rem', borderRadius: 10,
                fontSize: '0.875rem', fontWeight: 700, color: '#fff',
                background: config.confirmBg,
                boxShadow: `0 4px 14px ${config.confirmShadow}`,
                border: 'none', cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
