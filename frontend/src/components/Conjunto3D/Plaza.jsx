import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

/**
 * Plaza de parqueadero individual.
 * Color según estado: DISPONIBLE (azul/verde), OCUPADO (rojo),
 * RESERVADO (morado), destacada (amarillo pulsante).
 */
export default function Plaza({ pos, plaza, destacada = false, esMoto = false }) {
  const baseRef = useRef();
  const glowRef = useRef();

  const isOcupado    = plaza.estado === 'OCUPADO';
  const isReservado  = plaza.estado === 'RESERVADO';
  const esVisitante  = plaza.categoria === 'VISITANTE';

  const color = useMemo(() => {
    if (destacada) return '#FBBF24';
    if (isOcupado) return '#EF4444';
    if (isReservado) return '#6366F1';
    return esVisitante ? '#10B981' : '#3B82F6';
  }, [destacada, isOcupado, isReservado, esVisitante]);

  useFrame(({ clock }) => {
    if (destacada && baseRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 0.5 + Math.abs(Math.sin(t * 3)) * 0.5;
      baseRef.current.material.opacity = 0.5 + pulse * 0.4;
      if (glowRef.current) {
        glowRef.current.scale.setScalar(1 + pulse * 0.15);
      }
    } else if (baseRef.current) {
      baseRef.current.material.opacity = 0.55;
    }
  });

  const width = esMoto ? 1.3 : 2.3;
  const depth = esMoto ? 2.0 : 4.2;

  // Edges geometry para el marco — usamos useMemo para evitar recrearlo
  const edgesGeo = useMemo(() => {
    return new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, depth));
  }, [width, depth]);

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Plataforma */}
      <mesh ref={baseRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.55}
          roughness={0.7}
          emissive={color}
          emissiveIntensity={destacada ? 0.6 : (isOcupado ? 0.25 : 0.15)}
        />
      </mesh>

      {/* Halo cuando destacada */}
      {destacada && (
        <mesh ref={glowRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(width, depth) * 0.6, Math.max(width, depth) * 0.85, 32]} />
          <meshBasicMaterial color="#FBBF24" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Marco blanco */}
      <lineSegments position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={edgesGeo}>
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.3} />
      </lineSegments>

      {/* Número de plaza */}
      <Text
        position={[0, 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={esMoto ? 0.35 : 0.5}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {plaza.numero}
      </Text>

      {/* Vehículo estacionado */}
      {isOcupado && !esMoto && <CarroEstacionado color={esVisitante ? '#F59E0B' : '#60A5FA'} />}
      {isOcupado && esMoto  && <MotoEstacionada color={esVisitante ? '#F59E0B' : '#60A5FA'} />}
    </group>
  );
}

function CarroEstacionado({ color }) {
  return (
    <group position={[0, 0.4, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.6, 0.6, 3.4]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.85, 0.1]} castShadow>
        <boxGeometry args={[1.3, 0.5, 2.0]} />
        <meshStandardMaterial color="#1E293B" roughness={0.3} metalness={0.7} />
      </mesh>
      {[[-0.8, 1.1], [0.8, 1.1], [-0.8, -1.1], [0.8, -1.1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.22, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
    </group>
  );
}

function MotoEstacionada({ color }) {
  return (
    <group position={[0, 0.3, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.5, 0.4, 1.6]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
      </mesh>
      {[[0, 0.7], [0, -0.7]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.15, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
    </group>
  );
}
