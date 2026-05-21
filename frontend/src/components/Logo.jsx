import React from 'react';

/**
 * Logo SafeEntry — componente con estilo refinado.
 *
 * Variantes:
 * - "compact": para top bars angostos
 * - "default": para sidebars expandidos (Admin / Portero / Residente)
 * - "hero": para login y splash con efectos avanzados
 *
 * Tema:
 * - "light": fondos claros (sidebar residente, header login)
 * - "dark":  fondos oscuros (sidebars admin/portero, banner login derecho)
 */
export default function Logo({
  variant = 'default',
  theme = 'light',
  subtitle = null,
  className = ''
}) {
  const isDark = theme === 'dark';

  // Tipografia
  const titleColor = isDark ? 'text-white' : 'text-slate-900';
  const subtitleColor = isDark ? 'text-slate-300/80' : 'text-slate-500';

  // Tamaños por variante
  const sizes = {
    compact: { box: 'w-12 h-12', title: 'text-base', radius: 'rounded-xl' },
    default: { box: 'w-14 h-14', title: 'text-xl', radius: 'rounded-2xl' },
    hero:    { box: 'w-72 h-44', title: 'text-5xl', radius: 'rounded-3xl' }
  };
  const s = sizes[variant];

  // Contenedor del icono: glassmorphism segun tema
  const containerBase = `${s.box} ${s.radius} shrink-0 relative overflow-hidden flex items-center justify-center backdrop-blur-sm`;
  const containerLight = 'bg-gradient-to-br from-white via-blue-50 to-indigo-50 ring-1 ring-blue-200/60 shadow-lg shadow-blue-500/10';
  const containerDark  = 'bg-transparent ring-1 ring-white/8 shadow-md shadow-black/40';
  const containerClass = `${containerBase} ${isDark ? containerDark : containerLight}`;

  const Icon = (
    <div className="relative shrink-0 group">
      {/* Glow exterior */}
      <div className={`absolute inset-0 ${s.radius} bg-gradient-to-br from-blue-500 to-indigo-600 ${variant === 'hero' ? 'blur-2xl opacity-40 animate-pulse' : 'blur-md opacity-25'} group-hover:opacity-60 transition-opacity duration-500`} />

      {/* Caja con la imagen */}
      <div className={`relative ${containerClass}`}>
        {isDark ? null : (
          <div className={`absolute -inset-x-2 -top-2 h-1/2 bg-gradient-to-b from-white/60 to-transparent rounded-t-2xl pointer-events-none`} />
        )}

        <img
          src="/safeentry-logo.png"
          alt="SafeEntry"
          className={`relative w-full object-contain transition-transform duration-300 group-hover:scale-105`}
          style={variant === 'hero' ? { height: '80%', marginTop: '14%', marginBottom: '6%', padding: '0 8px' } : { height: '100%', padding: '6px' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement.innerHTML = `
              <div class="absolute inset-0 flex items-center justify-center text-white font-black tracking-tight" style="background:linear-gradient(135deg,#2563eb,#4f46e5);font-size:${variant === 'hero' ? '2.5rem' : '1.25rem'}">SE</div>
            `;
          }}
        />

        {!isDark && (
          <div className={`absolute inset-0 ${s.radius} ring-1 ring-inset ring-white/40 pointer-events-none`} />
        )}
      </div>
    </div>
  );

  // Hero: layout vertical, mas dramatico
  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center text-center gap-4 ${className}`}>
        {Icon}
        <div>
          <p className={`font-black ${s.title} ${titleColor} tracking-tight leading-none`}>
            <span className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">Safe</span>
            <span className={isDark ? 'text-white' : 'text-slate-900'}>Entry</span>
          </p>
          {subtitle && (
            <p className={`text-sm font-medium ${subtitleColor} mt-2 tracking-wide`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default / compact: layout horizontal con separador sutil
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {Icon}
      <div className="hidden lg:flex flex-col leading-tight min-w-0">
        <p className={`font-black ${s.title} ${titleColor} tracking-tight whitespace-nowrap`}>
          <span className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">Safe</span>
          <span className={isDark ? 'text-white' : 'text-slate-900'}>Entry</span>
        </p>
        {subtitle && (
          <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${subtitleColor} truncate`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
