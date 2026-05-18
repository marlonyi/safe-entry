import React from 'react';

/**
 * Componente de paginación reutilizable.
 * Props:
 *  - currentPage:   página actual (1-indexed)
 *  - totalItems:    total de items
 *  - pageSize:      items por página (default 10)
 *  - onPageChange:  (newPage) => void
 *  - onPageSizeChange?: (newSize) => void  (opcional, muestra selector)
 *  - pageSizeOptions?: number[] (default [10, 20, 50, 100])
 */
export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const desde = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const hasta = Math.min(currentPage * pageSize, totalItems);

  // Calcular el rango de páginas a mostrar (máximo 5 botones numerados)
  const generarPaginas = () => {
    const paginas = [];
    let inicio = Math.max(1, currentPage - 2);
    let fin = Math.min(totalPages, inicio + 4);
    if (fin - inicio < 4) inicio = Math.max(1, fin - 4);
    for (let i = inicio; i <= fin; i++) paginas.push(i);
    return paginas;
  };

  const ir = (p) => {
    if (p < 1 || p > totalPages || p === currentPage) return;
    onPageChange(p);
  };

  // Si no hay items: no mostrar. Pero si hay aunque sea uno, mostramos la barra.
  if (totalItems === 0) return null;
  // Si hay solo 1 página pero pocos items, igual mostrar el indicador y el selector de tamaño.

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl shadow-sm">
      <div className="text-sm text-slate-700 font-medium">
        📋 Mostrando <b className="text-blue-600">{desde}</b>–<b className="text-blue-600">{hasta}</b> de <b className="text-blue-600">{totalItems}</b> registros
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n} / página</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => ir(1)}
            disabled={currentPage === 1}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Primera página"
          >
            «
          </button>
          <button
            onClick={() => ir(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>

          {generarPaginas().map((p) => (
            <button
              key={p}
              onClick={() => ir(p)}
              className={`min-w-[32px] px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                p === currentPage
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => ir(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
          <button
            onClick={() => ir(totalPages)}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Última página"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
