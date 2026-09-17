import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Agent } from '../../types';
import { useStore } from '../../store/useStore';
import { AGENT_MODERN_SEATS, SeatAssignment } from './seatCoordinates';

interface Agent3DProps {
  agent: Agent;
}

interface HumanStyling {
  skin: string;
  hair: string;
  topColor: string;
  collarColor?: string;
  pantsColor: string;
  shoesColor: string;
  glasses?: boolean;
  headphones?: boolean;
  roleLabel: string;
  actionText: string;
}

const HUMAN_STYLING: Record<string, HumanStyling> = {
  // Leadership Pod (Meeting Room)
  'agent-pm': {
    skin: '#fbd3b6', hair: '#26170d',
    topColor: '#1e3a8a', collarColor: '#f8fafc', pantsColor: '#1e293b', shoesColor: '#0f172a',
    roleLabel: 'Project Manager', actionText: 'Explaining Strategy at TV',
  },
  'agent-arch': {
    skin: '#f0c6ad', hair: '#94a3b8',
    topColor: '#18181b', collarColor: '#e2e8f0', pantsColor: '#27272a', shoesColor: '#09090b',
    glasses: true, roleLabel: 'Team Lead', actionText: 'Reviewing Architecture',
  },
  'agent-doc': {
    skin: '#fed7aa', hair: '#92400e',
    topColor: '#0d9488', collarColor: '#ccfbf1', pantsColor: '#334155', shoesColor: '#1e293b',
    roleLabel: 'Jira Agent', actionText: 'Roadmap Backlog',
  },
  'agent-research': {
    skin: '#d7a284', hair: '#3f3f46',
    topColor: '#3730a3', collarColor: '#e0e7ff', pantsColor: '#1e293b', shoesColor: '#0f172a',
    glasses: true, roleLabel: 'BA Agent', actionText: 'Acceptance Criteria',
  },

  // Engineering & QA (Right Wing)
  'agent-backend': {
    skin: '#dfab8c', hair: '#1c1917',
    topColor: '#15803d', collarColor: '#166534', pantsColor: '#1c1917', shoesColor: '#0f172a',
    headphones: true, roleLabel: 'Senior Dev', actionText: 'High-Performance API',
  },
  'agent-frontend': {
    skin: '#fed7aa', hair: '#b45309',
    topColor: '#6d28d9', collarColor: '#ede9fe', pantsColor: '#0f172a', shoesColor: '#1e293b',
    roleLabel: 'Junior Dev 1', actionText: 'Frontend UI',
  },
  'agent-mobile': {
    skin: '#d69d7a', hair: '#18181b',
    topColor: '#0284c7', collarColor: '#e0e7fe', pantsColor: '#334155', shoesColor: '#0f172a',
    roleLabel: 'Junior Dev 2', actionText: 'Full-Stack Services',
  },
  'agent-qa': {
    skin: '#fed7aa', hair: '#9f1239',
    topColor: '#be185d', collarColor: '#fce7f3', pantsColor: '#1e293b', shoesColor: '#0f172a',
    roleLabel: 'Lead QA', actionText: 'Automated Test Suite',
  },
  'agent-reviewer': {
    skin: '#bd8463', hair: '#1c1917',
    topColor: '#334155', collarColor: '#94a3b8', pantsColor: '#020617', shoesColor: '#000000',
    roleLabel: 'Junior QA', actionText: 'CI/CD Pass',
  },

  // Infra, DevOps, Support, Analytics (Right Wing)
  'agent-devops': {
    skin: '#e0a482', hair: '#475569',
    topColor: '#ea580c', collarColor: '#ffedd5', pantsColor: '#1e293b', shoesColor: '#0f172a',
    roleLabel: 'DevOps Lead', actionText: 'Kubernetes Cluster',
  },
  'agent-sre': {
    skin: '#c48f6d', hair: '#1c1917',
    topColor: '#b91c1c', collarColor: '#fecaca', pantsColor: '#0f172a', shoesColor: '#000000',
    roleLabel: 'Cloud SRE', actionText: 'Telemetry & SLOs',
  },
  'agent-sec': {
    skin: '#d8aa8d', hair: '#171717',
    topColor: '#7e22ce', collarColor: '#fae8ff', pantsColor: '#1e293b', shoesColor: '#0f172a',
    roleLabel: 'Senior Support', actionText: 'Incident Escalation',
  },
  'agent-db': {
    skin: '#b87c53', hair: '#0a0a0a',
    topColor: '#166534', collarColor: '#dcfce7', pantsColor: '#1e293b', shoesColor: '#0f172a',
    roleLabel: 'Junior Support', actionText: 'Customer Inquiries',
  },
  'agent-data': {
    skin: '#ffcbb0', hair: '#18181b',
    topColor: '#0891b2', collarColor: '#cffafe', pantsColor: '#020617', shoesColor: '#000000',
    roleLabel: 'Analytics Lead', actionText: 'Grafana Telemetry',
  },
};

export const Agent3D: React.FC<Agent3DProps> = ({ agent }) => {
  const selectAgent = useStore((state) => state.selectAgent);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const isSelected = selectedAgentId === agent.id;

  const [isHovered, setIsHovered] = useState(false);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const chestRef = useRef<THREE.Mesh>(null);

  const seat: SeatAssignment = AGENT_MODERN_SEATS[agent.id] || {
    pos: [0, 0, 0],
    rotY: 0,
    activity: 'WORKING_DESK',
  };

  const style = HUMAN_STYLING[agent.id] || {
    skin: '#fbd3b6',
    hair: '#1c1917',
    topColor: '#1e3a8a',
    pantsColor: '#1e293b',
    shoesColor: '#0f172a',
    roleLabel: 'Engineer',
    actionText: 'Active',
  };

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + seat.pos[0] * 1.5;

    if (seat.activity === 'MEETING_DISCUSSING') {
      if (seat.isStanding) {
        // Elena standing at the TV explaining to the team
        if (rightArmRef.current) {
          // Right arm gestures dynamically towards the 4K TV and team
          rightArmRef.current.rotation.x = -0.75 + Math.sin(t * 1.6) * 0.16;
          rightArmRef.current.rotation.z = -0.32 + Math.cos(t * 1.4) * 0.10;
        }
        if (leftArmRef.current) {
          // Left arm holds presenter pad
          leftArmRef.current.rotation.x = -0.28 + Math.sin(t * 1.1) * 0.05;
        }
        if (headRef.current) {
          // Elena glances naturally between TV milestones and seated audience
          headRef.current.rotation.y = -0.2 + Math.sin(t * 1.2) * 0.25;
        }
      } else {
        // Seated attendees: arms resting forward on table/laptop, nodding attentively
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = -0.85 + (Math.sin(t * 8) > 0.6 ? 0.03 : 0);
        }
        if (leftArmRef.current) {
          leftArmRef.current.rotation.x = -0.85;
        }
        if (headRef.current) {
          // Attentive listening: head nods occasionally and turns toward Elena
          headRef.current.rotation.x = 0.06 + Math.sin(t * 1.8) * 0.05;
          headRef.current.rotation.y = Math.sin(t * 0.7) * 0.12;
        }
      }
    } else {
      // WORKING_DESK: Hands rest on keyboard, tapping code
      if (leftArmRef.current && rightArmRef.current) {
        // Alternating fluid keyboard keystrokes
        const tapLeft = Math.sin(t * 14) > 0 ? 0.03 : 0;
        const tapRight = Math.cos(t * 14) > 0 ? 0.03 : 0;
        leftArmRef.current.rotation.x = -0.75 + tapLeft;
        rightArmRef.current.rotation.x = -0.75 + tapRight;
      }
      if (headRef.current) {
        // Natural subtle gaze across ultrawide monitors
        headRef.current.rotation.y = Math.sin(t * 0.9) * 0.16;
        headRef.current.rotation.x = 0.08 + Math.sin(t * 1.6) * 0.03;
      }
    }

    if (chestRef.current) {
      chestRef.current.scale.z = 1.0 + Math.sin(t * 2.0) * 0.015;
    }
  });

  const showDetail = isSelected || isHovered;

  return (
    <group
      position={seat.pos}
      rotation={[0, seat.rotY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        selectAgent(agent.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setIsHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* ── 1. MODERN ERGONOMIC CHAIR (Only when seated) ── */}
      {!seat.isStanding && (
        <group position={[0, 0, 0]}>
          {/* Base */}
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.02, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Stem */}
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.36, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Cushion */}
          <mesh position={[0, 0.44, 0]} castShadow>
            <boxGeometry args={[0.42, 0.06, 0.42]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
          {/* Backrest (placed at +Z, which is BEHIND the seated character facing -Z!) */}
          <mesh position={[0, 0.72, 0.18]} rotation={[-0.08, 0, 0]} castShadow>
            <boxGeometry args={[0.38, 0.48, 0.04]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* ── 2. REALISTIC HUMAN FIGURE ── */}
      <group position={[0, 0, 0]}>
        {seat.isStanding ? (
          /* ── PROPERLY PROPORTIONED STANDING BODY (Ground y = 0) ── */
          <group>
            {/* Legs */}
            <mesh position={[-0.09, 0.34, 0]} castShadow>
              <cylinderGeometry args={[0.055, 0.05, 0.65, 12]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>
            <mesh position={[0.09, 0.34, 0]} castShadow>
              <cylinderGeometry args={[0.055, 0.05, 0.65, 12]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>
            {/* Shoes planted on floor */}
            <mesh position={[-0.09, 0.03, 0.02]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.15]} />
              <meshStandardMaterial color={style.shoesColor} />
            </mesh>
            <mesh position={[0.09, 0.03, 0.02]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.15]} />
              <meshStandardMaterial color={style.shoesColor} />
            </mesh>

            {/* Torso */}
            <mesh ref={chestRef} position={[0, 0.82, 0]} castShadow>
              <boxGeometry args={[0.30, 0.36, 0.18]} />
              <meshStandardMaterial color={style.topColor} roughness={0.6} />
            </mesh>
            {style.collarColor && (
              <mesh position={[0, 0.96, -0.09]}>
                <boxGeometry args={[0.12, 0.05, 0.02]} />
                <meshStandardMaterial color={style.collarColor} />
              </mesh>
            )}

            {/* Left Arm (holding presenter remote at waist) */}
            <group ref={leftArmRef} position={[-0.18, 0.94, 0.02]}>
              <mesh position={[0, -0.12, -0.03]} rotation={[-0.2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.22, -0.12]} rotation={[-0.9, 0, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.03, 0.20, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.22, -0.22]} castShadow>
                <boxGeometry args={[0.05, 0.02, 0.06]} />
                <meshStandardMaterial color={style.skin} roughness={0.6} />
              </mesh>
              {/* Tablet / presenter pad */}
              <mesh position={[0, -0.21, -0.24]} rotation={[0.4, 0, 0]}>
                <boxGeometry args={[0.08, 0.01, 0.11]} />
                <meshStandardMaterial color="#0284c7" />
              </mesh>
            </group>

            {/* Right Arm (pointing/explaining gesture towards TV) */}
            <group ref={rightArmRef} position={[0.18, 0.94, 0.02]}>
              <mesh position={[0, -0.10, -0.04]} rotation={[-0.5, 0, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0.04, -0.16, -0.18]} rotation={[-1.3, 0, 0.4]} castShadow>
                <cylinderGeometry args={[0.035, 0.03, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0.06, -0.16, -0.28]} castShadow>
                <boxGeometry args={[0.05, 0.02, 0.06]} />
                <meshStandardMaterial color={style.skin} roughness={0.6} />
              </mesh>
              {/* Executive Laser Presenter Remote Clicker */}
              <mesh position={[0.06, -0.16, -0.32]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.03, 0.02, 0.08]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} />
              </mesh>
              <mesh position={[0.06, -0.155, -0.36]}>
                <sphereGeometry args={[0.007, 8, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>

            {/* Neck */}
            <mesh position={[0, 1.02, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.055, 0.08, 16]} />
              <meshStandardMaterial color={style.skin} roughness={0.6} />
            </mesh>

            {/* Head */}
            <group ref={headRef} position={[0, 1.15, -0.01]}>
              <mesh castShadow>
                <boxGeometry args={[0.22, 0.22, 0.22]} />
                <meshStandardMaterial color={style.skin} roughness={0.6} />
              </mesh>
              {/* Eyes looking towards -Z */}
              <mesh position={[-0.05, 0.02, -0.113]}>
                <boxGeometry args={[0.035, 0.02, 0.01]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0.05, 0.02, -0.113]}>
                <boxGeometry args={[0.035, 0.02, 0.01]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              {/* Hair */}
              <mesh position={[0, 0.1, 0]} castShadow>
                <boxGeometry args={[0.24, 0.08, 0.24]} />
                <meshStandardMaterial color={style.hair} roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.02, 0.08]} castShadow>
                <boxGeometry args={[0.24, 0.16, 0.1]} />
                <meshStandardMaterial color={style.hair} roughness={0.8} />
              </mesh>
            </group>
          </group>
        ) : (
          /* ── SEATED BODY (Facing -Z into the table/desk) ── */
          <group>
            {/* Pelvis on chair */}
            <mesh position={[0, 0.48, -0.06]} castShadow>
              <boxGeometry args={[0.32, 0.10, 0.34]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>

            {/* Thighs extending horizontally towards -Z (under table) */}
            <mesh position={[-0.10, 0.45, -0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.045, 0.30, 12]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>
            <mesh position={[0.10, 0.45, -0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.045, 0.30, 12]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>

            {/* Shins going down vertically */}
            <mesh position={[-0.10, 0.23, -0.32]} castShadow>
              <cylinderGeometry args={[0.045, 0.04, 0.38, 12]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>
            <mesh position={[0.10, 0.23, -0.32]} castShadow>
              <cylinderGeometry args={[0.045, 0.04, 0.38, 12]} />
              <meshStandardMaterial color={style.pantsColor} roughness={0.7} />
            </mesh>

            {/* Shoes flat on floor */}
            <mesh position={[-0.10, 0.03, -0.30]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.16]} />
              <meshStandardMaterial color={style.shoesColor} />
            </mesh>
            <mesh position={[0.10, 0.03, -0.30]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.16]} />
              <meshStandardMaterial color={style.shoesColor} />
            </mesh>

            {/* Torso */}
            <mesh ref={chestRef} position={[0, 0.70, 0]} castShadow>
              <boxGeometry args={[0.30, 0.36, 0.18]} />
              <meshStandardMaterial color={style.topColor} roughness={0.6} />
            </mesh>
            {style.collarColor && (
              <mesh position={[0, 0.84, -0.09]}>
                <boxGeometry args={[0.12, 0.05, 0.02]} />
                <meshStandardMaterial color={style.collarColor} />
              </mesh>
            )}

            {/* Left Arm (resting forward on desk/table at y = 0.74) */}
            <group ref={leftArmRef} position={[-0.18, 0.82, 0.02]}>
              <mesh position={[0, -0.11, -0.04]} rotation={[-0.3, 0, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.16, -0.18]} rotation={[-1.25, 0, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.03, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              {/* Hand on desk/table */}
              <mesh position={[0, -0.16, -0.28]} castShadow>
                <boxGeometry args={[0.05, 0.02, 0.06]} />
                <meshStandardMaterial color={style.skin} roughness={0.6} />
              </mesh>
            </group>

            {/* Right Arm */}
            <group ref={rightArmRef} position={[0.18, 0.82, 0.02]}>
              <mesh position={[0, -0.11, -0.04]} rotation={[-0.3, 0, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.16, -0.18]} rotation={[-1.25, 0, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.03, 0.22, 12]} />
                <meshStandardMaterial color={style.topColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.16, -0.28]} castShadow>
                <boxGeometry args={[0.05, 0.02, 0.06]} />
                <meshStandardMaterial color={style.skin} roughness={0.6} />
              </mesh>
            </group>

            {/* Neck */}
            <mesh position={[0, 0.90, -0.01]} castShadow>
              <cylinderGeometry args={[0.05, 0.055, 0.08, 16]} />
              <meshStandardMaterial color={style.skin} roughness={0.6} />
            </mesh>

            {/* Head */}
            <group ref={headRef} position={[0, 1.02, -0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.22, 0.22, 0.22]} />
                <meshStandardMaterial color={style.skin} roughness={0.6} />
              </mesh>
              <mesh position={[-0.05, 0.02, -0.113]}>
                <boxGeometry args={[0.035, 0.02, 0.01]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0.05, 0.02, -0.113]}>
                <boxGeometry args={[0.035, 0.02, 0.01]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>

              {style.glasses && (
                <group position={[0, 0.02, -0.118]}>
                  <mesh position={[-0.05, 0, 0]}><boxGeometry args={[0.06, 0.04, 0.01]} /><meshStandardMaterial color="#475569" metalness={0.8} /></mesh>
                  <mesh position={[0.05, 0, 0]}><boxGeometry args={[0.06, 0.04, 0.01]} /><meshStandardMaterial color="#475569" metalness={0.8} /></mesh>
                  <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.04, 0.008, 0.01]} /><meshStandardMaterial color="#475569" metalness={0.8} /></mesh>
                </group>
              )}

              {style.headphones && (
                <group position={[0, 0.02, 0]}>
                  <mesh position={[-0.125, 0, 0]}><boxGeometry args={[0.04, 0.08, 0.08]} /><meshStandardMaterial color="#1e293b" /></mesh>
                  <mesh position={[0.125, 0, 0]}><boxGeometry args={[0.04, 0.08, 0.08]} /><meshStandardMaterial color="#1e293b" /></mesh>
                  <mesh position={[0, 0.125, 0]}><boxGeometry args={[0.26, 0.02, 0.04]} /><meshStandardMaterial color="#334155" /></mesh>
                </group>
              )}

              <mesh position={[0, 0.1, 0]} castShadow>
                <boxGeometry args={[0.24, 0.08, 0.24]} />
                <meshStandardMaterial color={style.hair} roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.02, 0.08]} castShadow>
                <boxGeometry args={[0.24, 0.16, 0.1]} />
                <meshStandardMaterial color={style.hair} roughness={0.8} />
              </mesh>
            </group>
          </group>
        )}
      </group>

      {/* ── Active Task Desk & Keyboard Light Glow (when WORKING) ── */}
      {agent.state === 'WORKING' && !seat.isStanding && (
        <pointLight
          position={[0, 0.85, -0.42]}
          intensity={1.4}
          distance={1.6}
          color="#38bdf8"
        />
      )}

      {/* ── 3. CLEAN UNCONGESTED ENTERPRISE BADGE ──────────────────── */}
      <Html position={[0, seat.isStanding ? 1.55 : 1.45, 0]} center className="pointer-events-none">
        {showDetail ? (
          <div
            className="flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-150"
            style={{
              filter: isSelected ? 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.9))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 rounded-full shadow-2xl whitespace-nowrap">
              <span
                className={`w-2 h-2 rounded-full ${
                  agent.state === 'WORKING' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'
                }`}
              />
              <span className="text-[11px] font-sans font-semibold text-slate-100">
                {agent.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({style.roleLabel})
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                {style.actionText}
              </span>
            </div>
            <div className="w-2 h-2 bg-[#0f172a] border-b border-r border-slate-700 rotate-45 -mt-1" />
          </div>
        ) : agent.state === 'WORKING' ? (
          <div className="flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0f172a]/92 backdrop-blur-sm border border-emerald-500/50 rounded-full shadow-lg whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-sans font-medium text-slate-200">
                {agent.name.split(' ')[0]}
              </span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                {style.actionText}
              </span>
            </div>
            <div className="w-1.5 h-1.5 bg-[#0f172a] border-b border-r border-emerald-500/50 rotate-45 -mt-1" />
          </div>
        ) : (
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800/80 border border-slate-600 shadow-sm flex items-center justify-center opacity-70 hover:opacity-100">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          </div>
        )}
      </Html>

      {/* ── 4. SELECTION RING ON FLOOR ────────────────────────────── */}
      {(isSelected || isHovered) && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.48, 32]} />
          <meshBasicMaterial
            color={isSelected ? '#38bdf8' : '#60a5fa'}
            transparent
            opacity={isSelected ? 0.9 : 0.4}
          />
        </mesh>
      )}
    </group>
  );
};
