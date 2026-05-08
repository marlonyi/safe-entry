import React from 'react';

/**
 * Componente para embeber reportes de Power BI (Publish to Web)
 *
 * Props:
 * - embedUrl: URL del reporte (obligatorio)
 * - width: Ancho del iframe (default: '100%')
 * - height: Alto del iframe (default: '600px')
 * - title: Título del dashboard
 */

export default function PowerBIDashboard({
  embedUrl,
  width = '100%',
  height = '600px',
  title = 'Dashboard Power BI'
}) {
  // Renderizar iframe de Power BI
  if (embedUrl) {
    return (
      <div className="w-full">
        {title && (
          <h2 className="text-xl font-bold mb-4 text-slate-800">{title}</h2>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <iframe
            title={title}
            width={width}
            height={height}
            src={embedUrl}
            frameBorder="0"
            allowFullScreen={true}
            style={{ border: 'none' }}
          />
        </div>
      </div>
    );
  }

  // Sin configuración
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-amber-800 mb-2">
        ⚠️ Configuración de Power BI Requerida
      </h3>
      <p className="text-amber-700 mb-4">
        Para mostrar el dashboard, configura la URL de Power BI en el archivo{' '}
        <code className="bg-amber-100 px-1 rounded">frontend/.env</code>:
      </p>
      <div className="bg-white p-3 rounded-lg font-mono text-sm">
        VITE_POWERBI_EMBED_URL=https://app.powerbi.com/view?r=...
      </div>
    </div>
  );
}