import React, { useState } from 'react';
import { Car } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { TabBtn, Modal, ModalHeader, labelStyle } from './adminHelpers';

export default function ParqueaderosView({ parkStats, parkData, conjuntos, showToast }) {
  const queryClient = useQueryClient();

  const [torreSeleccionada, setTorreSeleccionada] = useState('privados');
  const [conjuntoSeleccionado, setConjuntoSeleccionado] = useState(null);

  const [showInitModal, setShowInitModal] = useState(false);
  const [initConjuntoTarget, setInitConjuntoTarget] = useState(null);
  const [initConfig, setInitConfig] = useState({
    torres: 'A,B', pisos: 5, apartamentosPorPiso: 2,
    residenteMoto: 10, visitanteCarro: 10, visitanteMoto: 5,
  });
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState(null);

  const conjuntosList = (parkData?.conjuntos || []).filter(c => {
    const nombre = (c?.nombre || '').toLowerCase();
    return c?._id && nombre !== 'sin conjunto' && nombre !== 'sin-conjunto';
  });
  const activeConjuntoId = conjuntoSeleccionado || conjuntosList[0]?._id;
  const activeConjunto = conjuntosList.find(c => c._id === activeConjuntoId);

  const seccionesActivas = torreSeleccionada === 'visitantes'
    ? [
        { title: 'Carros',  data: activeConjunto?.visitantesCarro, colorBorder: '#6EE7B7', colorBg: '#ECFDF5', colorText: '#065F46' },
        { title: 'Motos',   data: activeConjunto?.visitantesMoto,  colorBorder: '#FCD34D', colorBg: '#FFFBEB', colorText: '#92400E' },
      ]
    : [
        { title: 'Carros',  data: activeConjunto?.privadosCarro,  colorBorder: '#93C5FD', colorBg: '#EFF6FF', colorText: '#1D4ED8' },
        { title: 'Motos',   data: activeConjunto?.privadosMoto,   colorBorder: '#C4B5FD', colorBg: '#F5F3FF', colorText: '#7C3AED' },
      ];

  const totalPlazasActive = (activeConjunto?.privadosCarro?.length || 0)
    + (activeConjunto?.privadosMoto?.length || 0)
    + (activeConjunto?.visitantesCarro?.length || 0)
    + (activeConjunto?.visitantesMoto?.length || 0);
  const conjuntoSinPlazas = activeConjunto && totalPlazasActive === 0;

  return (
    <div className="space-y-6 se-fade-in">
      {parkStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { title: 'Residentes Carro', data: parkStats.porCategoria?.privado?.carro,    accentColor: '#0EA5E9' },
            { title: 'Residentes Moto',  data: parkStats.porCategoria?.privado?.moto,     accentColor: '#8B5CF6' },
            { title: 'Visitantes Carro', data: parkStats.porCategoria?.visitante?.carro,  accentColor: '#10B981' },
            { title: 'Visitantes Moto',  data: parkStats.porCategoria?.visitante?.moto,   accentColor: '#F59E0B' },
          ].map((item, i) => (
            <div key={i} className="se-card" style={{ borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 10, background: `${item.accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Car size={18} style={{ color: item.accentColor }} />
              </div>
              <p className="se-heading" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.75rem)', fontWeight: 800, color: 'var(--se-text-primary)', lineHeight: 1 }}>
                {item.data?.disponibles || 0}
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--se-text-muted)' }}>/{item.data?.total || 0}</span>
              </p>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginTop: 4 }}>
                {item.title}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #6366F1, #0EA5E9)' }} />
        <div style={{ padding: '1.25rem' }}>
          {conjuntosList.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--se-text-muted)', marginBottom: 8 }}>Conjunto</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {conjuntosList.map(c => (
                  <TabBtn key={c._id} active={activeConjuntoId === c._id} onClick={() => setConjuntoSeleccionado(c._id)} accentColor="var(--se-accent)">
                    {c.nombre}
                  </TabBtn>
                ))}
              </div>
            </div>
          )}

          {conjuntoSinPlazas && (
            <div style={{ marginBottom: '1rem', padding: '1rem 1.125rem', borderRadius: 12, background: 'var(--se-amber-dim)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Car size={17} style={{ color: 'var(--se-amber)' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
                  El conjunto "{activeConjunto.nombre}" aún no tiene parqueaderos
                </p>
                <p style={{ fontSize: '0.78rem', color: '#92400E', marginBottom: '0.75rem' }}>
                  Genera plazas automáticamente con la configuración que prefieras.
                </p>
                <button
                  onClick={() => {
                    setInitConjuntoTarget(activeConjunto);
                    setInitConfig({ torres: 'A,B', pisos: 5, apartamentosPorPiso: 2, residenteMoto: 10, visitanteCarro: 10, visitanteMoto: 5 });
                    setShowInitModal(true);
                  }}
                  className="se-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)', borderRadius: 10 }}
                >
                  Configurar e inicializar parqueaderos
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--se-border)' }}>
            {[
              { id: 'privados',   label: 'Residentes', color: 'var(--se-accent)' },
              { id: 'visitantes', label: 'Visitantes',  color: '#10B981' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTorreSeleccionada(t.id)}
                style={{
                  padding: '0.5rem 1.125rem', borderRadius: 10,
                  fontSize: '0.82rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  ...(torreSeleccionada === t.id
                    ? { background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, boxShadow: `0 2px 8px ${t.color}20` }
                    : { background: 'var(--se-bg)', color: 'var(--se-text-secondary)', border: '1px solid var(--se-border)' })
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!activeConjunto ? (
            <p style={{ textAlign: 'center', color: 'var(--se-text-muted)', padding: '2rem 0' }}>No hay conjuntos disponibles.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {seccionesActivas.map((section, i) => (
                <div key={i}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-secondary)', marginBottom: 10 }}>
                    {section.title} ({section.data?.length || 0})
                  </p>
                  {(section.data?.length || 0) === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', fontStyle: 'italic' }}>Sin parqueaderos</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {section.data.slice().sort((a, b) => (a.numero || '').localeCompare(b.numero || '')).map((p, j) => (
                        <div key={j} style={{
                          borderRadius: 12, padding: '0.5rem',
                          textAlign: 'center', cursor: 'default',
                          border: `2px solid ${p.estado === 'DISPONIBLE' ? section.colorBorder : '#FCA5A5'}`,
                          background: p.estado === 'DISPONIBLE' ? section.colorBg : '#FFF1F2',
                          transition: 'transform 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>{p.numero}</p>
                          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: p.estado === 'DISPONIBLE' ? section.colorText : '#EF4444' }}>
                            {p.estado === 'DISPONIBLE' ? 'Disponible' : 'Ocupado'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showInitModal && initConjuntoTarget && (
        <Modal onClose={() => { setShowInitModal(false); setInitError(null); }} accentColor="var(--se-amber)">
          <ModalHeader
            icon={Car} iconBg="rgba(245,158,11,0.12)" iconColor="var(--se-amber)"
            title="Inicializar parqueaderos"
            subtitle={initConjuntoTarget.nombre}
            onClose={() => { setShowInitModal(false); setInitError(null); }}
          />
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Torres (separadas por coma)</label>
              <input type="text" value={initConfig.torres} onChange={e => setInitConfig({ ...initConfig, torres: e.target.value })} className="se-input" placeholder="A,B,C" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Pisos por torre</label>
                <input type="number" min="1" value={initConfig.pisos} onChange={e => setInitConfig({ ...initConfig, pisos: Number(e.target.value) || 1 })} className="se-input" />
              </div>
              <div>
                <label style={labelStyle}>Aptos por piso</label>
                <input type="number" min="1" value={initConfig.apartamentosPorPiso} onChange={e => setInitConfig({ ...initConfig, apartamentosPorPiso: Number(e.target.value) || 1 })} className="se-input" />
              </div>
            </div>
            <div style={{ padding: '0.875rem', borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <label style={{ ...labelStyle, color: '#7C3AED' }}>Plazas de MOTO para residentes</label>
              <input type="number" min="0" value={initConfig.residenteMoto} onChange={e => setInitConfig({ ...initConfig, residenteMoto: Number(e.target.value) || 0 })} className="se-input" placeholder="Ej: 10" />
              <p style={{ fontSize: '0.7rem', color: '#7C3AED', marginTop: 5 }}>Los carros se crean automáticamente (1 por apartamento). Esta cantidad es adicional para motos.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Visitantes carro</label>
                <input type="number" min="0" value={initConfig.visitanteCarro} onChange={e => setInitConfig({ ...initConfig, visitanteCarro: Number(e.target.value) || 0 })} className="se-input" />
              </div>
              <div>
                <label style={labelStyle}>Visitantes moto</label>
                <input type="number" min="0" value={initConfig.visitanteMoto} onChange={e => setInitConfig({ ...initConfig, visitanteMoto: Number(e.target.value) || 0 })} className="se-input" />
              </div>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 10, background: 'var(--se-amber-dim)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', color: '#92400E' }}>
              <strong>Resumen: </strong>
              <strong>{(initConfig.torres.split(',').filter(Boolean).length) * initConfig.pisos * initConfig.apartamentosPorPiso}</strong> carros residentes +{' '}
              <strong>{initConfig.residenteMoto}</strong> motos residentes +{' '}
              <strong>{initConfig.visitanteCarro}</strong> visitantes carro +{' '}
              <strong>{initConfig.visitanteMoto}</strong> visitantes moto ={' '}
              <strong>{(initConfig.torres.split(',').filter(Boolean).length) * initConfig.pisos * initConfig.apartamentosPorPiso + initConfig.residenteMoto + initConfig.visitanteCarro + initConfig.visitanteMoto}</strong> plazas en total
            </div>
            {initError && (
              <div style={{ padding: '0.625rem', borderRadius: 8, background: 'var(--se-error-dim)', color: 'var(--se-error)', fontSize: '0.8rem', fontWeight: 600 }}>
                {initError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button onClick={() => { setShowInitModal(false); setInitError(null); }} className="se-btn-ghost" style={{ borderRadius: 10 }}>Cancelar</button>
              <button
                disabled={initLoading}
                onClick={async () => {
                  setInitLoading(true);
                  setInitError(null);
                  try {
                    const body = {
                      torres: initConfig.torres.split(',').map(t => t.trim()).filter(Boolean),
                      pisos: Number(initConfig.pisos),
                      apartamentosPorPiso: Number(initConfig.apartamentosPorPiso),
                      residenteMoto: Number(initConfig.residenteMoto),
                      visitanteCarro: Number(initConfig.visitanteCarro),
                      visitanteMoto: Number(initConfig.visitanteMoto),
                    };
                    await api.post(`/parqueaderos/inicializar-conjunto/${initConjuntoTarget._id}`, body);
                    setShowInitModal(false);
                    showToast('Parqueaderos inicializados correctamente', 'success');
                    queryClient.invalidateQueries({ queryKey: ['parqueaderosTorre'] });
                    queryClient.invalidateQueries({ queryKey: ['parqueaderosStats'] });
                  } catch (e) {
                    setInitError(e.response?.data?.error || e.response?.data?.message || e.message);
                  } finally {
                    setInitLoading(false);
                  }
                }}
                className="se-btn-primary"
                style={{ borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)', opacity: initLoading ? 0.6 : 1 }}
              >
                {initLoading ? 'Creando...' : 'Crear parqueaderos'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
