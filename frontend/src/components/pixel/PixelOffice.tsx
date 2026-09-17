import React, { useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { OfficeLayout } from './OfficeLayout';
import { AgentSprite } from './AgentSprite';
import { CollabGraph } from './CollabGraph';
import { IncidentOverlay } from './IncidentOverlay';
import { GamificationHUD } from './GamificationHUD';
import { ZoomIn, ZoomOut, Maximize2, Crosshair } from 'lucide-react';

export const PixelOffice: React.FC = () => {
  const agents = useStore((state) => state.agents);
  const selectAgent = useStore((state) => state.selectAgent);

  // Pan and Zoom Canvas State (Default framed for 1800x900 workspace)
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    },
    [isDragging]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(0.5, prev * zoomFactor), 2.5));
  };

  const resetView = () => {
    setZoom(0.95);
    setPan({ x: 0, y: 0 });
    selectAgent(null);
  };

  const focusZone = (x: number, y: number, targetZoom = 1.4) => {
    // 1800x900 center point is (900, 450)
    const offsetX = (900 - x) * targetZoom;
    const offsetY = (450 - y) * targetZoom;
    setPan({ x: offsetX, y: offsetY });
    setZoom(targetZoom);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-slate-200 dark:bg-[#0d131f] select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* 1. Incident Red Stress Overlay (if active) */}
      <IncidentOverlay />

      {/* 2. Top & Bottom Gamification HUD */}
      <GamificationHUD />

      {/* 3. Floating Interactive Zoom & View Controls */}
      <div className="absolute top-20 right-4 z-20 flex flex-col gap-1.5 p-1.5 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl pointer-events-auto">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 2.5))}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.5))}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Quick Jump Zone Selector Bar (Bottom Center) */}
      <div className="absolute bottom-11 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-2xl pointer-events-auto max-w-[96vw] overflow-x-auto">
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1 shrink-0">
          <Crosshair className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> Focus:
        </span>
        <button
          onClick={resetView}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0 border border-slate-300 dark:border-transparent"
        >
          Full View
        </button>
        {/* Left Wing Focus */}
        <button
          onClick={() => focusZone(290, 220, 1.5)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-sky-100 dark:bg-sky-950/70 hover:bg-sky-200 dark:hover:bg-sky-900 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 shrink-0"
        >
          🏛️ Boardroom
        </button>
        <button
          onClick={() => focusZone(290, 490, 1.5)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-purple-100 dark:bg-purple-950/70 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 shrink-0"
        >
          🎮 Arcade
        </button>
        <button
          onClick={() => focusZone(290, 750, 1.5)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shrink-0"
        >
          ☕ Lounge
        </button>
        {/* Right Wing Cabins Focus */}
        <button
          onClick={() => focusZone(1480, 200, 1.4)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shrink-0"
        >
          💻 Engineering
        </button>
        <button
          onClick={() => focusZone(887, 200, 1.4)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-blue-100 dark:bg-blue-950/70 hover:bg-blue-200 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 shrink-0"
        >
          👑 Leadership
        </button>
        <button
          onClick={() => focusZone(887, 480, 1.4)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-pink-100 dark:bg-pink-950/70 hover:bg-pink-200 dark:hover:bg-pink-900 border border-pink-300 dark:border-pink-800 text-pink-800 dark:text-pink-300 shrink-0"
        >
          🧪 QA Lab
        </button>
        <button
          onClick={() => focusZone(1480, 480, 1.4)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-100 dark:bg-orange-950/70 hover:bg-amber-200 dark:hover:bg-orange-900 border border-amber-300 dark:border-orange-800 text-amber-800 dark:text-orange-300 shrink-0"
        >
          ⚡ DevOps
        </button>
        <button
          onClick={() => focusZone(887, 745, 1.4)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-purple-100 dark:bg-purple-950/70 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 shrink-0"
        >
          🎧 Support
        </button>
        <button
          onClick={() => focusZone(1480, 745, 1.4)}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-100 dark:bg-cyan-950/70 hover:bg-cyan-200 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 shrink-0"
        >
          📊 Analytics
        </button>
      </div>

      {/* 5. MAIN SVG 1800×900 PIXEL OFFICE CANVAS */}
      <div
        className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          viewBox="0 0 1800 900"
          className="w-full h-full max-w-[1800px] max-h-[900px] shadow-2xl rounded-xl"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Layer A: Office Environment (Floors, Walls, Rooms, Cabins, Desks, Screens) */}
          <OfficeLayout />

          {/* Layer B: Animated Collaboration Links (LangGraph) */}
          <CollabGraph />

          {/* Layer C: The 14 Digital AI Employees */}
          {Object.values(agents).map((agent) => (
            <AgentSprite key={agent.id} agent={agent} />
          ))}
        </svg>
      </div>
    </div>
  );
};
