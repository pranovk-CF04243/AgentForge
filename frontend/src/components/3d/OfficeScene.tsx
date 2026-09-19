import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OfficeEnvironment } from './OfficeEnvironment';
import { Agent3D } from './Agent3D';
import { CameraController } from './CameraController';
import { CollaborationArcs3D } from './CollaborationArcs3D';
import { useStore, CameraPreset } from '../../store/useStore';
import { Eye, Layers, Terminal, ShieldCheck, Cpu, Database, Network } from 'lucide-react';

export const OfficeScene: React.FC = () => {
  const [showCollabArcs, setShowCollabArcs] = useState(true);
  const agents = useStore((state) => state.agents);
  const cameraPreset = useStore((state) => state.cameraPreset);
  const setCameraPreset = useStore((state) => state.setCameraPreset);
  const selectAgent = useStore((state) => state.selectAgent);
  const theme = useStore((state) => state.theme);
  const isLight = theme === 'light';

  const selectedTaskId = useStore((state) => state.selectedTaskId);
  const isSpecStudioOpen = useStore((state) => state.isSpecStudioOpen || state.isBRDModalOpen);
  const isK8sModalOpen = useStore((state) => state.isK8sModalOpen);
  const isCreateProjectModalOpen = useStore((state) => state.isCreateProjectModalOpen);
  const isPlanVerificationModalOpen = useStore((state) => state.isPlanVerificationModalOpen);
  const isModalOpen = Boolean(
    selectedTaskId ||
    isSpecStudioOpen ||
    isK8sModalOpen ||
    isCreateProjectModalOpen ||
    isPlanVerificationModalOpen
  );

  const presets: { id: CameraPreset; label: string; icon: React.ReactNode }[] = [
    { id: 'ALL', label: 'Campus Overview', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'ARCHITECTURE', label: 'Executive Boardroom', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'DEVELOPMENT', label: 'Engineering Bullpen', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'QA', label: 'QA Testing Lab', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'DEVOPS', label: 'Infra & DevOps', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'SERVER_ROOM', label: 'Support & Analytics', icon: <Database className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-[#0a0d18] select-none transition-colors duration-200">
      <Canvas
        frameloop={isModalOpen ? 'never' : 'always'}
        orthographic
        shadows
        camera={{ position: [22, 22, 22], zoom: 70, near: -100, far: 500 }}
        onPointerMissed={() => selectAgent(null)}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', pointerEvents: isModalOpen ? 'none' : 'auto' }}
      >
        <color attach="background" args={[isLight ? '#edf2f7' : '#0a0d18']} />

        {/* Soft Ambient Daylight */}
        <ambientLight intensity={isLight ? 1.6 : 1.3} color={isLight ? '#ffffff' : '#f8fafc'} />

        {/* Primary Sunlit Key Light from Modern West Windows */}
        <directionalLight
          position={[-18, 24, -10]}
          intensity={isLight ? 2.4 : 2.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={60}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
          shadow-bias={-0.0005}
          color={isLight ? '#fffdf5' : '#fffbeb'}
        />

        {/* Architectural Warm Fill Light */}
        <directionalLight
          position={[16, 16, 16]}
          intensity={isLight ? 1.0 : 0.8}
          color="#fed7aa"
        />

        {/* Compact 20m x 16m Modern Office Architecture */}
        <OfficeEnvironment />

        {/* 3D Multi-Agent Collaboration Flow Arcs */}
        {showCollabArcs && <CollaborationArcs3D />}

        {/* The 14 Digital Employees */}
        {Object.values(agents).map((agent) => (
          <Agent3D key={agent.id} agent={agent} />
        ))}

        {/* Smooth Isometric Camera Controller */}
        <CameraController />
      </Canvas>

      {/* Floating Modern Zone Navigation Bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-[#0f172a]/92 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-2xl z-10 max-w-[95vw] overflow-x-auto transition-colors">
        <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 mr-1.5 font-semibold uppercase tracking-wider shrink-0">Campus:</span>
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              selectAgent(null);
              setCameraPreset(p.id);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded-full transition-all shrink-0 cursor-pointer ${
              cameraPreset === p.id
                ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/20'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        ))}

        <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
        <button
          onClick={() => setShowCollabArcs((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans rounded-full transition-all shrink-0 cursor-pointer ${
            showCollabArcs
              ? 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-400/40 dark:border-cyan-500/40 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title="Toggle 3D Multi-Agent Collaboration Graph Arcs"
        >
          <Network className="w-3.5 h-3.5" />
          <span>Collab Flows</span>
        </button>
      </div>
    </div>
  );
};
