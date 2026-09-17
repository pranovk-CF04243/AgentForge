import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { AGENT_MODERN_SEATS } from './seatCoordinates';

interface CollabConnection {
  fromId: string;
  toId: string;
  color: string;
  speed: number;
}

const DEFAULT_FLOWS: CollabConnection[] = [
  // Executive Alignment
  { fromId: 'agent-pm', toId: 'agent-arch', color: '#38bdf8', speed: 0.6 },
  { fromId: 'agent-pm', toId: 'agent-doc', color: '#a855f7', speed: 0.5 },
  { fromId: 'agent-research', toId: 'agent-pm', color: '#818cf8', speed: 0.55 },
  // Architecture to Engineering
  { fromId: 'agent-arch', toId: 'agent-backend', color: '#60a5fa', speed: 0.7 },
  // Engineering Bullpen Internal Flows
  { fromId: 'agent-backend', toId: 'agent-frontend', color: '#34d399', speed: 0.8 },
  { fromId: 'agent-backend', toId: 'agent-mobile', color: '#2dd4bf', speed: 0.75 },
  // Dev to QA Pipeline
  { fromId: 'agent-backend', toId: 'agent-qa', color: '#10b981', speed: 0.65 },
  { fromId: 'agent-frontend', toId: 'agent-reviewer', color: '#10b981', speed: 0.6 },
  // QA to DevOps Pipeline
  { fromId: 'agent-qa', toId: 'agent-devops', color: '#fb923c', speed: 0.7 },
  // Cloud Infrastructure & Observability
  { fromId: 'agent-devops', toId: 'agent-sre', color: '#f59e0b', speed: 0.8 },
  // Incident & Support Escalation
  { fromId: 'agent-sec', toId: 'agent-sre', color: '#f43f5e', speed: 0.85 },
  { fromId: 'agent-sec', toId: 'agent-data', color: '#06b6d4', speed: 0.6 },
  { fromId: 'agent-sec', toId: 'agent-db', color: '#a855f7', speed: 0.65 },
];

const SingleCollaborationArc: React.FC<{
  fromPos: [number, number, number];
  toPos: [number, number, number];
  color: string;
  speed: number;
  offset: number;
}> = ({ fromPos, toPos, color, speed, offset }) => {
  const packetRef1 = useRef<THREE.Mesh>(null);
  const packetRef2 = useRef<THREE.Mesh>(null);

  const { curve, tubeGeometry } = useMemo(() => {
    const p0 = new THREE.Vector3(fromPos[0], 1.05, fromPos[2]);
    const p2 = new THREE.Vector3(toPos[0], 1.05, toPos[2]);
    const dist = p0.distanceTo(p2);
    // Apex height scales with distance
    const apexY = 1.25 + Math.min(2.8, dist * 0.22);
    const p1 = new THREE.Vector3(
      (p0.x + p2.x) / 2,
      apexY,
      (p0.z + p2.z) / 2
    );

    const qCurve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const geom = new THREE.TubeGeometry(qCurve, 28, 0.009, 6, false);
    return { curve: qCurve, tubeGeometry: geom };
  }, [fromPos, toPos]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + offset;
    const u1 = t % 1.0;
    const u2 = (t + 0.5) % 1.0;

    if (packetRef1.current) {
      const pos1 = curve.getPoint(u1);
      packetRef1.current.position.copy(pos1);
      const pulse1 = 0.8 + Math.sin(u1 * Math.PI) * 0.6;
      packetRef1.current.scale.set(pulse1, pulse1, pulse1);
    }

    if (packetRef2.current) {
      const pos2 = curve.getPoint(u2);
      packetRef2.current.position.copy(pos2);
      const pulse2 = 0.8 + Math.sin(u2 * Math.PI) * 0.6;
      packetRef2.current.scale.set(pulse2, pulse2, pulse2);
    }
  });

  return (
    <group>
      {/* Semi-Transparent Luminous Guide Tube */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>

      {/* Traveling Luminous Energy Packet 1 */}
      <mesh ref={packetRef1}>
        <sphereGeometry args={[0.038, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Traveling Luminous Energy Packet 2 */}
      <mesh ref={packetRef2}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

export const CollaborationArcs3D: React.FC = () => {
  const agents = useStore((state) => state.agents);
  const tasks = useStore((state) => state.tasks);

  // Derive active connections based on tasks or agent activity
  const activeFlows = useMemo(() => {
    const flows: {
      key: string;
      fromPos: [number, number, number];
      toPos: [number, number, number];
      color: string;
      speed: number;
      offset: number;
    }[] = [];

    // 1. Task-based explicit dependencies
    const runningTasks = Object.values(tasks).filter(
      (t) => t.status === 'RUNNING' || t.status === 'ASSIGNED' || t.status === 'REVIEW'
    );

    runningTasks.forEach((task, idx) => {
      if (task.assignedTo && task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((depId) => {
          const parentTask = tasks[depId];
          if (parentTask && parentTask.assignedTo && parentTask.assignedTo !== task.assignedTo) {
            const seatFrom = AGENT_MODERN_SEATS[parentTask.assignedTo];
            const seatTo = AGENT_MODERN_SEATS[task.assignedTo];
            if (seatFrom && seatTo) {
              flows.push({
                key: `task-${task.id}-${depId}`,
                fromPos: seatFrom.pos,
                toPos: seatTo.pos,
                color: '#38bdf8',
                speed: 0.75,
                offset: (idx * 0.3) % 1.0,
              });
            }
          }
        });
      }
    });

    // 2. Active agent state flows
    DEFAULT_FLOWS.forEach((flow, idx) => {
      const fromAgent = agents[flow.fromId];
      const toAgent = agents[flow.toId];

      const fromActive = fromAgent && fromAgent.state !== 'IDLE';
      const toActive = toAgent && toAgent.state !== 'IDLE';

      // If either agent is active, show the collaborative conduit
      if (fromActive || toActive) {
        const seatFrom = AGENT_MODERN_SEATS[flow.fromId];
        const seatTo = AGENT_MODERN_SEATS[flow.toId];
        if (seatFrom && seatTo) {
          flows.push({
            key: `flow-${flow.fromId}-${flow.toId}`,
            fromPos: seatFrom.pos,
            toPos: seatTo.pos,
            color: flow.color,
            speed: flow.speed,
            offset: (idx * 0.23) % 1.0,
          });
        }
      }
    });

    return flows;
  }, [agents, tasks]);

  return (
    <group>
      {activeFlows.map((flow) => (
        <SingleCollaborationArc
          key={flow.key}
          fromPos={flow.fromPos}
          toPos={flow.toPos}
          color={flow.color}
          speed={flow.speed}
          offset={flow.offset}
        />
      ))}
    </group>
  );
};
