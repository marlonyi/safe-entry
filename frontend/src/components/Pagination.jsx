import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Componente de paginación — SafeEntry Design System
 * Props:
 *  - currentPage:       página actual (1-indexed)
 *  - totalItems:        total de items
 *  - pageSize:          items por página (default 10)
 *  - onPageChange:      (newPage) => void
 *  - onPageSizeChange?: (newSize) => void  (opcional, muestra selector)
 *  - pageSizeOptions?:  number[] (default [10, 20, 50, 100])
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

  if (totalItems === 0) return null;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 px-4 py-3 rounded-xl"
      style={{
        background: '#F8FAFC',
        border: '1px solid var(--se-border)',
      }}
    >
      {/* Contador */}
      <p className="text-xs" style={{ color: 'var(--se-text-secondary)', fontFamily: 'DM Sans, sans-serif' }}>
        Mostrando{' '}
        <span className="font-bold" style={{ color: 'var(--se-accent)' }}>{desde}</span>
        {' '}–{' '}
        <span className="font-bold" style={{ color: 'var(--se-accent)' }}>{hasta}</span>
        {' '}de{' '}
        <span className="font-bold" style={{ color: 'var(--se-text-primary)' }}>{totalItems}</span>
        {' '}registros
      </p>

      <div className="flex items-center gap-2">
        {/* Selector de tamaño */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="se-input"
            style={{ width: 'auto', padding: '0.35rem 0.625rem', fontSize: '0.75rem' }}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n} / pág</option>
            ))}
          </select>
        )}

        {/* Botones de navegación */}
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => ir(1)} disabled={currentPage === 1} title="Primera">
            <ChevronsLeft size={14} />
          </NavBtn>
          <NavBtn onClick={() => ir(currentPage - 1)} disabled={currentPage === 1} title="Anterior">
            <ChevronLeft size={14} />
          </NavBtn>

          {generarPaginas().map((p) => (
            <button
              key={p}
              onClick={() => ir(p)}
              style={
                p === currentPage
                  ? {
                      minWidth: 32,
                      padding: '0.35rem 0.5rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                      color: '#fff',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
                      cursor: 'pointer',
                    }
                  : {
                      minWidth: 32,
                      padding: '0.35rem 0.5rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: '#fff',
                      color: 'var(--se-text-secondary)',
                      border: '1px solid var(--se-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }
              }
            >
              {p}
            </button>
          ))}

          <NavBtn onClick={() => ir(currentPage + 1)} disabled={currentPage >= totalPages} title="Siguiente">
            <ChevronRight size={14} />
          </NavBtn>
          <NavBtn onClick={() => ir(totalPages)} disabled={currentPage >= totalPages} title="Última">
            <ChevronsRight size={14} />
          </NavBtn>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ onClick, disabled, children, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '0.5rem',
        border: '1px solid var(--se-border)',
        background: disabled ? '#F1F5F9' : '#fff',
        color: disabled ? '#CBD5E1' : 'var(--se-text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        fontSize: '0.75rem',
      }}
    >
      {children}
    </button>
  );
}
