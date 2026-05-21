import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    iconColor: '#10B981',
    barColor: '#10B981',
    textColor: '#065F46',
  },
  error: {
    icon: AlertCircle,
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.3)',
    iconColor: '#EF4444',
    barColor: '#EF4444',
    textColor: '#B91C1C',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.3)',
    iconColor: '#F59E0B',
    barColor: '#F59E0B',
    textColor: '#92400E',
  },
  info: {
    icon: Info,
    bg: 'var(--se-accent-dim)',
    border: 'rgba(14,165,233,0.3)',
    iconColor: 'var(--se-accent)',
    barColor: '#0EA5E9',
    textColor: '#0369A1',
  },
};

/* ── Single Toast item ── */
function ToastItem({ id, message, type = 'success', duration = 3500, onRemove }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef(null);
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const IconComponent = config.icon;

  useEffect(() => {
    // Trigger slide-in after mount
    const showTimer = requestAnimationFrame(() => setVisible(true));

    const step = 50; // ms per tick
    const decrement = (step / duration) * 100;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement;
        if (next <= 0) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return next;
      });
    }, step);

    const dismissTimer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      cancelAnimationFrame(showTimer);
      clearInterval(intervalRef.current);
      clearTimeout(dismissTimer);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onRemove(id), 280);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '0.875rem 1rem',
        borderRadius: 14,
        background: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        minWidth: 280, maxWidth: 400,
        position: 'relative',
        overflow: 'hidden',
        transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `${config.iconColor}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        <IconComponent size={17} style={{ color: config.iconColor }} />
      </div>

      {/* Message */}
      <p style={{
        flex: 1, fontSize: '0.85rem', fontWeight: 600,
        color: config.textColor,
        lineHeight: 1.4, paddingTop: 7,
        paddingRight: 8,
      }}>
        {message}
      </p>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        style={{
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          border: `1px solid ${config.border}`,
          background: 'transparent',
          color: config.iconColor,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: 4,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = `${config.iconColor}18`}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <X size={13} />
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: 3, borderRadius: '0 0 14px 14px',
        background: config.barColor,
        width: `${progress}%`,
        transition: 'width 0.05s linear',
        opacity: 0.6,
      }} />
    </div>
  );
}

/* ── Toast Container ── */
export function ToastContainer({ toasts, onRemove }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 24, right: 24,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem
            id={t.id}
            message={t.message}
            type={t.type}
            duration={t.duration}
            onRemove={onRemove}
          />
        </div>
      ))}
    </div>
  );
}

/* ── useToast hook ── */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainerBound = useCallback(
    () => <ToastContainer toasts={toasts} onRemove={removeToast} />,
    [toasts, removeToast]
  );

  return { showToast, ToastContainer: ToastContainerBound };
}

export default ToastItem;
