import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Target, ListChecks, Sigma, TrendingUp, Award, Building, Database, RefreshCw, ChevronDown } from 'lucide-react';
import api from '../services/api';

/**
 * Modelo de Programación Lineal aplicado al sistema Admin Residencial.
 *
 *   x₁ = plazas visitantes para carros
 *   x₂ = plazas visitantes para motos
 *
 *   Max Z = r₁·x₁ + r₂·x₂  (visitantes/día)
 *
 * Todos los parámetros vienen del backend que los calcula desde la BD por conjunto.
 */
export default function ModeloMatematico() {
  const [conjuntos, setConjuntos] = useState([]);
  const [conjuntoId, setConjuntoId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await api.get('/modelo/conjuntos');
        const lista = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
        setConjuntos(lista);
        if (lista.length > 0) setConjuntoId(lista[0]._id);
        else {
          setLoading(false);
          setError('No hay conjuntos activos en la base de datos.');
        }
      } catch (e) {
        const msg = e.response?.status === 404
          ? 'El endpoint /api/modelo no está disponible. Reinicia el servidor backend.'
          : `Error al cargar conjuntos: ${e.response?.data?.message || e.message}`;
        setError(msg);
        setLoading(false);
      }
    })();
  }, []);

  const cargarParametros = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/modelo/parametros/${id}`);
      const payload = resp.data?.parametros ? resp.data : resp.data?.data;
      if (!payload || !payload.parametros) throw new Error('Respuesta sin parámetros');
      setData(payload);
    } catch (e) {
      setError(`Error al obtener parámetros: ${e.response?.data?.message || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarParametros(conjuntoId); }, [conjuntoId]);

  // === Resolución por método gráfico ===
  const { vertices, optimo, lineas, bounds } = useMemo(() => {
    if (!data) return { vertices: [], optimo: null, lineas: [], bounds: { maxX: 10, maxY: 10 } };
    const p = data.parametros;
    const { a1, a2, A, r1, r2, t1, t2, H, x1Min, x2Max } = p;
    const k1 = r1 * t1;
    const k2 = r2 * t2;

    const restricciones = [
      { a: a1, b: a2, c: A,     tipo: '<=' },
      { a: k1, b: k2, c: H,     tipo: '<=' },
      { a: 1,  b: 0,  c: x1Min, tipo: '>=' },
      { a: 0,  b: 1,  c: x2Max, tipo: '<=' },
      { a: 1,  b: 0,  c: 0,     tipo: '>=' },
      { a: 0,  b: 1,  c: 0,     tipo: '>=' },
    ];

    const cumple = (x1, x2) =>
      restricciones.every(({ a, b, c, tipo }) => {
        const v = a * x1 + b * x2;
        return tipo === '<=' ? v <= c + 1e-4 : v >= c - 1e-4;
      });

    const candidatos = [];
    for (let i = 0; i < restricciones.length; i++) {
      for (let j = i + 1; j < restricciones.length; j++) {
        const r = restricciones[i], s = restricciones[j];
        const det = r.a * s.b - s.a * r.b;
        if (Math.abs(det) < 1e-9) continue;
        const x1 = (r.c * s.b - s.c * r.b) / det;
        const x2 = (r.a * s.c - s.a * r.c) / det;
        if (cumple(x1, x2)) candidatos.push({ x1, x2 });
      }
    }

    const unicos = [];
    candidatos.forEach((v) => {
      if (!unicos.some((u) => Math.abs(u.x1 - v.x1) < 1e-3 && Math.abs(u.x2 - v.x2) < 1e-3)) unicos.push(v);
    });
    const cx = unicos.reduce((s, v) => s + v.x1, 0) / Math.max(unicos.length, 1);
    const cy = unicos.reduce((s, v) => s + v.x2, 0) / Math.max(unicos.length, 1);
    unicos.sort((a, b) => Math.atan2(a.x2 - cy, a.x1 - cx) - Math.atan2(b.x2 - cy, b.x1 - cx));

    const vertices = unicos.map((v) => ({
      x1: Math.round(v.x1 * 100) / 100,
      x2: Math.round(v.x2 * 100) / 100,
      z: r1 * v.x1 + r2 * v.x2
    }));
    const optimo = vertices.reduce((best, v) => (!best || v.z > best.z ? v : best), null);

    const lineas = [
      { nombre: `${a1}x₁ + ${a2}x₂ ≤ ${A}  (Área física, m²)`, a: a1, b: a2, c: A, color: '#0EA5E9' },
      { nombre: `${k1.toFixed(2)}x₁ + ${k2.toFixed(2)}x₂ ≤ ${H}  (Horas portero/día)`, a: k1, b: k2, c: H, color: '#EF4444' },
      { nombre: `x₁ ≥ ${x1Min}  (Mínimo plazas carro)`, a: 1, b: 0, c: x1Min, color: '#10B981' },
      { nombre: `x₂ ≤ ${x2Max}  (Máximo plazas moto)`, a: 0, b: 1, c: x2Max, color: '#8B5CF6' }
    ];

    const maxX = Math.max(A / a1, H / Math.max(k1, 0.01), x1Min) * 1.2 || 10;
    const maxY = Math.max(A / a2, H / Math.max(k2, 0.01), x2Max) * 1.15 || 10;
    return { vertices, optimo, lineas, bounds: { maxX, maxY } };
  }, [data]);

  // === SVG helpers ===
  const W = 520, H_ = 460, PAD = 50;
  const sx = (x) => PAD + (x / bounds.maxX) * (W - PAD - 20);
  const sy = (y) => H_ - PAD - (y / bounds.maxY) * (H_ - PAD - 20);
  const lineaPuntos = ({ a, b, c }) => {
    if (Math.abs(b) < 1e-9) return [[c / a, 0], [c / a, bounds.maxY]];
    if (Math.abs(a) < 1e-9) return [[0, c / b], [bounds.maxX, c / b]];
    return [[0, c / b], [c / a, 0], [bounds.maxX, (c - a * bounds.maxX) / b]]
      .filter(([x, y]) => x >= -0.01 && y >= -0.01 && x <= bounds.maxX + 0.01 && y <= bounds.maxY + 0.01)
      .slice(0, 2);
  };
  const fmt = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);

  if (loading && !data) {
    return (
      <div className="se-card p-12 text-center se-fade-in" style={{ borderRadius: 16 }}>
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--se-accent-dim)' }}>
          <RefreshCw size={22} style={{ color: 'var(--se-accent)', animation: 'se-arc-spin 1s linear infinite' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--se-text-secondary)' }}>Cargando parámetros desde la base de datos…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="se-card p-6 se-fade-in" style={{ borderRadius: 16, background: 'var(--se-error-dim)', borderColor: 'rgba(239,68,68,0.2)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--se-error)' }}>{error || 'No hay datos disponibles.'}</p>
      </div>
    );
  }

  const p = data.parametros;
  const est = data.estadoActual;

  return (
    <div className="space-y-6 se-fade-in">

      {/* ── Encabezado + selector de conjunto ── */}
      <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1, #8B5CF6)' }} />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--se-accent-dim)' }}>
                <Calculator size={22} style={{ color: 'var(--se-accent)' }} />
              </div>
              <div>
                <h2 className="se-heading text-xl font-bold" style={{ color: 'var(--se-text-primary)' }}>
                  Modelo — Programación Lineal
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--se-text-muted)' }}>
                  Datos reales por conjunto · Método gráfico
                </p>
              </div>
            </div>

            {/* Selector + refresh */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--se-text-muted)' }} />
                <select
                  value={conjuntoId || ''}
                  onChange={(e) => setConjuntoId(e.target.value)}
                  className="se-input"
                  style={{ paddingLeft: '2rem', paddingRight: '2rem', width: 'auto', fontSize: '0.8rem' }}
                >
                  {conjuntos.map((c) => (
                    <option key={c._id} value={c._id}>{c.nombre}{c.ciudad ? ` — ${c.ciudad}` : ''}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--se-text-muted)' }} />
              </div>
              <button
                onClick={() => cargarParametros(conjuntoId)}
                title="Recargar parámetros"
                style={{
                  width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '0.625rem',
                  background: 'var(--se-accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <RefreshCw size={15} style={loading ? { animation: 'se-arc-spin 0.8s linear infinite' } : {}} />
              </button>
            </div>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--se-text-secondary)' }}>
            Distribuir las plazas de visitantes entre <strong style={{ color: 'var(--se-text-primary)' }}>carros</strong> y{' '}
            <strong style={{ color: 'var(--se-text-primary)' }}>motos</strong> en el conjunto{' '}
            <strong style={{ color: 'var(--se-accent)' }}>{data.conjunto.nombre}</strong> para{' '}
            <strong style={{ color: 'var(--se-text-primary)' }}>maximizar el número de visitantes atendidos al día</strong>,
            respetando el área física, el tiempo del portero y las políticas del conjunto.
          </p>
        </div>
      </div>

      {/* ── Estado actual del conjunto ── */}
      <div className="se-card p-6" style={{ borderRadius: 16, background: 'var(--se-bg)', borderColor: 'var(--se-border)' }}>
        <div className="flex items-center gap-2 mb-5">
          <Database size={16} style={{ color: 'var(--se-text-secondary)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--se-text-primary)' }}>
            Estado actual del conjunto
            <span className="ml-2 se-badge se-badge-accent" style={{ fontSize: '0.65rem' }}>datos reales</span>
          </h3>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
          <Stat label="Visit. Carro"   value={est.x1Actual}             color="var(--se-accent)"   />
          <Stat label="Visit. Moto"    value={est.x2Actual}             color="#8B5CF6"            />
          <Stat label="Priv. Carro"    value={est.plazasPrivadoCarro}   color="var(--se-text-secondary)" />
          <Stat label="Priv. Moto"     value={est.plazasPrivadoMoto}    color="var(--se-text-secondary)" />
          <Stat label="Porteros"       value={est.totalPorteros}        color="var(--se-amber)"    />
          <Stat label="Visit. hoy"     value={est.visitantesHoy}        color="var(--se-success)"  />
        </div>
        <p className="text-xs mt-4 text-center" style={{ color: 'var(--se-text-muted)' }}>
          Visitantes últimos 30 días: <strong>{est.visitantesUltimos30Dias}</strong>
          {' · '}Carros: <strong>{est.entradasCarro30d}</strong>
          {' · '}Motos: <strong>{est.entradasMoto30d}</strong>
          {est.entradasDesconocidas30d > 0 && <> · Sin clasificar: <strong>{est.entradasDesconocidas30d}</strong></>}
        </p>
      </div>

      {/* ── Los 4 componentes del problema ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComponenteCard
          accentColor="#F59E0B"
          titulo="Decisiones"
          icon={Target}
          subtitulo="Variables de decisión"
        >
          <ul className="text-sm space-y-2" style={{ color: 'var(--se-text-secondary)' }}>
            <li><strong style={{ color: 'var(--se-text-primary)' }}>x₁</strong>: plazas visitantes carros</li>
            <li><strong style={{ color: 'var(--se-text-primary)' }}>x₂</strong>: plazas visitantes motos</li>
          </ul>
        </ComponenteCard>

        <ComponenteCard
          accentColor="#0EA5E9"
          titulo="Información"
          icon={Sigma}
          subtitulo="Parámetros (BD)"
        >
          <ul className="text-xs space-y-1.5" style={{ color: 'var(--se-text-secondary)' }}>
            <li>Área total: <strong style={{ color: 'var(--se-text-primary)' }}>{p.A} m²</strong></li>
            <li>Rotación carro: <strong style={{ color: 'var(--se-text-primary)' }}>{p.r1}</strong>/día</li>
            <li>Rotación moto: <strong style={{ color: 'var(--se-text-primary)' }}>{p.r2}</strong>/día</li>
            <li>Tiempo carro/moto: <strong style={{ color: 'var(--se-text-primary)' }}>{p.t1}/{p.t2} h</strong></li>
            <li>Horas portero: <strong style={{ color: 'var(--se-text-primary)' }}>{p.H} h</strong>/día</li>
            <li>Mín carros: <strong style={{ color: 'var(--se-text-primary)' }}>{p.x1Min}</strong> · Máx motos: <strong style={{ color: 'var(--se-text-primary)' }}>{p.x2Max}</strong></li>
          </ul>
        </ComponenteCard>

        <ComponenteCard
          accentColor="#10B981"
          titulo="Condiciones"
          icon={ListChecks}
          subtitulo="Restricciones"
        >
          <ul className="text-xs space-y-1.5 font-mono" style={{ color: 'var(--se-text-secondary)' }}>
            <li>{p.a1}x₁ + {p.a2}x₂ ≤ {p.A}</li>
            <li>{(p.r1 * p.t1).toFixed(2)}x₁ + {(p.r2 * p.t2).toFixed(2)}x₂ ≤ {p.H}</li>
            <li>x₁ ≥ {p.x1Min}</li>
            <li>x₂ ≤ {p.x2Max}</li>
            <li>x₁, x₂ ≥ 0</li>
          </ul>
        </ComponenteCard>

        <ComponenteCard
          accentColor="#6366F1"
          titulo="Propósito"
          icon={TrendingUp}
          subtitulo="Función objetivo"
        >
          <p className="text-xs mb-2" style={{ color: 'var(--se-text-secondary)' }}>Maximizar visitantes/día:</p>
          <p className="font-mono text-sm font-bold" style={{ color: '#6366F1' }}>
            Z = {p.r1}·x₁ + {p.r2}·x₂
          </p>
        </ComponenteCard>
      </div>

      {/* ── Origen de cada parámetro ── */}
      <div className="se-card p-6" style={{ borderRadius: 16 }}>
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--se-text-primary)' }}>
          <Database size={16} style={{ color: 'var(--se-accent)' }} />
          Origen de cada parámetro
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(data.fuentes).map(([k, v]) => (
            <div key={k} className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)' }}>
              <span className="font-mono font-bold text-xs min-w-[2rem]" style={{ color: 'var(--se-accent)' }}>{k}:</span>
              <span className="text-xs" style={{ color: 'var(--se-text-secondary)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Formulación formal ── */}
      <div className="p-6 rounded-2xl shadow-xl" style={{ background: 'var(--se-panel-bg)', border: '1px solid var(--se-panel-border)' }}>
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: '#CBD5E1' }}>
          <Sigma size={16} style={{ color: 'var(--se-accent)' }} />
          Formulación formal
        </h3>
        <div className="font-mono text-sm rounded-xl p-5 leading-loose" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--se-panel-border)' }}>
          <div style={{ color: 'var(--se-amber)' }}>
            Max Z = {p.r1}·x₁ + {p.r2}·x₂
            <span className="ml-2 text-xs" style={{ color: '#64748B' }}>(visitantes / día)</span>
          </div>
          <div className="mt-3" style={{ color: '#94A3B8' }}>Sujeto a:</div>
          <div className="pl-6 space-y-1" style={{ color: '#CBD5E1' }}>
            <div>
              {p.a1}x₁ + {p.a2}x₂ ≤ {p.A}
              <span className="ml-2 text-xs" style={{ color: '#64748B' }}>(área física m²)</span>
            </div>
            <div>
              {(p.r1 * p.t1).toFixed(2)}x₁ + {(p.r2 * p.t2).toFixed(2)}x₂ ≤ {p.H}
              <span className="ml-2 text-xs" style={{ color: '#64748B' }}>(horas portero/día)</span>
            </div>
            <div>
              x₁ ≥ {p.x1Min}
              <span className="ml-2 text-xs" style={{ color: '#64748B' }}>(mínimo plazas carro)</span>
            </div>
            <div>
              x₂ ≤ {p.x2Max}
              <span className="ml-2 text-xs" style={{ color: '#64748B' }}>(máximo plazas moto)</span>
            </div>
            <div>x₁, x₂ ≥ 0</div>
          </div>
        </div>
      </div>

      {/* ── Método gráfico + Vértices ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SVG gráfico */}
        <div className="se-card p-6" style={{ borderRadius: 16 }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--se-text-primary)' }}>
            Método Gráfico
          </h3>
          <svg width={W} height={H_} className="w-full h-auto rounded-xl"
            style={{ background: '#F8FAFC', border: '1px solid var(--se-border)' }}>
            {/* Grid */}
            {Array.from({ length: 11 }).map((_, i) => {
              const x = PAD + (i / 10) * (W - PAD - 20);
              const y = H_ - PAD - (i / 10) * (H_ - PAD - 20);
              return (
                <g key={i}>
                  <line x1={x} y1={PAD - 10} x2={x} y2={H_ - PAD} stroke="#E2E6ED" strokeWidth="0.8" />
                  <line x1={PAD} y1={y} x2={W - 10} y2={y} stroke="#E2E6ED" strokeWidth="0.8" />
                </g>
              );
            })}

            {/* Región factible */}
            {vertices.length >= 3 && (
              <polygon
                points={vertices.map(v => `${sx(v.x1)},${sy(v.x2)}`).join(' ')}
                fill="rgba(14,165,233,0.10)" stroke="rgba(14,165,233,0.5)" strokeWidth="1.5"
              />
            )}

            {/* Líneas de restricción */}
            {lineas.map((L, i) => {
              const pts = lineaPuntos(L);
              if (pts.length < 2) return null;
              return (
                <line key={i}
                  x1={sx(pts[0][0])} y1={sy(pts[0][1])}
                  x2={sx(pts[1][0])} y2={sy(pts[1][1])}
                  stroke={L.color} strokeWidth="2" strokeDasharray="5 3"
                />
              );
            })}

            {/* Vértices */}
            {vertices.map((v, i) => {
              const esOpt = optimo && v.x1 === optimo.x1 && v.x2 === optimo.x2;
              return (
                <g key={i}>
                  <circle
                    cx={sx(v.x1)} cy={sy(v.x2)}
                    r={esOpt ? 9 : 5}
                    fill={esOpt ? 'var(--se-amber)' : 'var(--se-accent)'}
                    stroke="white" strokeWidth="2"
                  />
                  <text x={sx(v.x1) + 12} y={sy(v.x2) - 8} fontSize="11" fill="#0F1923" fontWeight="700">
                    ({v.x1}, {v.x2})
                  </text>
                </g>
              );
            })}

            {/* Ejes */}
            <line x1={PAD} y1={H_ - PAD} x2={W - 10} y2={H_ - PAD} stroke="#0F1923" strokeWidth="2" />
            <line x1={PAD} y1={PAD - 10} x2={PAD}    y2={H_ - PAD} stroke="#0F1923" strokeWidth="2" />
            <text x={W - 80} y={H_ - PAD + 30} fontSize="12" fontWeight="700" fill="#0F1923">x₁ (carros)</text>
            <text x={PAD - 35} y={PAD - 5}    fontSize="12" fontWeight="700" fill="#0F1923">x₂ (motos)</text>

            {/* Escala */}
            {Array.from({ length: 6 }).map((_, i) => {
              const v = (bounds.maxX / 5) * i;
              const vy = (bounds.maxY / 5) * i;
              return (
                <g key={i}>
                  <text x={sx(v)} y={H_ - PAD + 16} fontSize="10" textAnchor="middle" fill="#64748B">{Math.round(v)}</text>
                  <text x={PAD - 8} y={sy(vy) + 4}  fontSize="10" textAnchor="end"    fill="#64748B">{Math.round(vy)}</text>
                </g>
              );
            })}
          </svg>

          {/* Leyenda */}
          <div className="mt-4 space-y-1.5">
            {lineas.map((L, i) => (
              <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--se-text-secondary)' }}>
                <span className="w-6 h-0.5 rounded-full shrink-0" style={{ backgroundColor: L.color, display: 'block' }} />
                {L.nombre}
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: 'var(--se-amber)', border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }} />
              <span className="font-semibold" style={{ color: 'var(--se-text-primary)' }}>Solución óptima</span>
            </div>
          </div>
        </div>

        {/* Vértices + solución óptima */}
        <div className="space-y-5">

          {/* Tabla de vértices */}
          <div className="se-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div className="p-5" style={{ borderBottom: '1px solid var(--se-border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--se-text-primary)' }}>
                Evaluación de vértices
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full se-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Vértice</th>
                    <th style={{ textAlign: 'center' }}>x₁</th>
                    <th style={{ textAlign: 'center' }}>x₂</th>
                    <th style={{ textAlign: 'right' }}>Z = {p.r1}x₁ + {p.r2}x₂</th>
                  </tr>
                </thead>
                <tbody>
                  {vertices.map((v, i) => {
                    const esOpt = optimo && v.x1 === optimo.x1 && v.x2 === optimo.x2;
                    return (
                      <tr key={i} style={esOpt ? { background: 'var(--se-amber-dim)', fontWeight: 700 } : {}}>
                        <td>
                          {String.fromCharCode(65 + i)}
                          {esOpt && <span className="ml-1.5 se-badge se-badge-amber">Óptimo</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{v.x1}</td>
                        <td style={{ textAlign: 'center' }}>{v.x2}</td>
                        <td style={{ textAlign: 'right', color: 'var(--se-success)', fontWeight: 600 }}>
                          {fmt(v.z)} vis/día
                        </td>
                      </tr>
                    );
                  })}
                  {vertices.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--se-error)' }}>
                        Región factible vacía con los datos actuales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card solución óptima */}
          {optimo && (
            <div className="p-6 rounded-2xl shadow-lg" style={{ background: 'var(--se-panel-bg)', border: '1px solid var(--se-panel-border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <Award size={20} style={{ color: 'var(--se-amber)' }} />
                </div>
                <h3 className="se-heading font-bold text-lg" style={{ color: '#F1F5F9' }}>
                  Solución Óptima
                </h3>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <p style={{ color: '#CBD5E1' }}>
                  <strong style={{ color: '#F1F5F9' }}>x₁* = {optimo.x1}</strong> plazas visitantes para carros
                </p>
                <p style={{ color: '#CBD5E1' }}>
                  <strong style={{ color: '#F1F5F9' }}>x₂* = {optimo.x2}</strong> plazas visitantes para motos
                </p>
              </div>

              <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <p className="se-heading text-2xl font-bold" style={{ color: 'var(--se-amber)' }}>
                  Z* = {fmt(optimo.z)} visitantes / día
                </p>
              </div>

              <div className="rounded-xl p-4 text-xs space-y-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="font-semibold mb-1" style={{ color: '#94A3B8' }}>Comparación con la realidad:</p>
                <p style={{ color: '#94A3B8' }}>
                  Config. actual: ({est.x1Actual}, {est.x2Actual}) →{' '}
                  <strong style={{ color: '#CBD5E1' }}>{fmt(p.r1 * est.x1Actual + p.r2 * est.x2Actual)}</strong> visitantes/día (teórico)
                </p>
                <p style={{ color: '#94A3B8' }}>
                  Visitantes registrados hoy: <strong style={{ color: '#CBD5E1' }}>{est.visitantesHoy}</strong>
                </p>
                <p style={{ color: '#94A3B8' }}>
                  Mejora potencial:{' '}
                  <strong style={{ color: 'var(--se-accent)' }}>
                    +{fmt(optimo.z - (p.r1 * est.x1Actual + p.r2 * est.x2Actual))} visitantes/día
                  </strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-componentes ── */

function ComponenteCard({ accentColor, titulo, subtitulo, icon: Icon, children }) {
  return (
    <div className="se-card" style={{ borderRadius: 14, overflow: 'hidden' }}>
      <div className="p-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--se-border)', background: 'var(--se-bg)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}1a` }}>
          <Icon size={17} style={{ color: accentColor }} />
        </div>
        <div>
          <h4 className="font-bold text-sm se-heading" style={{ color: 'var(--se-text-primary)' }}>{titulo}</h4>
          <p className="text-[10px]" style={{ color: 'var(--se-text-muted)' }}>{subtitulo}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className="se-heading text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--se-text-muted)' }}>{label}</p>
    </div>
  );
}
