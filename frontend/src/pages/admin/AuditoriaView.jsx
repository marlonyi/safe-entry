import React, { useState } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import Pagination from '../../components/Pagination';
import { labelStyle } from './adminHelpers';

const AUD_LIMIT = 50;

export default function AuditoriaView({ conjuntos }) {
  const [audFiltros, setAudFiltros] = useState({
    fechaInicio: '', fechaFin: '', tipoAcceso: '', tipoUsuario: '', placa: '', conjunto: '',
  });
  const [audPage, setAudPage] = useState(1);

  const buildParams = () => {
    const params = new URLSearchParams();
    Object.entries(audFiltros).forEach(([k, v]) => { if (v) params.append(k, v); });
    params.append('page', audPage);
    params.append('limit', AUD_LIMIT);
    return params.toString();
  };

  const buildStatsParams = () => {
    const params = new URLSearchParams();
    ['fechaInicio', 'fechaFin', 'conjunto'].forEach(k => {
      if (audFiltros[k]) params.append(k, audFiltros[k]);
    });
    return params.toString();
  };

  const { data: histPayload, isFetching: audLoading } = useQuery({
    queryKey: ['auditoria', audFiltros, audPage],
    queryFn: async () => {
      const res = await api.get(`/parqueaderos/historial?${buildParams()}`).catch(() => ({ data: { items: [], total: 0, totalPages: 0 } }));
      const payload = res.data || {};
      return {
        items: Array.isArray(payload.items) ? payload.items : [],
        total: payload.total || 0,
        totalPages: payload.totalPages || 0,
      };
    },
    staleTime: 30_000,
  });

  const { data: audStats } = useQuery({
    queryKey: ['auditoriaStats', audFiltros.fechaInicio, audFiltros.fechaFin, audFiltros.conjunto],
    queryFn: async () => {
      const res = await api.get(`/parqueaderos/historial/estadisticas?${buildStatsParams()}`).catch(() => ({ data: null }));
      return res.data || null;
    },
    staleTime: 30_000,
  });

  const historial = histPayload?.items || [];
  const audMeta = { total: histPayload?.total || 0, totalPages: histPayload?.totalPages || 0 };

  return (
    <div className="space-y-5 se-fade-in">
      {audStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {[
            { label: 'Total',      value: audStats.total,      accentColor: '#64748B' },
            { label: 'Hoy',        value: audStats.hoy,        accentColor: '#F59E0B' },
            { label: 'Entradas',   value: audStats.entradas,   accentColor: '#10B981' },
            { label: 'Salidas',    value: audStats.salidas,    accentColor: '#EF4444' },
            { label: 'Residentes', value: audStats.residentes, accentColor: '#0EA5E9' },
            { label: 'Visitantes', value: audStats.visitantes, accentColor: '#8B5CF6' },
          ].map((c, i) => (
            <div key={i} className="se-card" style={{ borderRadius: 12, padding: '1rem' }}>
              <p className="se-heading" style={{ fontSize: 'clamp(1.1rem, 3vw, 1.625rem)', fontWeight: 800, color: c.accentColor, lineHeight: 1 }}>
                {(c.value || 0).toLocaleString()}
              </p>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginTop: 4 }}>
                {c.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--se-amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={17} style={{ color: 'var(--se-amber)' }} />
          </div>
          <h3 className="se-heading" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--se-text-primary)' }}>Filtros</h3>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Desde', key: 'fechaInicio', type: 'date' },
              { label: 'Hasta', key: 'fechaFin',    type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type={f.type}
                  value={audFiltros[f.key]}
                  onChange={e => { setAudFiltros({ ...audFiltros, [f.key]: e.target.value }); setAudPage(1); }}
                  className="se-input"
                />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Conjunto</label>
              <select
                value={audFiltros.conjunto}
                onChange={e => { setAudFiltros({ ...audFiltros, conjunto: e.target.value }); setAudPage(1); }}
                className="se-input"
              >
                <option value="">Todos</option>
                {conjuntos.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo acceso</label>
              <select
                value={audFiltros.tipoAcceso}
                onChange={e => { setAudFiltros({ ...audFiltros, tipoAcceso: e.target.value }); setAudPage(1); }}
                className="se-input"
              >
                <option value="">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo usuario</label>
              <select
                value={audFiltros.tipoUsuario}
                onChange={e => { setAudFiltros({ ...audFiltros, tipoUsuario: e.target.value }); setAudPage(1); }}
                className="se-input"
              >
                <option value="">Todos</option>
                <option value="residente">Residente</option>
                <option value="visitante">Visitante</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Placa</label>
              <input
                type="text" placeholder="Buscar placa..."
                value={audFiltros.placa}
                onChange={e => { setAudFiltros({ ...audFiltros, placa: e.target.value }); setAudPage(1); }}
                className="se-input" style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAudFiltros({ fechaInicio: '', fechaFin: '', tipoAcceso: '', tipoUsuario: '', placa: '', conjunto: '' }); setAudPage(1); }}
              className="se-btn-ghost"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.875rem', borderRadius: 8 }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={17} style={{ color: 'var(--se-amber)' }} />
            </div>
            <h2 className="se-heading" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Historial y Auditoría
            </h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)' }}>
            {audMeta.total.toLocaleString()} registros
          </span>
        </div>

        {audLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
            <div style={{ width: 32, height: 32, border: '2px solid var(--se-border)', borderTopColor: 'var(--se-amber)', borderRadius: '50%', margin: '0 auto 10px', animation: 'se-arc-spin 0.8s linear infinite' }} />
            Cargando...
          </div>
        ) : historial.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
            No se encontraron accesos con los filtros aplicados.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full se-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>Fecha y hora</th>
                  <th className="hidden md:table-cell" style={{ textAlign: 'left' }}>Conjunto</th>
                  <th style={{ textAlign: 'left' }}>Acceso</th>
                  <th className="hidden sm:table-cell" style={{ textAlign: 'left' }}>Tipo usuario</th>
                  <th className="hidden sm:table-cell" style={{ textAlign: 'left' }}>Nombre</th>
                  <th style={{ textAlign: 'left' }}>Placa</th>
                  <th className="hidden md:table-cell" style={{ textAlign: 'left' }}>Plaza</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={h._id || i}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--se-text-secondary)', fontFamily: 'monospace' }}>
                      {new Date(h.fechaHora).toLocaleString()}
                    </td>
                    <td className="hidden md:table-cell" style={{ fontSize: '0.82rem' }}>{h.conjunto?.nombre || '—'}</td>
                    <td>
                      <span className="se-badge" style={
                        h.tipoAcceso === 'entrada'
                          ? { background: 'rgba(16,185,129,0.10)', color: '#065F46' }
                          : { background: 'rgba(239,68,68,0.10)', color: '#B91C1C' }
                      }>{h.tipoAcceso}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className="se-badge" style={
                        h.tipoUsuario === 'residente'
                          ? { background: 'var(--se-accent-dim)', color: '#0369A1' }
                          : { background: 'rgba(139,92,246,0.12)', color: '#7C3AED' }
                      }>{h.tipoUsuario}</span>
                    </td>
                    <td className="hidden sm:table-cell" style={{ fontSize: '0.82rem' }}>{h.nombreUsuario || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700 }}>{h.placa || '—'}</td>
                    <td className="hidden md:table-cell" style={{ fontSize: '0.82rem', color: 'var(--se-text-muted)' }}>{h.plaza || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
          <Pagination
            currentPage={audPage}
            totalItems={audMeta.total || 0}
            pageSize={AUD_LIMIT}
            onPageChange={setAudPage}
          />
        </div>
      </div>
    </div>
  );
}
