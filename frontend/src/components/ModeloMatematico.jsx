import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Target, ListChecks, Sigma, TrendingUp, Award, Building, Database, RefreshCw } from 'lucide-react';
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

  // === Cargar lista de conjuntos al iniciar ===
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
        console.error('[Modelo] Error /modelo/conjuntos:', e);
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
      console.error('[Modelo] Error /modelo/parametros:', e);
      setError(`Error al obtener parámetros: ${e.response?.data?.message || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarParametros(conjuntoId); }, [conjuntoId]);

  // === Resolución por método gráfico (intersección de pares de restricciones) ===
  const { vertices, optimo, lineas, bounds } = useMemo(() => {
    if (!data) return { vertices: [], optimo: null, lineas: [], bounds: { maxX: 10, maxY: 10 } };
    const p = data.parametros;
    const { a1, a2, A, r1, r2, t1, t2, H, x1Min, x2Max } = p;
    const k1 = r1 * t1;
    const k2 = r2 * t2;

    const restricciones = [
      { a: a1, b: a2, c: A, tipo: '<=' },
      { a: k1, b: k2, c: H, tipo: '<=' },
      { a: 1, b: 0, c: x1Min, tipo: '>=' },
      { a: 0, b: 1, c: x2Max, tipo: '<=' },
      { a: 1, b: 0, c: 0, tipo: '>=' },
      { a: 0, b: 1, c: 0, tipo: '>=' },
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
      { nombre: `${a1}x₁ + ${a2}x₂ ≤ ${A}  (Área física, m²)`, a: a1, b: a2, c: A, color: '#2563eb' },
      { nombre: `${k1.toFixed(2)}x₁ + ${k2.toFixed(2)}x₂ ≤ ${H}  (Horas portero/día)`, a: k1, b: k2, c: H, color: '#dc2626' },
      { nombre: `x₁ ≥ ${x1Min}  (Mínimo plazas carro)`, a: 1, b: 0, c: x1Min, color: '#16a34a' },
      { nombre: `x₂ ≤ ${x2Max}  (Máximo plazas moto)`, a: 0, b: 1, c: x2Max, color: '#9333ea' }
    ];

    const maxX = Math.max(A / a1, H / Math.max(k1, 0.01), x1Min) * 1.2 || 10;
    const maxY = Math.max(A / a2, H / Math.max(k2, 0.01), x2Max) * 1.15 || 10;
    return { vertices, optimo, lineas, bounds: { maxX, maxY } };
  }, [data]);

  // === SVG ===
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
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-12 text-center">
        <RefreshCw className="animate-spin mx-auto text-indigo-500" size={32} />
        <p className="mt-3 text-slate-500">Cargando parámetros desde la BD…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700">
        {error || 'No hay datos disponibles.'}
      </div>
    );
  }

  const p = data.parametros;
  const est = data.estadoActual;

  return (
    <div className="space-y-6">
      {/* Encabezado + selector de conjunto */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100">
              <Calculator className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Modelo Matemático — Programación Lineal</h2>
              <p className="text-sm text-slate-500">Datos reales por conjunto · Método gráfico</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building size={18} className="text-slate-500" />
            <select
              value={conjuntoId || ''}
              onChange={(e) => setConjuntoId(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {conjuntos.map((c) => (
                <option key={c._id} value={c._id}>{c.nombre}{c.ciudad ? ` — ${c.ciudad}` : ''}</option>
              ))}
            </select>
            <button
              onClick={() => cargarParametros(conjuntoId)}
              className="p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
              title="Recargar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Distribuir las plazas de visitantes entre <b>carros</b> y <b>motos</b> en el conjunto{' '}
          <b>{data.conjunto.nombre}</b> para <b>maximizar el número de visitantes atendidos al día</b>,
          respetando el área física, el tiempo del portero y las políticas del conjunto.
        </p>
      </div>

      {/* Estado actual */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="text-slate-600" size={18} />
          <h3 className="font-bold text-slate-700">Estado actual del conjunto (datos reales)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <Stat label="Visit. Carro" value={est.x1Actual} color="text-blue-600" />
          <Stat label="Visit. Moto" value={est.x2Actual} color="text-purple-600" />
          <Stat label="Priv. Carro" value={est.plazasPrivadoCarro} color="text-slate-600" />
          <Stat label="Priv. Moto" value={est.plazasPrivadoMoto} color="text-slate-600" />
          <Stat label="Porteros" value={est.totalPorteros} color="text-amber-600" />
          <Stat label="Visit. hoy" value={est.visitantesHoy} color="text-emerald-600" />
        </div>
        <p className="text-xs text-slate-500 mt-3 text-center">
          Visitantes últimos 30 días: <b>{est.visitantesUltimos30Dias}</b>
          {' · '}Carros: <b>{est.entradasCarro30d}</b>
          {' · '}Motos: <b>{est.entradasMoto30d}</b>
          {est.entradasDesconocidas30d > 0 && <> · Sin clasificar: <b>{est.entradasDesconocidas30d}</b></>}
        </p>
      </div>

      {/* Los 4 componentes del problema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComponenteCard color="from-orange-500 to-amber-500" titulo="Decisiones" icon={Target} subtitulo="Variables de decisión">
          <ul className="text-sm space-y-1.5 text-slate-700">
            <li><b>x₁</b>: plazas visitantes carros</li>
            <li><b>x₂</b>: plazas visitantes motos</li>
          </ul>
        </ComponenteCard>

        <ComponenteCard color="from-yellow-500 to-amber-500" titulo="Información" icon={Sigma} subtitulo="Parámetros (BD)">
          <ul className="text-xs space-y-1 text-slate-700">
            <li>Área total: <b>{p.A} m²</b></li>
            <li>Rotación carro: <b>{p.r1}</b>/día</li>
            <li>Rotación moto: <b>{p.r2}</b>/día</li>
            <li>Tiempo carro/moto: <b>{p.t1}/{p.t2} h</b></li>
            <li>Horas portero: <b>{p.H} h</b>/día</li>
            <li>Mín carros: <b>{p.x1Min}</b> · Máx motos: <b>{p.x2Max}</b></li>
          </ul>
        </ComponenteCard>

        <ComponenteCard color="from-green-500 to-emerald-500" titulo="Condiciones" icon={ListChecks} subtitulo="Restricciones">
          <ul className="text-xs space-y-1 text-slate-700 font-mono">
            <li>{p.a1}x₁ + {p.a2}x₂ ≤ {p.A}</li>
            <li>{(p.r1 * p.t1).toFixed(2)}x₁ + {(p.r2 * p.t2).toFixed(2)}x₂ ≤ {p.H}</li>
            <li>x₁ ≥ {p.x1Min}</li>
            <li>x₂ ≤ {p.x2Max}</li>
            <li>x₁, x₂ ≥ 0</li>
          </ul>
        </ComponenteCard>

        <ComponenteCard color="from-emerald-600 to-teal-600" titulo="Propósito" icon={TrendingUp} subtitulo="Función objetivo">
          <div className="text-sm text-slate-700">
            <p className="mb-1">Maximizar visitantes/día:</p>
            <p className="font-mono text-base font-bold text-emerald-700">Z = {p.r1}·x₁ + {p.r2}·x₂</p>
          </div>
        </ComponenteCard>
      </div>

      {/* Origen de cada parámetro */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Database size={18} className="text-indigo-500" /> Origen de cada parámetro
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {Object.entries(data.fuentes).map(([k, v]) => (
            <div key={k} className="flex gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="font-mono font-bold text-indigo-600 min-w-[2rem]">{k}:</span>
              <span className="text-slate-600 text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formulación formal */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Sigma size={20} className="text-blue-300" /> Formulación formal
        </h3>
        <div className="font-mono text-sm md:text-base bg-black/30 rounded-xl p-5 leading-loose">
          <div className="text-amber-300">Max Z = {p.r1}·x₁ + {p.r2}·x₂ <span className="text-slate-400 text-xs">(visitantes / día)</span></div>
          <div className="mt-3 text-slate-300">Sujeto a:</div>
          <div className="pl-6">
            <div>{p.a1}x₁ + {p.a2}x₂ ≤ {p.A} <span className="text-slate-400 text-xs">(área física m²)</span></div>
            <div>{(p.r1 * p.t1).toFixed(2)}x₁ + {(p.r2 * p.t2).toFixed(2)}x₂ ≤ {p.H} <span className="text-slate-400 text-xs">(horas portero/día)</span></div>
            <div>x₁ ≥ {p.x1Min} <span className="text-slate-400 text-xs">(mínimo plazas carro)</span></div>
            <div>x₂ ≤ {p.x2Max} <span className="text-slate-400 text-xs">(máximo plazas moto)</span></div>
            <div>x₁, x₂ ≥ 0</div>
          </div>
        </div>
      </div>

      {/* Método gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Método Gráfico</h3>
          <svg width={W} height={H_} className="w-full h-auto bg-slate-50 rounded-xl border border-slate-200">
            {Array.from({ length: 11 }).map((_, i) => {
              const x = PAD + (i / 10) * (W - PAD - 20);
              const y = H_ - PAD - (i / 10) * (H_ - PAD - 20);
              return (
                <g key={i}>
                  <line x1={x} y1={PAD - 10} x2={x} y2={H_ - PAD} stroke="#e2e8f0" strokeWidth="0.5" />
                  <line x1={PAD} y1={y} x2={W - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
                </g>
              );
            })}

            {vertices.length >= 3 && (
              <polygon
                points={vertices.map(v => `${sx(v.x1)},${sy(v.x2)}`).join(' ')}
                fill="#6366f1" fillOpacity="0.18" stroke="#6366f1" strokeWidth="2"
              />
            )}

            {lineas.map((L, i) => {
              const pts = lineaPuntos(L);
              if (pts.length < 2) return null;
              return (
                <line key={i}
                  x1={sx(pts[0][0])} y1={sy(pts[0][1])}
                  x2={sx(pts[1][0])} y2={sy(pts[1][1])}
                  stroke={L.color} strokeWidth="2" strokeDasharray="4 3"
                />
              );
            })}

            {vertices.map((v, i) => (
              <g key={i}>
                <circle
                  cx={sx(v.x1)} cy={sy(v.x2)}
                  r={optimo && v.x1 === optimo.x1 && v.x2 === optimo.x2 ? 8 : 5}
                  fill={optimo && v.x1 === optimo.x1 && v.x2 === optimo.x2 ? '#f59e0b' : '#1e293b'}
                  stroke="white" strokeWidth="2"
                />
                <text x={sx(v.x1) + 10} y={sy(v.x2) - 8} fontSize="11" fill="#1e293b" fontWeight="bold">
                  ({v.x1}, {v.x2})
                </text>
              </g>
            ))}

            <line x1={PAD} y1={H_ - PAD} x2={W - 10} y2={H_ - PAD} stroke="#1e293b" strokeWidth="2" />
            <line x1={PAD} y1={PAD - 10} x2={PAD} y2={H_ - PAD} stroke="#1e293b" strokeWidth="2" />
            <text x={W - 80} y={H_ - PAD + 30} fontSize="13" fontWeight="bold" fill="#1e293b">x₁ (carros)</text>
            <text x={PAD - 35} y={PAD - 5} fontSize="13" fontWeight="bold" fill="#1e293b">x₂ (motos)</text>

            {Array.from({ length: 6 }).map((_, i) => {
              const v = (bounds.maxX / 5) * i;
              const vy = (bounds.maxY / 5) * i;
              return (
                <g key={i}>
                  <text x={sx(v)} y={H_ - PAD + 16} fontSize="10" textAnchor="middle" fill="#64748b">{Math.round(v)}</text>
                  <text x={PAD - 8} y={sy(vy) + 4} fontSize="10" textAnchor="end" fill="#64748b">{Math.round(vy)}</text>
                </g>
              );
            })}
          </svg>

          <div className="mt-4 space-y-1.5">
            {lineas.map((L, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-6 h-0.5" style={{ backgroundColor: L.color }} />
                <span className="text-slate-700">{L.nombre}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow" />
              <span className="text-slate-700 font-semibold">Solución óptima</span>
            </div>
          </div>
        </div>

        {/* Vértices + óptimo */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Evaluación de vértices</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="p-2 text-left">Vértice</th>
                    <th className="p-2 text-center">x₁</th>
                    <th className="p-2 text-center">x₂</th>
                    <th className="p-2 text-right">Z = {p.r1}x₁ + {p.r2}x₂</th>
                  </tr>
                </thead>
                <tbody>
                  {vertices.map((v, i) => {
                    const esOpt = optimo && v.x1 === optimo.x1 && v.x2 === optimo.x2;
                    return (
                      <tr key={i} className={esOpt ? 'bg-amber-50 font-bold' : 'border-t border-slate-100'}>
                        <td className="p-2">{String.fromCharCode(65 + i)}{esOpt && ' ★'}</td>
                        <td className="p-2 text-center">{v.x1}</td>
                        <td className="p-2 text-center">{v.x2}</td>
                        <td className="p-2 text-right text-emerald-700">{fmt(v.z)} visitantes/día</td>
                      </tr>
                    );
                  })}
                  {vertices.length === 0 && (
                    <tr><td colSpan="4" className="p-4 text-center text-rose-600">Región factible vacía con los datos actuales</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {optimo && (
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-xl text-white">
              <div className="flex items-center gap-3 mb-3">
                <Award size={28} />
                <h3 className="text-xl font-bold">Solución Óptima</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p><b>x₁* = {optimo.x1}</b> plazas visitantes para carros</p>
                <p><b>x₂* = {optimo.x2}</b> plazas visitantes para motos</p>
                <p className="text-2xl font-bold mt-3 bg-white/10 rounded-xl px-4 py-3">
                  Z* = {fmt(optimo.z)} visitantes / día
                </p>
                <div className="mt-3 p-3 bg-white/10 rounded-xl text-xs space-y-1">
                  <p><b>Comparación con la realidad:</b></p>
                  <p>Configuración actual: ({est.x1Actual}, {est.x2Actual}) → {fmt(p.r1 * est.x1Actual + p.r2 * est.x2Actual)} visitantes/día (teóricos)</p>
                  <p>Visitantes registrados hoy: <b>{est.visitantesHoy}</b></p>
                  <p>Mejora potencial: <b>{fmt(optimo.z - (p.r1 * est.x1Actual + p.r2 * est.x2Actual))} visitantes/día</b></p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComponenteCard({ color, titulo, subtitulo, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
      <div className={`bg-gradient-to-r ${color} p-4 text-white`}>
        <div className="flex items-center gap-2">
          <Icon size={20} />
          <div>
            <h4 className="font-bold">{titulo}</h4>
            <p className="text-xs opacity-90">{subtitulo}</p>
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
