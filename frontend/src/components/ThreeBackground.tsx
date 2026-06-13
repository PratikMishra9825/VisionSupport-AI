"use client";

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Subcomponent: Animated particles
function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 1200;
  const positions = new Float32Array(particleCount * 3);

  // Randomize locations in 3D box
  for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 15; // X
    positions[i + 1] = (Math.random() - 0.5) * 15; // Y
    positions[i + 2] = (Math.random() - 0.5) * 15; // Z
  }

  // Animation logic inside hook
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
      pointsRef.current.rotation.x = state.clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#8b5cf6"
        size={0.035}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ThreeBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="absolute inset-0 bg-black" />;

  return (
    <div className="absolute inset-0 z-0 bg-[#020105]">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <ParticleField />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-tr from-[#020105] via-transparent to-[#0a0518] opacity-90 pointer-events-none" />
    </div>
  );
}
