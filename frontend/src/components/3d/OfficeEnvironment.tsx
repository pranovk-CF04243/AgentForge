import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Modern Architectural Oak Plank Floor Texture
function createModernOakFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = '#d4a373';
  ctx.fillRect(0, 0, 512, 512);

  const plankH = 32;
  ctx.strokeStyle = '#b8814d';
  ctx.lineWidth = 1.5;

  for (let y = 0; y < 512; y += plankH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    const offset = (y / plankH) % 2 === 0 ? 0 : 80;
    for (let x = offset; x < 512; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankH);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#e6b98a';
  for (let i = 0; i < 40; i++) {
    const gx = Math.random() * 500;
    const gy = Math.random() * 500;
    ctx.fillRect(gx, gy, 40 + Math.random() * 60, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  return texture;
}

// 2. High-Res Screen Textures
function createScreenTexture(type: 'CODE' | 'JIRA' | 'GRAFANA' | 'PRESENTATION' | 'TERMINAL') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 144);

  if (type === 'PRESENTATION') {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, 12, 140, 8);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(20, 52, 216, 6);

    const cards = [20, 95, 170];
    cards.forEach((cx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx, 70, 65, 58);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(cx + 6, 76, 30, 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cx + 6, 86, 50, 3);
      ctx.fillRect(cx + 6, 94, 40, 3);
    });
  } else if (type === 'CODE') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 16);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(8, 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(16, 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(24, 8, 3, 0, Math.PI * 2); ctx.fill();

    const colors = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#cbd5e1'];
    for (let y = 24; y < 136; y += 8) {
      const indent = (y % 32 === 0) ? 12 : (y % 16 === 0) ? 24 : 36;
      const len = 30 + Math.sin(y * 7) * 80 + 50;
      ctx.fillStyle = colors[Math.floor((y / 8) % colors.length)];
      ctx.fillRect(indent, y, Math.max(25, len), 4);
    }
  } else if (type === 'GRAFANA') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 16, 110, 56);
    ctx.fillRect(135, 16, 110, 56);
    ctx.fillRect(10, 80, 235, 54);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 55); ctx.lineTo(40, 40); ctx.lineTo(65, 48); ctx.lineTo(90, 25); ctx.lineTo(115, 32);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 120); ctx.lineTo(60, 105); ctx.lineTo(120, 112); ctx.lineTo(180, 92); ctx.lineTo(235, 98);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 22, 70, 115);
    ctx.fillRect(90, 22, 70, 115);
    ctx.fillRect(170, 22, 70, 115);
  }

  return new THREE.CanvasTexture(canvas);
}

// 2b. Atmospheric Metropolis Skyline Texture for Panoramic Windows
function createSkylineTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Sky gradient: Crisp daylight with golden horizon glow
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0, '#0369a1');     // Azure sky
  skyGrad.addColorStop(0.35, '#38bdf8');  // Soft daylight cyan
  skyGrad.addColorStop(0.72, '#bae6fd');  // Light atmospheric haze
  skyGrad.addColorStop(0.90, '#ffedd5');  // Warm golden horizon haze
  skyGrad.addColorStop(1.0, '#fed7aa');   // Distant horizon glow
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft distant clouds / atmospheric blur
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(300, 350, 240, 45, 0, 0, Math.PI * 2);
  ctx.ellipse(750, 370, 280, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  // Far-background Skyscrapers (soft misty blue silhouettes)
  ctx.fillStyle = '#64748b';
  const farTowers = [
    { x: 35, w: 60, h: 220 }, { x: 130, w: 90, h: 270 }, { x: 250, w: 60, h: 190 },
    { x: 340, w: 100, h: 310 }, { x: 470, w: 80, h: 240 }, { x: 580, w: 110, h: 330 },
    { x: 710, w: 75, h: 220 }, { x: 810, w: 90, h: 290 }, { x: 920, w: 85, h: 260 }
  ];
  farTowers.forEach((t) => {
    ctx.fillRect(t.x, 512 - t.h, t.w, t.h);
    ctx.fillRect(t.x + t.w / 2 - 1, 512 - t.h - 30, 2, 30);
  });

  // Mid-ground Modern High-Rises with Architectural Glass & Micro Windows
  ctx.fillStyle = '#1e293b';
  const midTowers = [
    { x: 0, w: 75, h: 300 }, { x: 90, w: 85, h: 360 }, { x: 195, w: 110, h: 280 },
    { x: 325, w: 80, h: 400 }, { x: 425, w: 100, h: 330 }, { x: 545, w: 90, h: 430 },
    { x: 655, w: 110, h: 350 }, { x: 785, w: 85, h: 390 }, { x: 890, w: 105, h: 320 }
  ];
  midTowers.forEach((t) => {
    ctx.fillRect(t.x, 512 - t.h, t.w, t.h);

    // Glowing micro office windows
    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
    for (let wy = 512 - t.h + 20; wy < 490; wy += 14) {
      for (let wx = t.x + 8; wx < t.x + t.w - 8; wx += 12) {
        if (Math.sin(wx * 13 + wy * 19) > -0.15) {
          ctx.fillRect(wx, wy, 6, 6);
        }
      }
    }
    // Glass reflection stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(t.x + 10, 512 - t.h);
    ctx.lineTo(t.x + 35, 512 - t.h);
    ctx.lineTo(t.x + 15, 512);
    ctx.lineTo(t.x - 10, 512);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
  });

  // Blinking red beacons on tops of tallest skyscrapers
  ctx.fillStyle = '#ef4444';
  [132, 365, 590, 827].forEach((bx) => {
    ctx.beginPath();
    ctx.arc(bx, 512 - 435, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 3. Modern Ultrawide Curved LED Monitor
const ModernUltrawideMonitor: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  type?: 'CODE' | 'JIRA' | 'GRAFANA' | 'TERMINAL';
}> = ({ position, rotation = [0, 0, 0], type = 'CODE' }) => {
  const screenTex = useMemo(() => createScreenTexture(type), [type]);

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.015, 0]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.22, -0.06]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.42, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.92, 0.46, 0.025]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.36, 0.015]}>
        <planeGeometry args={[0.89, 0.43]} />
        <meshStandardMaterial
          map={screenTex}
          emissive="#38bdf8"
          emissiveIntensity={0.3}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
};

// 4. Modern Workstation Desk Component
export const ModernDesk: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  depth?: number;
  monitorType?: 'CODE' | 'JIRA' | 'GRAFANA' | 'TERMINAL';
}> = ({ position, rotation = [0, 0, 0], width = 1.5, depth = 0.8, monitorType = 'CODE' }) => {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color="#b47846" roughness={0.5} />
      </mesh>

      <mesh position={[-width / 2 + 0.06, 0.35, 0]} castShadow>
        <boxGeometry args={[0.04, 0.7, depth - 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[width / 2 - 0.06, 0.35, 0]} castShadow>
        <boxGeometry args={[0.04, 0.7, depth - 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Desk Mat */}
      <mesh position={[0, 0.745, 0.06]} receiveShadow>
        <boxGeometry args={[0.78, 0.005, 0.38]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Keyboard */}
      <mesh position={[0, 0.752, 0.12]} castShadow>
        <boxGeometry args={[0.38, 0.01, 0.13]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Mouse */}
      <mesh position={[0.26, 0.755, 0.12]} castShadow>
        <boxGeometry args={[0.06, 0.02, 0.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Monitor */}
      <ModernUltrawideMonitor
        position={[0, 0.745, -depth / 2 + 0.22]}
        type={monitorType}
      />
    </group>
  );
};

// 5. Collaborative Team Pod Container
const TeamPodModule: React.FC<{
  position: [number, number, number];
  width: number;
  depth: number;
  title: string;
  badgeColor?: string;
}> = ({ position, width, depth, title, badgeColor = '#38bdf8' }) => (
  <group position={position}>
    <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width + 0.2, depth + 0.2]} />
      <meshStandardMaterial color="#64748b" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
    </mesh>

    <group position={[0, 1.25, -depth / 2]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.2, 0.28, 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[3.2, 0.04, 0.05]} />
        <meshBasicMaterial color={badgeColor} />
      </mesh>
      <pointLight position={[0, 0.2, 0.2]} intensity={0.8} distance={2.5} color={badgeColor} />
    </group>
  </group>
);

// 6. Privacy Focus Soundproof Phone Booth (Bottom-Left)
const FocusPhoneBooth: React.FC<{ position: [number, number, number]; label: string }> = ({ position, label }) => {
  return (
    <group position={position}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.2, 2.2, 1.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>

      <mesh position={[0, 1.1, 0.05]}>
        <boxGeometry args={[1.05, 2.05, 1.05]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {[-0.4, -0.2, 0, 0.2, 0.4].map((sx, i) => (
        <mesh key={i} position={[-0.61, 1.1, sx]} castShadow>
          <boxGeometry args={[0.02, 2.0, 0.08]} />
          <meshStandardMaterial color="#b47846" roughness={0.6} />
        </mesh>
      ))}

      <mesh position={[0, 1.05, 0.58]}>
        <planeGeometry args={[0.95, 1.95]} />
        <meshPhysicalMaterial color="#38bdf8" transmission={0.85} opacity={0.35} transparent roughness={0.1} />
      </mesh>
      <mesh position={[0.38, 1.05, 0.61]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>

      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[0.8, 0.03, 0.4]} />
        <meshStandardMaterial color="#b47846" />
      </mesh>
      <mesh position={[0, 0.45, 0.2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 16]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
      <mesh position={[0, 0.22, 0.2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.44, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} />
      </mesh>

      <pointLight position={[0, 2.0, 0]} intensity={1.2} distance={3} color="#fef08a" />

      <mesh position={[0, 2.15, 0.61]}>
        <boxGeometry args={[0.7, 0.12, 0.02]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
};

// 6b. Modern Minimalist Linear Pendant Luminaire
export const LinearPendantLuminaire: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  length?: number;
  lightColor?: string;
  lightIntensity?: number;
}> = ({ position, rotationY = 0, length = 3.2, lightColor = '#ffffff', lightIntensity = 0.9 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Dual Aircraft Suspension Cables extending up toward ceiling */}
      <mesh position={[-length / 2 + 0.35, 0.55, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 1.1, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[length / 2 - 0.35, 0.55, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 1.1, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Sleek Matte Black Extruded Aluminum Housing */}
      <mesh castShadow>
        <boxGeometry args={[length, 0.06, 0.09]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Frosted Acrylic LED Diffuser Channel */}
      <mesh position={[0, -0.031, 0]}>
        <boxGeometry args={[length - 0.06, 0.006, 0.07]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={lightColor}
          emissiveIntensity={0.85}
          roughness={0.1}
        />
      </mesh>

      {/* Diffused Downward Task Illumination */}
      <pointLight position={[0, -0.25, 0]} intensity={lightIntensity} distance={5.5} color={lightColor} />
    </group>
  );
};

// 7. Executive Glass Boardroom with Full Architectural Enclosure & Sightlines
const ExecutiveBoardroom: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const presentationTex = useMemo(() => createScreenTexture('PRESENTATION'), []);

  return (
    <group position={position}>
      {/* ── Executive Wool-Blend Acoustic Inset Area Rug ── */}
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[5.6, 0.005, 5.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[5.4, 0.006, 5.0]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} />
      </mesh>

      {/* ── North Feature Wall: Full-Height Architectural Media Wall (Height 3.0m) ── */}
      <group position={[0, 0, -2.7]}>
        {/* Full-Height Acoustic Slat Wall */}
        <mesh position={[0, 1.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.8, 2.9, 0.08]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        {/* Dark Walnut Accent Panel behind TV */}
        <mesh position={[0, 1.45, 0.045]} castShadow receiveShadow>
          <boxGeometry args={[3.8, 2.7, 0.02]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
        {/* Corner Structural Columns */}
        <mesh position={[-2.87, 1.45, 0]} castShadow>
          <boxGeometry args={[0.07, 2.9, 0.07]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        <mesh position={[2.87, 1.45, 0]} castShadow>
          <boxGeometry args={[0.07, 2.9, 0.07]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>

        {/* Executive Media Console / Credenza below TV */}
        <group position={[0, 0.40, 0.22]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3.2, 0.80, 0.36]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.41, 0]}>
            <boxGeometry args={[3.24, 0.02, 0.38]} />
            <meshStandardMaterial color="#78350f" roughness={0.3} metalness={0.1} />
          </mesh>
        </group>

        {/* Heavy-Duty Wall Mount Bracket holding TV */}
        <mesh position={[0, 2.05, 0.07]}>
          <boxGeometry args={[1.2, 0.8, 0.04]} />
          <meshStandardMaterial color="#020617" metalness={0.9} />
        </mesh>

        {/* Large 4K Presentation TV firmly mounted on Wall */}
        <group position={[0, 2.05, 0.12]}>
          <mesh castShadow>
            <boxGeometry args={[2.6, 1.4, 0.05]} />
            <meshStandardMaterial color="#020617" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.028]}>
            <planeGeometry args={[2.52, 1.32]} />
            <meshStandardMaterial
              map={presentationTex}
              emissive="#38bdf8"
              emissiveIntensity={0.4}
              roughness={0.2}
            />
          </mesh>
        </group>
      </group>

      {/* ── West Architectural Wall with Strategy Whiteboard (Height 3.0m) ── */}
      <group position={[-2.9, 0, 0]}>
        {/* Floor Base Sill Track */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.08, 0.06, 5.4]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Top Header Track */}
        <mesh position={[0, 2.87, 0]}>
          <boxGeometry args={[0.08, 0.06, 5.4]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Full-Height Acoustic Glass Wall */}
        <mesh position={[0, 1.45, 0]} castShadow>
          <boxGeometry args={[0.04, 2.78, 5.4]} />
          <meshPhysicalMaterial color="#38bdf8" transmission={0.90} opacity={0.20} transparent roughness={0.1} />
        </mesh>
        {/* Vertical Architectural Mullions */}
        <mesh position={[0, 1.45, -0.9]}>
          <boxGeometry args={[0.06, 2.8, 0.04]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        <mesh position={[0, 1.45, 0.9]}>
          <boxGeometry args={[0.06, 2.8, 0.04]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>

        {/* Boardroom Strategy Whiteboard mounted securely with heavy standoffs */}
        <group position={[0.05, 1.55, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[2.4, 1.2, 0.025]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} opacity={0.95} />
          </mesh>
          {/* Heavy Standoffs anchored into the wall */}
          <mesh position={[-1.1, 0.50, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.06, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.9} /></mesh>
          <mesh position={[1.1, 0.50, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.06, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.9} /></mesh>
          <mesh position={[-1.1, -0.50, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.06, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.9} /></mesh>
          <mesh position={[1.1, -0.50, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.06, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.9} /></mesh>
          {/* Sticky Notes on Board */}
          <mesh position={[-0.8, 0.28, 0.018]}><planeGeometry args={[0.16, 0.16]} /><meshBasicMaterial color="#facc15" /></mesh>
          <mesh position={[-0.58, 0.28, 0.018]}><planeGeometry args={[0.16, 0.16]} /><meshBasicMaterial color="#4ade80" /></mesh>
          <mesh position={[-0.36, 0.28, 0.018]}><planeGeometry args={[0.16, 0.16]} /><meshBasicMaterial color="#38bdf8" /></mesh>
          <mesh position={[-0.14, 0.28, 0.018]}><planeGeometry args={[0.16, 0.16]} /><meshBasicMaterial color="#f472b6" /></mesh>
          {/* Architecture Chart Sketch lines */}
          <mesh position={[0.45, 0, 0.018]}>
            <planeGeometry args={[1.0, 0.7]} />
            <meshBasicMaterial color="#0f172a" opacity={0.75} transparent />
          </mesh>
          {/* Dry Erase Marker Tray */}
          <mesh position={[0, -0.62, 0.04]} castShadow>
            <boxGeometry args={[1.5, 0.025, 0.06]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
          <mesh position={[-0.2, -0.60, 0.04]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 0.12, 8]} /><meshBasicMaterial color="#ef4444" /></mesh>
          <mesh position={[0, -0.60, 0.04]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>
          <mesh position={[0.2, -0.60, 0.04]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 0.12, 8]} /><meshBasicMaterial color="#0f172a" /></mesh>
        </group>
      </group>

      {/* ── South Full-Height Architectural Glass Wall (Height 3.0m) ── */}
      <group position={[0, 0, 2.7]}>
        {/* Floor Base Sill Track */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[5.8, 0.06, 0.08]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Top Ceiling Header Beam */}
        <mesh position={[0, 2.87, 0]}>
          <boxGeometry args={[5.8, 0.06, 0.08]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Corner Structural Columns */}
        <mesh position={[-2.87, 1.45, 0]} castShadow>
          <boxGeometry args={[0.07, 2.9, 0.07]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        <mesh position={[2.87, 1.45, 0]} castShadow>
          <boxGeometry args={[0.07, 2.9, 0.07]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        {/* Full-Height Crystal Clear Architectural Glass */}
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[5.8, 2.78, 0.03]} />
          <meshPhysicalMaterial
            color="#e0f2fe"
            transmission={0.94}
            opacity={0.16}
            transparent
            roughness={0.06}
            reflectivity={0.5}
          />
        </mesh>
        {/* Vertical Silicon Glazing Joint Mullions */}
        <mesh position={[-1.93, 1.45, 0]}>
          <boxGeometry args={[0.02, 2.78, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.8} opacity={0.6} transparent />
        </mesh>
        <mesh position={[1.93, 1.45, 0]}>
          <boxGeometry args={[0.02, 2.78, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.8} opacity={0.6} transparent />
        </mesh>
      </group>

      {/* ── East Full-Height Architectural Glass Wall with 1.6m Doorway (Height 3.0m) ── */}
      <group position={[2.9, 0, 0]}>
        {/* Top Header Beam across full 5.4m */}
        <mesh position={[0, 2.87, 0]}>
          <boxGeometry args={[0.08, 0.06, 5.4]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Doorway Portal Posts */}
        <mesh position={[0, 1.45, -0.8]}>
          <boxGeometry args={[0.06, 2.8, 0.06]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        <mesh position={[0, 1.45, 0.8]}>
          <boxGeometry args={[0.06, 2.8, 0.06]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Doorway Floor Threshold */}
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[0.18, 0.015, 1.6]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>

        {/* North Glass Section (z: -2.7 to -0.8, length 1.9m) */}
        <group position={[0, 0, -1.75]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.08, 0.06, 1.9]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[0.03, 2.78, 1.9]} />
            <meshPhysicalMaterial
              color="#e0f2fe"
              transmission={0.94}
              opacity={0.16}
              transparent
              roughness={0.06}
              reflectivity={0.5}
            />
          </mesh>
        </group>

        {/* South Glass Section (z: 0.8 to 2.7, length 1.9m) */}
        <group position={[0, 0, 1.75]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.08, 0.06, 1.9]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[0.03, 2.78, 1.9]} />
            <meshPhysicalMaterial
              color="#e0f2fe"
              transmission={0.94}
              opacity={0.16}
              transparent
              roughness={0.06}
              reflectivity={0.5}
            />
          </mesh>
        </group>
      </group>

      {/* ── UPGRADED BEVELED EXECUTIVE CONFERENCE TABLE (Centered at z = 0.3) ── */}
      <group position={[0, 0, 0.3]}>
        {/* Beveled Polished Walnut Tabletop (3.1m x 1.4m) */}
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.1, 0.06, 1.4]} />
          <meshStandardMaterial color="#78350f" roughness={0.3} metalness={0.08} />
        </mesh>
        {/* Chamfer Bevel Highlight Layer */}
        <mesh position={[0, 0.752, 0]}>
          <boxGeometry args={[3.04, 0.005, 1.34]} />
          <meshStandardMaterial color="#92400e" roughness={0.4} />
        </mesh>

        {/* Central Brushed Slate Cable Raceway Trough */}
        <mesh position={[0, 0.755, 0]}>
          <boxGeometry args={[1.6, 0.005, 0.22]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Triangular Teleconference Speaker Puck with Glowing Green LED ring */}
        <group position={[0, 0.765, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.025, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.015, 0]}>
            <torusGeometry args={[0.07, 0.008, 8, 24]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>

        {/* Sculpted Matte Pedestal Legs */}
        <mesh position={[-0.95, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.7, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[-0.95, 0.015, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[0.95, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.7, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[0.95, 0.015, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>

        {/* ── 3 Open Unibody Laptops Aligned with Seated Attendees ── */}
        {/* 1. South Head Laptop (for Dr. Marcus Cole, Team Lead) */}
        <group position={[0, 0.76, 0.44]}>
          <mesh position={[0, 0.006, 0]} castShadow>
            <boxGeometry args={[0.28, 0.012, 0.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.095, -0.1]} rotation={[-0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.28, 0.18, 0.008]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glowing Laptop Screen facing South (+Z) towards Marcus */}
          <mesh position={[0, 0.095, -0.094]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* Leather Blotter Pad under Laptop */}
          <mesh position={[0, -0.002, 0.04]}>
            <boxGeometry args={[0.48, 0.004, 0.34]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Crystal Water Glass */}
          <mesh position={[0.32, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.03, 0.1, 12]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.95} opacity={0.6} transparent roughness={0.05} />
          </mesh>
        </group>

        {/* 2. West Flank Laptop (for Orion Spark, BA Agent) */}
        <group position={[-1.18, 0.76, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[0, 0.006, 0]} castShadow>
            <boxGeometry args={[0.28, 0.012, 0.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.095, -0.1]} rotation={[-0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.28, 0.18, 0.008]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glowing Laptop Screen facing West (-X) towards Orion */}
          <mesh position={[0, 0.095, -0.094]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshBasicMaterial color="#a855f7" />
          </mesh>
          {/* Leather Blotter Pad under Laptop */}
          <mesh position={[-0.04, -0.002, 0]}>
            <boxGeometry args={[0.34, 0.004, 0.48]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Crystal Water Glass */}
          <mesh position={[0, 0.05, 0.32]} castShadow>
            <cylinderGeometry args={[0.035, 0.03, 0.1, 12]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.95} opacity={0.6} transparent roughness={0.05} />
          </mesh>
        </group>

        {/* 3. East Flank Laptop (for Seraphina Stone, Jira Agent) */}
        <group position={[1.18, 0.76, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.006, 0]} castShadow>
            <boxGeometry args={[0.28, 0.012, 0.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.095, -0.1]} rotation={[-0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.28, 0.18, 0.008]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glowing Laptop Screen facing East (+X) towards Seraphina */}
          <mesh position={[0, 0.095, -0.094]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.26, 0.16]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          {/* Leather Blotter Pad under Laptop */}
          <mesh position={[0.04, -0.002, 0]}>
            <boxGeometry args={[0.34, 0.004, 0.48]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Crystal Water Glass */}
          <mesh position={[0, 0.05, 0.32]} castShadow>
            <cylinderGeometry args={[0.035, 0.03, 0.1, 12]} />
            <meshPhysicalMaterial color="#ffffff" transmission={0.95} opacity={0.6} transparent roughness={0.05} />
          </mesh>
        </group>
      </group>

      {/* Warm Ambient Boardroom Spotlight */}
      <pointLight position={[0, 3.0, 0]} intensity={2.0} distance={6} color="#fffbeb" />
    </group>
  );
};

// 8. Server Rack in DevOps Bay
const ServerRack: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.65, 1.8, 0.7]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.9, 0.36]}>
        <planeGeometry args={[0.58, 1.7]} />
        <meshPhysicalMaterial color="#38bdf8" transmission={0.7} opacity={0.35} transparent roughness={0.2} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={i} position={[0, 0.22 + i * 0.18, 0.33]}>
          <mesh position={[-0.2, 0, 0]}><boxGeometry args={[0.03, 0.03, 0.01]} /><meshBasicMaterial color="#10b981" /></mesh>
          <mesh position={[-0.14, 0, 0]}><boxGeometry args={[0.03, 0.03, 0.01]} /><meshBasicMaterial color="#38bdf8" /></mesh>
        </group>
      ))}
    </group>
  );
};

// ── 9. MASTER COMPACT OFFICE ENVIRONMENT (20m x 16m) ──────────────────────────
export const OfficeEnvironment: React.FC = () => {
  const floorTexture = useMemo(() => createModernOakFloorTexture(), []);
  const skylineTexture = useMemo(() => createSkylineTexture(), []);

  // Curtain wall mullion Z positions every 1.55m
  const mullionPositions = useMemo(() => {
    const pos = [];
    for (let z = -7.4; z <= 7.4; z += 1.48) {
      pos.push(z);
    }
    return pos;
  }, []);

  return (
    <group>
      {/* 1. COMPACT OFFICE FLOOR (20m x 16m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial map={floorTexture} roughness={0.4} metalness={0.05} />
      </mesh>

      {/* 2. ARCHITECTURAL WALLS & SKYLINE */}
      {/* North Wall */}
      <mesh position={[0, 2.0, -8.0]} receiveShadow>
        <boxGeometry args={[20, 4.0, 0.4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* North Wall Acoustic Wood Slats Feature (Behind Boardroom & Engineering) */}
      <mesh position={[-5.2, 2.0, -7.78]} castShadow receiveShadow>
        <boxGeometry args={[5.2, 3.8, 0.04]} />
        <meshStandardMaterial color="#78350f" roughness={0.6} />
      </mesh>
      <mesh position={[5.5, 2.0, -7.78]} castShadow receiveShadow>
        <boxGeometry args={[7.6, 3.8, 0.04]} />
        <meshStandardMaterial color="#78350f" roughness={0.6} />
      </mesh>

      {/* Upper Architectural Warm LED Cove Strip */}
      <mesh position={[0, 3.85, -7.76]}>
        <boxGeometry args={[19.6, 0.03, 0.03]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.8} />
      </mesh>

      {/* West Wall Outer Shell */}
      <mesh position={[-10.0, 2.0, 0]} receiveShadow>
        <boxGeometry args={[0.4, 4.0, 16]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.9} />
      </mesh>

      {/* ── PANORAMIC HIGH-RISE SKYLINE CURTAIN WALL (West Wall: x = -10 to -9.8) ── */}
      {/* High-Rise City Skyline Backdrop Plane */}
      <mesh position={[-9.94, 2.0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[15.6, 3.85]} />
        <meshBasicMaterial map={skylineTexture} />
      </mesh>

      {/* Ultra-Clear Architectural Glazing */}
      <mesh position={[-9.84, 1.95, 0]}>
        <boxGeometry args={[0.02, 3.7, 15.4]} />
        <meshPhysicalMaterial
          color="#e0f2fe"
          transmission={0.94}
          roughness={0.05}
          transparent
          opacity={0.2}
          reflectivity={0.9}
        />
      </mesh>

      {/* Dark Anodized Aluminum Curtain-Wall Mullions & Transoms */}
      <group position={[-9.82, 0, 0]}>
        {/* Top Header & Base Rails */}
        <mesh position={[0, 3.85, 0]}>
          <boxGeometry args={[0.08, 0.08, 15.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.08, 0.08, 15.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Horizontal Mid Transom Bars */}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.06, 0.04, 15.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} />
        </mesh>
        <mesh position={[0, 2.85, 0]}>
          <boxGeometry args={[0.06, 0.04, 15.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} />
        </mesh>
        {/* Vertical Architectural Mullions */}
        {mullionPositions.map((mz, idx) => (
          <mesh key={idx} position={[0, 1.95, mz]}>
            <boxGeometry args={[0.06, 3.7, 0.05]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Streaming Natural Daylight Lights from Windows */}
      <pointLight position={[-8.5, 2.6, -4.5]} intensity={2.2} distance={9} color="#fffbeb" />
      <pointLight position={[-8.5, 2.6, 0.0]} intensity={2.2} distance={9} color="#fffbeb" />
      <pointLight position={[-8.5, 2.6, 4.5]} intensity={2.2} distance={9} color="#fffbeb" />

      {/* ── OVERHEAD MINIMALIST LINEAR PENDANT LUMINAIRES ── */}
      {/* 1. Executive Boardroom Pendant (over table at [-5.2, 0, -2.2]) */}
      <LinearPendantLuminaire position={[-5.2, 3.15, -2.2]} length={3.0} lightColor="#ffffff" lightIntensity={1.2} />

      {/* 2. Engineering Bullpen Pendant (over pod at [5.5, 0, -4.7]) */}
      <LinearPendantLuminaire position={[5.5, 2.75, -4.7]} length={3.6} lightColor="#f8fafc" lightIntensity={1.1} />

      {/* 3. QA & DevOps Bay Pendant (over pod at [5.5, 0, 0.2]) */}
      <LinearPendantLuminaire position={[5.5, 2.75, 0.2]} length={3.6} lightColor="#f8fafc" lightIntensity={1.1} />

      {/* 4. Support & Analytics Pod Pendant (over pod at [5.5, 0, 5.2]) */}
      <LinearPendantLuminaire position={[5.5, 2.75, 5.2]} length={3.6} lightColor="#f8fafc" lightIntensity={1.1} />

      {/* 5. Hydration & Amenity Credenza Pendant */}
      <LinearPendantLuminaire position={[-3.8, 2.75, 5.0]} length={1.6} lightColor="#fef08a" lightIntensity={0.8} />

      {/* ── 3. LEFT WING NORTH: EXECUTIVE BOARDROOM ([-5.2, 0, -2.5]) ───────── */}
      <ExecutiveBoardroom position={[-5.2, 0, -2.5]} />

      {/* ── 4. LEFT WING SOUTH: FUNCTIONAL AMENITIES ─────────────────────────── */}
      <FocusPhoneBooth position={[-7.8, 0, 4.6]} label="BOOTH 01" />
      <FocusPhoneBooth position={[-6.2, 0, 4.6]} label="BOOTH 02" />

      {/* Refreshment & Hydration Credenza Counter */}
      <group position={[-3.8, 0, 5.0]}>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.88, 0.65]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.56, 0.04, 0.7]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[-0.45, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.12, 0.32, 16]} />
          <meshPhysicalMaterial color="#38bdf8" transmission={0.9} opacity={0.7} transparent roughness={0.1} />
        </mesh>
        <mesh position={[0.25, 1.06, 0]} castShadow>
          <boxGeometry args={[0.38, 0.32, 0.3]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        <mesh position={[0.25, 1.24, 0]}>
          <boxGeometry args={[0.32, 0.04, 0.26]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>

      {/* Architectural Whiteboard Wall on West Wall */}
      <group position={[-9.76, 1.8, 1.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2.2, 1.4, 0.04]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[-0.6, 0.3, 0.025]}><planeGeometry args={[0.14, 0.14]} /><meshBasicMaterial color="#fde047" /></mesh>
        <mesh position={[-0.4, 0.3, 0.025]}><planeGeometry args={[0.14, 0.14]} /><meshBasicMaterial color="#86efac" /></mesh>
        <mesh position={[-0.2, 0.3, 0.025]}><planeGeometry args={[0.14, 0.14]} /><meshBasicMaterial color="#93c5fd" /></mesh>
        <mesh position={[0.3, 0, 0.025]}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
      </group>

      {/* ── 5. RIGHT WING: 3 COLLABORATIVE FACE-TO-FACE TEAM PODS ──────────── */}

      {/* ── POD 1: ENGINEERING BULLPEN (North-East: z = -4.7, center at x = 5.5) ── */}
      <TeamPodModule position={[5.5, 0, -4.7]} width={7.4} depth={3.4} title="ENGINEERING BULLPEN" badgeColor="#10b981" />
      <mesh position={[4.6, 0.95, -4.7]} castShadow>
        <boxGeometry args={[2.8, 0.45, 0.04]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      <ModernDesk position={[4.6, 0, -5.2]} rotation={[0, Math.PI, 0]} width={1.5} monitorType="CODE" />
      <ModernDesk position={[4.6, 0, -4.2]} rotation={[0, 0, 0]} width={1.5} monitorType="CODE" />
      <ModernDesk position={[7.4, 0, -4.7]} rotation={[0, Math.PI / 2, 0]} width={1.5} monitorType="CODE" />

      {/* ── POD 2: QA & DEVOPS BAY (Mid-East: z = 0.2, center at x = 5.5) ── */}
      <TeamPodModule position={[5.5, 0, 0.2]} width={7.4} depth={3.4} title="QA & DEVOPS BAY" badgeColor="#f97316" />
      <mesh position={[5.0, 0.95, 0.2]} castShadow>
        <boxGeometry args={[4.4, 0.45, 0.04]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      <ModernDesk position={[3.6, 0, -0.3]} rotation={[0, Math.PI, 0]} width={1.4} monitorType="TERMINAL" />
      <ModernDesk position={[6.4, 0, -0.3]} rotation={[0, Math.PI, 0]} width={1.4} monitorType="TERMINAL" />
      <ModernDesk position={[3.6, 0, 0.7]} rotation={[0, 0, 0]} width={1.4} monitorType="CODE" />
      <ModernDesk position={[6.4, 0, 0.7]} rotation={[0, 0, 0]} width={1.4} monitorType="GRAFANA" />
      <ServerRack position={[8.6, 0, 0.2]} />

      {/* ── POD 3: SUPPORT & PROJECT ANALYTICS (South-East: z = 5.2, center at x = 5.5) ── */}
      <TeamPodModule position={[5.5, 0, 5.2]} width={7.4} depth={3.4} title="SUPPORT & ANALYTICS" badgeColor="#06b6d4" />
      <mesh position={[5.4, 0.95, 5.2]} castShadow>
        <boxGeometry args={[4.2, 0.45, 0.04]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      <ModernDesk position={[4.0, 0, 4.7]} rotation={[0, Math.PI, 0]} width={1.4} monitorType="JIRA" />
      <ModernDesk position={[6.8, 0, 4.7]} rotation={[0, Math.PI, 0]} width={1.4} monitorType="GRAFANA" />
      <ModernDesk position={[4.0, 0, 5.7]} rotation={[0, 0, 0]} width={1.4} monitorType="TERMINAL" />

      {/* 4K Telemetry Wall Display on Pod Flank */}
      <group position={[8.6, 1.4, 5.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 1.0, 0.05]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[1.72, 0.92]} />
          <meshStandardMaterial
            map={useMemo(() => createScreenTexture('GRAFANA'), [])}
            emissive="#06b6d4"
            emissiveIntensity={0.4}
          />
        </mesh>
      </group>

      {/* Corner Architectural Greenery */}
      <group position={[-8.8, 0, -6.8]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 0.8, 20]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial color="#059669" roughness={0.8} />
        </mesh>
      </group>
      <group position={[8.8, 0, -6.8]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 0.8, 20]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial color="#059669" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
};
