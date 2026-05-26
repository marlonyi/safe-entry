import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Maximize2, Minimize2, Activity } from 'lucide-react';
import Escena from './Escena';
import Plaza from './Plaza';
import CarroAnimado from './CarroAnimado';
import { plazaACoordenadas, calcularRuta, ENTRADA, generarPlazasDemo } from './coordinates';

/**
 * Componente principal de la simulación 3D del conjunto residencial.
 *
 * Props:
 *  - parqueaderos: array de plazas reales del backend
 *  - historial:    array de accesos recientes (ordenado por fecha desc)
 *
 * Detecta automáticamente el último acceso de tipo 'entrada' del historial
 * y dispara la animación del carro hasta su plaza asignada.
 */
export default function Conjunto3D({ parqueaderos = [], historial = [] }) {
  const [carroActivo, setCarroActivo] = useState(null); // { placa, waypoints, color, plazaDestino, esMoto }
  const [plazaDestacada, setPlazaDestacada] = useState(null);
  const [barreraAbierta, setBarreraAbierta] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastHistorialIdRef = useRef(null);
  const containerRef = useRef(null);

  // Fallback a demo si no hay parqueaderos reales
  const plazasReales = parqueaderos.length > 0 ? parqueaderos : generarPlazasDemo();

  // Calcular posiciones de cada plaza una sola vez
  const plazasConCoords = useMemo(() => {
    return plazasReales
      .map(p => ({ ...p, coords: plazaACoordenadas(p) }))
      .filter(p => p.coords);
  }, [plazasReales]);

  // ─── Detector de nueva entrada en el historial ────────────────────────────
  useEffect(() => {
    if (!historial || historial.length === 0) return;

    // El historial viene ordenado desc por fecha (lo más reciente primero)
    const ultimo = historial[0];
    if (!ultimo) return;

    const ultimoId = ultimo._id || `${ultimo.placa}-${ultimo.fechaHora}`;

    // Inicializar referencia en el primer render — no animamos accesos previos
    if (lastHistorialIdRef.current === null) {
      lastHistorialIdRef.current = ultimoId;
      return;
    }

    // Ya animamos este evento
    if (lastHistorialIdRef.current === ultimoId) return;

    // Solo animamos eventos de entrada (no salidas)
    if (ultimo.tipoAcceso !== 'entrada') {
      lastHistorialIdRef.current = ultimoId;
      return;
    }

    lastHistorialIdRef.current = ultimoId;

    // Buscar la plaza asignada
    const plaza = plazasConCoords.find(p =>
      p.numero === ultimo.plaza || p._id === ultimo.parqueadero
    );
    if (!plaza) return;

    dispararAnimacion(plaza, ultimo.placa || '???', ultimo.tipoUsuario);
  }, [historial, plazasConCoords]);

  // ─── Dispara la animación del carro ──────────────────────────────────────
  function dispararAnimacion(plaza, placa, tipoUsuario = 'visitante') {
    const waypoints = calcularRuta(plaza);
    const esVisitante = tipoUsuario === 'visitante' || plaza.categoria === 'VISITANTE';
    const color = esVisitante ? '#F59E0B' : '#0EA5E9';
    const esMoto = plaza.coords?.esMoto || false;

    setPlazaDestacada(plaza.numero);
    setBarreraAbierta(true);
    setCarroActivo({ placa, waypoints, color, plazaDestino: plaza.numero, esMoto });

    // Cerrar barrera después de unos segundos
    setTimeout(() => setBarreraAbierta(false), 4500);
  }

  // ─── Demo manual: simular llegada (botón de prueba) ──────────────────────
  function simularLlegada(tipo = 'visitante') {
    if (carroActivo) return; // ya hay un carro animándose
    const categoria = tipo === 'residente' ? 'PRIVADO' : 'VISITANTE';
    const libres = plazasConCoords.filter(p =>
      p.categoria === categoria && p.estado !== 'OCUPADO' && !p.coords?.esMoto
    );
    if (libres.length === 0) return;
    const destino = libres[Math.floor(Math.random() * libres.length)];
    const placa = generarPlaca();
    dispararAnimacion(destino, placa, tipo);
  }

  function onCarroArrive() {
    setTimeout(() => {
      setCarroActivo(null);
      setPlazaDestacada(null);
    }, 1500);
  }

  // ─── Fullscreen toggle ───────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────
  const total = plazasConCoords.length;
  const libres = plazasConCoords.filter(p => p.estado !== 'OCUPADO').length;
  const ocupadas = total - libres;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: fullscreen ? '100vh' : 'clamp(380px, 55vh, 560px)',
        background: 'linear-gradient(135deg, #0c1a2e 0%, #0a2540 100%)',
        borderRadius: fullscreen ? 0 : 16,
        overflow: 'hidden',
        border: '1px solid rgba(14,165,233,0.18)',
      }}
    >
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 10,
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(8,13,20,0.78)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(14,165,233,0.25)',
        borderRadius: 10, padding: '6px 12px',
        pointerEvents: 'none',
      }}>
        <Activity size={14} style={{ color: '#0EA5E9' }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.04em' }}>
          VISTA 3D EN VIVO
        </span>
        <span className="se-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
      </div>

      {/* Stats */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 10,
        display: 'flex', gap: 6,
      }}>
        <Chip label="Total" value={total} color="#0EA5E9" />
        <Chip label="Libres" value={libres} color="#10B981" />
        <Chip label="Ocupadas" value={ocupadas} color="#EF4444" />
      </div>

      {/* Controles inferior */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 10,
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        <button
          onClick={() => simularLlegada('residente')}
          disabled={!!carroActivo}
          style={btnStyle('#3B82F6', !!carroActivo)}
        >
          🚗 Simular Residente
        </button>
        <button
          onClick={() => simularLlegada('visitante')}
          disabled={!!carroActivo}
          style={btnStyle('#10B981', !!carroActivo)}
        >
          🚙 Simular Visitante
        </button>
      </div>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 10,
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(8,13,20,0.78)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(14,165,233,0.3)', color: '#7DD3FC',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
        title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {/* Estado del carro activo */}
      {carroActivo && (
        <div style={{
          position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)',
          zIndex: 10, background: 'rgba(8,13,20,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(245,158,11,0.5)', borderRadius: 10,
          padding: '8px 12px', minWidth: 140,
          boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#FBBF24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            🚗 Vehículo en tránsito
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#F1F5F9', fontFamily: 'monospace', marginTop: 2 }}>
            {carroActivo.placa}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>
            Destino: <span style={{ color: '#FBBF24', fontWeight: 700 }}>{carroActivo.plazaDestino}</span>
          </div>
        </div>
      )}

      {/* Canvas 3D */}
      <Canvas
        shadows
        camera={{ position: [25, 22, 25], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          {/* Fog atmosférico */}
          <fogExp2 attach="fog" args={['#0a1628', 0.018]} />
          <color attach="background" args={['#0c1a2e']} />

          {/* Iluminación */}
          <ambientLight intensity={0.6} color="#cbd5e1" />
          <directionalLight
            position={[20, 30, 15]}
            intensity={1.4}
            color="#fef3c7"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
            shadow-camera-near={0.1}
            shadow-camera-far={80}
          />
          <directionalLight position={[-20, 15, -10]} intensity={0.4} color="#0EA5E9" />
          <pointLight position={[0, 8, 0]} intensity={0.5} color="#6366F1" distance={30} />

          {/* Escena estática */}
          <Escena barreraAbierta={barreraAbierta} />

          {/* Plazas */}
          {plazasConCoords.map(p => (
            <Plaza
              key={p._id || p.numero}
              pos={p.coords}
              plaza={p}
              destacada={plazaDestacada === p.numero}
              esMoto={p.coords?.esMoto}
            />
          ))}

          {/* Carro animado activo */}
          {carroActivo && (
            <CarroAnimado
              waypoints={carroActivo.waypoints}
              color={carroActivo.color}
              placa={carroActivo.placa}
              esMoto={carroActivo.esMoto}
              onArrive={onCarroArrive}
            />
          )}

          {/* Controles orbit (sin auto-rotate por defecto, el usuario controla) */}
          <OrbitControls
            target={[0, 0, 0]}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={15}
            maxDistance={50}
            dampingFactor={0.08}
            enableDamping
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Chip({ label, value, color }) {
  return (
    <div style={{
      background: 'rgba(8,13,20,0.78)', backdropFilter: 'blur(8px)',
      border: `1px solid ${color}30`,
      borderRadius: 8, padding: '4px 10px',
      textAlign: 'center', minWidth: 50,
    }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function btnStyle(color, disabled) {
  return {
    background: disabled ? 'rgba(100,116,139,0.3)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: '#fff', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '6px 12px', borderRadius: 8,
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em',
    boxShadow: disabled ? 'none' : `0 4px 12px ${color}40`,
    opacity: disabled ? 0.55 : 1,
    transition: 'all 0.2s',
  };
}

function generarPlaca() {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${L[Math.floor(Math.random() * 26)]}${L[Math.floor(Math.random() * 26)]}${L[Math.floor(Math.random() * 26)]}${Math.floor(Math.random() * 900) + 100}`;
}
