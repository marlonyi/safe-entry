import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

/**
 * Elementos estáticos de la escena: suelo, vía, torres residenciales, barrera.
 */
export default function Escena({ barreraAbierta }) {
  return (
    <>
      {/* Suelo / asfalto */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1E293B" roughness={0.9} />
      </mesh>

      {/* Vía central */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0.01, 1]}>
        <planeGeometry args={[6, 30]} />
        <meshStandardMaterial color="#0F172A" roughness={0.85} />
      </mesh>

      {/* Línea amarilla central discontinua */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0.02, -14 + i * 2.5]}>
          <planeGeometry args={[0.15, 1.2]} />
          <meshBasicMaterial color="#FBBF24" />
        </mesh>
      ))}

      {/* Torres residenciales */}
      <Torre pos={[-22, -15]} altura={6.5} label="Torre A" />
      <Torre pos={[ 0,  -18]} altura={7.5} label="Torre B" />
      <Torre pos={[ 22, -15]} altura={6} label="Torre C" />

      {/* Caseta de portería */}
      <Caseta />

      {/* Barrera animada */}
      <Barrera abierta={barreraAbierta} />

      {/* Letrero entrada */}
      <Text
        position={[-18, 3.5, 22]}
        fontSize={0.6}
        color="#0EA5E9"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#0F172A"
      >
        SAFEENTRY
      </Text>

      {/* Cuadrícula decorativa del suelo */}
      <gridHelper args={[60, 30, '#1E3A5F', '#0D1F33']} position={[0, 0.005, 0]} />

      {/* Letrero "VISITANTES" sobre las plazas frontales */}
      <Text
        position={[-12, 0.1, 7]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#10B981"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        ZONA VISITANTES
      </Text>
      <Text
        position={[-12, 0.1, -9]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#3B82F6"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        ZONA RESIDENTES
      </Text>
    </>
  );
}

function Torre({ pos, altura, label }) {
  const [x, z] = pos;
  return (
    <group position={[x, 0, z]}>
      {/* Cuerpo */}
      <mesh position={[0, altura / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, altura, 5]} />
        <meshStandardMaterial color="#1E3A5F" roughness={0.7} />
      </mesh>
      {/* Techo */}
      <mesh position={[0, altura + 0.2, 0]} castShadow>
        <boxGeometry args={[5.4, 0.4, 5.4]} />
        <meshStandardMaterial color="#0A3D62" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Ventanas frontales */}
      {Array.from({ length: Math.floor(altura / 1.2) }).map((_, row) => (
        [-1.3, 0, 1.3].map((dx, col) => (
          <mesh key={`${row}-${col}`} position={[dx, 1 + row * 1.2, 2.51]}>
            <planeGeometry args={[0.7, 0.85]} />
            <meshStandardMaterial color="#FDE68A" emissive="#FDE68A" emissiveIntensity={0.45} />
          </mesh>
        ))
      ))}
      {/* Etiqueta */}
      <Text
        position={[0, altura + 1, 0]}
        fontSize={0.5}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#0F172A"
      >
        {label}
      </Text>
      {/* Antena con luz */}
      <mesh position={[1.5, altura + 1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.8, 6]} />
        <meshBasicMaterial color="#0EA5E9" />
      </mesh>
      <mesh position={[1.5, altura + 2.0, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#0EA5E9" emissive="#0EA5E9" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Caseta() {
  return (
    <group position={[-22, 0, 22]}>
      {/* Cuerpo */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2.2, 2, 2.2]} />
        <meshStandardMaterial color="#0c1a2e" roughness={0.5} />
      </mesh>
      {/* Techo */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[2.6, 0.18, 2.6]} />
        <meshStandardMaterial color="#0EA5E9" emissive="#0EA5E9" emissiveIntensity={0.3} />
      </mesh>
      {/* Cámara LPR */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 12]} />
        <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.4, 0.2]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={1.5} />
      </mesh>
      {/* Ventana cabina */}
      <mesh position={[0, 1.2, 1.11]}>
        <planeGeometry args={[1.4, 0.8]} />
        <meshStandardMaterial color="#7DD3FC" emissive="#7DD3FC" emissiveIntensity={0.4} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Barrera({ abierta }) {
  const pivotRef = useRef();

  useFrame(() => {
    if (!pivotRef.current) return;
    const target = abierta ? -Math.PI / 2.1 : 0;
    const current = pivotRef.current.rotation.z;
    pivotRef.current.rotation.z = current + (target - current) * 0.08;
  });

  return (
    <group position={[-18, 0, 22]}>
      {/* Poste */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[0.3, 2.5, 0.3]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      {/* Cabeza del poste con luz */}
      <mesh position={[0, 2.65, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial
          color={abierta ? '#10B981' : '#EF4444'}
          emissive={abierta ? '#10B981' : '#EF4444'}
          emissiveIntensity={0.8}
        />
      </mesh>
      {/* Brazo pivotante */}
      <group ref={pivotRef} position={[0.2, 1.85, 0]}>
        <mesh position={[2.2, 0, 0]} castShadow>
          <boxGeometry args={[4.4, 0.15, 0.15]} />
          <meshStandardMaterial color="#FBBF24" />
        </mesh>
        {/* Rayas rojas */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[0.5 + i * 0.9, 0, 0]} castShadow>
            <boxGeometry args={[0.45, 0.17, 0.17]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#EF4444' : '#FFFFFF'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
