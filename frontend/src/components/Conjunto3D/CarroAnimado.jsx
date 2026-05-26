import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

/**
 * Carro que se anima por una ruta de waypoints.
 * Cuando llega al último waypoint, emite onArrive().
 *
 * Props:
 *  - waypoints: [{x, z}, ...]
 *  - color
 *  - speed (unidades/segundo)
 *  - placa  (texto a mostrar sobre el carro)
 *  - onArrive  callback cuando termina
 */
export default function CarroAnimado({ waypoints, color = '#FBBF24', placa, onArrive, esMoto = false }) {
  const groupRef = useRef();
  const [segIdx, setSegIdx] = useState(0);
  const progressRef = useRef(0);
  const speed = 6.0;

  // Reset cuando cambian los waypoints
  useEffect(() => {
    setSegIdx(0);
    progressRef.current = 0;
    if (groupRef.current && waypoints[0]) {
      groupRef.current.position.x = waypoints[0].x;
      groupRef.current.position.z = waypoints[0].z;
    }
  }, [waypoints]);

  useFrame((_, delta) => {
    if (!groupRef.current || !waypoints || waypoints.length < 2) return;
    if (segIdx >= waypoints.length - 1) return;

    const from = waypoints[segIdx];
    const to   = waypoints[segIdx + 1];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.001) {
      setSegIdx(i => i + 1);
      return;
    }

    progressRef.current += (speed * delta) / dist;

    if (progressRef.current >= 1) {
      groupRef.current.position.x = to.x;
      groupRef.current.position.z = to.z;
      progressRef.current = 0;
      const nextIdx = segIdx + 1;
      setSegIdx(nextIdx);
      if (nextIdx >= waypoints.length - 1 && onArrive) {
        onArrive();
      }
    } else {
      const t = progressRef.current;
      // ease in/out cuadrático
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      groupRef.current.position.x = from.x + dx * eased;
      groupRef.current.position.z = from.z + dz * eased;
      // Rotar hacia el destino
      const targetRot = Math.atan2(dx, dz);
      let diff = targetRot - groupRef.current.rotation.y;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      groupRef.current.rotation.y += diff * Math.min(1, 5 * delta);
    }
  });

  return (
    <group ref={groupRef} position={[waypoints[0]?.x || 0, 0, waypoints[0]?.z || 0]}>
      {esMoto ? <Moto color={color} /> : <Carro color={color} />}

      {/* Etiqueta de placa flotando arriba */}
      {placa && (
        <Html position={[0, 2.4, 0]} center distanceFactor={12} occlude={false}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(8,13,20,0.95), rgba(14,165,233,0.95))',
            border: '1px solid rgba(14,165,233,0.6)',
            color: '#F1F5F9',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.05em',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(14,165,233,0.4)',
            pointerEvents: 'none',
          }}>
            🚗 {placa}
          </div>
        </Html>
      )}

      {/* Spotlight desde arriba */}
      <pointLight position={[0, 4, 0]} intensity={1.5} distance={8} color="#FBBF24" />
    </group>
  );
}

function Carro({ color }) {
  return (
    <>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.6, 0.6, 3.5]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.1, 0.1]} castShadow>
        <boxGeometry args={[1.4, 0.5, 1.8]} />
        <meshStandardMaterial color="#0F172A" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Ruedas */}
      {[[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      {/* Faros */}
      {[-0.5, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.55, -1.7]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#FFFBEB" emissive="#FFFBEB" emissiveIntensity={1.5} />
        </mesh>
      ))}
    </>
  );
}

function Moto({ color }) {
  return (
    <>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 1.7]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      {[[0, 0.75], [0, -0.75]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
    </>
  );
}
