import React from 'react';
import { useGamificationStore } from '../../store/useGamificationStore';
import { useStore } from '../../store/useStore';
import { Zap, Bot, Database, Sparkles, X } from 'lucide-react';

export const GamificationHUD: React.FC = () => {
  const teamVelocity = useGamificationStore((state) => state.teamVelocity);
  const recentToasts = useGamificationStore((state) => state.recentToasts);
  const dismissToast = useGamificationStore((state) => state.dismissToast);
  const metrics = useStore((state) => state.metrics);

  return (
    <>
      {/* 1. TOP RETRO TITLE & VELOCITY BANNER (Exact style from reference image) */}
      <div className="absolute top-2 left-0 right-0 z-10 flex flex-col items-center pointer-events-none select-none">
        {/* 'AGENT OFFICE' 3D-effect Pixel Banner */}
        <div className="flex flex-col items-center">
          <div
            className="text-2xl md:text-3xl font-black uppercase tracking-wider text-amber-300 drop-shadow-[2px_3px_0px_#000000]"
            style={{
              fontFamily: '"Press Start 2P", "Courier New", monospace',
              WebkitTextStroke: '1px #000000',
              textShadow: '3px 3px 0px #0f172a, 4px 4px 0px #0284c7',
            }}
          >
            'AGENT OFFICE'
          </div>
          <div
            className="text-[10px] md:text-xs font-bold tracking-widest text-emerald-400 drop-shadow-[1px_1px_0px_#000000] -mt-0.5"
            style={{
              fontFamily: '"Courier New", monospace',
              letterSpacing: '2px',
            }}
          >
            SELF-GROWING AI TEAMS IN A PIXEL-ART VIRTUAL OFFICE
          </div>
        </div>

        {/* Live Velocity & APM Pill (Interactive Pointer-Events Auto) */}
        <div className="mt-1 flex items-center gap-3 px-3 py-1 bg-white/90 dark:bg-[#0f172a]/85 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-full shadow-lg pointer-events-auto">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-600 dark:text-cyan-300 font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400" />
            <span>Velocity: {teamVelocity} tasks/hr</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Active Agents: {metrics.activeAgents} / 14</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold">
            <span>Tokens: {(metrics.totalTokens / 1000).toFixed(0)}k</span>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM TICKER BANNER (From reference image) */}
      <div className="absolute bottom-2 left-0 right-0 z-10 flex items-center justify-between px-6 py-1.5 bg-white/90 dark:bg-[#0b0e17]/90 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md select-none">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span
            className="text-[11px] md:text-xs font-black tracking-wider text-slate-800 dark:text-slate-200"
            style={{ fontFamily: 'monospace' }}
          >
            WATCH AI AGENTS THINK, WORK, COLLABORATE, AND GROW!
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 text-[10px] font-mono text-blue-800 dark:text-blue-300">
            <Database className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>MEMORY &amp; PERSISTENCE (POSTGRES + REDIS)</span>
          </div>
        </div>
      </div>

      {/* 3. ACHIEVEMENT & LEVEL-UP FLOATING TOASTS (Bottom-Right) */}
      <div className="absolute bottom-12 right-4 z-30 flex flex-col gap-2 pointer-events-auto">
        {recentToasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start gap-3 p-3 bg-white/95 dark:bg-[#0f172a]/95 border-2 border-amber-500 dark:border-amber-400 rounded-lg shadow-2xl animate-in slide-in-from-right duration-300 max-w-sm"
          >
            <div className="text-2xl select-none">{toast.icon}</div>
            <div className="flex-1">
              <div className="text-xs font-black text-amber-600 dark:text-amber-300 tracking-wide font-mono">
                {toast.title}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                {toast.description}
              </div>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};
