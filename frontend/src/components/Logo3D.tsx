"use client";

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function RotatingMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * (hovered ? 1.2 : 0.6);
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.2;
      
      // Floating offset
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.1;
    }
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      scale={hovered ? 1.6 : 1.4}
    >
      <dodecahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={hovered ? '#c084fc' : '#60a5fa'}
        wireframe={true}
        transparent={true}
        opacity={0.8}
      />
    </mesh>
  );
}

export default function Logo3D() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-24 h-24 rounded-full border border-blue-500/20" />;

  return (
    <div className="w-32 h-32 cursor-pointer">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={1} />
        <pointLight position={[10, 10, 10]} />
        <RotatingMesh />
      </Canvas>
    </div>
  );
}
