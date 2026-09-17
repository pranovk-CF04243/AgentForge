import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useStore, CameraPreset } from '../../store/useStore';
import { AGENT_MODERN_SEATS } from './seatCoordinates';

// Camera presets tuned for Compact 20m x 16m campus
const PRESETS: Record<CameraPreset, { target: [number, number, number]; zoom: number }> = {
  ALL: { target: [0, 1.0, 0], zoom: 70 },
  ARCHITECTURE: { target: [-5.2, 1.0, -2.5], zoom: 125 },   // Executive Boardroom (Left North)
  DEVELOPMENT: { target: [5.5, 1.0, -4.7], zoom: 120 },     // Engineering Bullpen (Right North)
  QA: { target: [5.5, 1.0, 0.2], zoom: 120 },               // QA & DevOps Bay (Right Mid)
  DEVOPS: { target: [7.5, 1.0, 0.2], zoom: 130 },           // Server Rack & SRE
  SERVER_ROOM: { target: [5.5, 1.0, 5.2], zoom: 120 },      // Support & Analytics (Right South)
  INCIDENT_ROOM: { target: [-6.0, 1.0, 4.6], zoom: 125 },   // Focus Booths & Credenza (Left South)
};

export const CameraController: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraPreset = useStore((state) => state.cameraPreset);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const agents = useStore((state) => state.agents);

  const targetLookAt = useRef(new THREE.Vector3(...PRESETS.ALL.target));
  const targetZoom = useRef(PRESETS.ALL.zoom);
  const isTransitioning = useRef(true);

  useEffect(() => {
    camera.position.set(22, 22, 22);

    if (selectedAgentId && agents[selectedAgentId]) {
      const seat = AGENT_MODERN_SEATS[selectedAgentId];
      const pos = seat ? seat.pos : [0, 0.8, 0];
      targetLookAt.current.set(pos[0], 0.8, pos[2]);
      targetZoom.current = 135;
      isTransitioning.current = true;
    } else if (PRESETS[cameraPreset]) {
      const p = PRESETS[cameraPreset];
      targetLookAt.current.set(...p.target);
      targetZoom.current = p.zoom;
      isTransitioning.current = true;
    }
  }, [cameraPreset, selectedAgentId, agents, camera]);

  useFrame(() => {
    if (isTransitioning.current && camera instanceof THREE.OrthographicCamera) {
      camera.zoom += (targetZoom.current - camera.zoom) * 0.08;
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.08);
        controlsRef.current.update();
      }

      if (
        Math.abs(camera.zoom - targetZoom.current) < 0.3 &&
        controlsRef.current &&
        controlsRef.current.target.distanceTo(targetLookAt.current) < 0.08
      ) {
        isTransitioning.current = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enableRotate={false}
      minZoom={45}
      maxZoom={160}
      enableZoom={true}
      enablePan={true}
    />
  );
};
