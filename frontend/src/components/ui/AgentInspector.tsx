import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  X, 
  Cpu, 
  Terminal, 
  Wrench, 
  Sparkles, 
  Send, 
  DollarSign, 
  Database,
  Activity
} from 'lucide-react';

export const AgentInspector: React.FC = () => {
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const selectAgent = useStore((state) => state.selectAgent);
  const agents = useStore((state) => state.agents);
  const tasks = useStore((state) => state.tasks);
  const sendAgentInstruction = useStore((state) => state.sendAgentInstruction);

  const [inputInstruction, setInputInstruction] = useState('');

  if (!selectedAgentId || !agents[selectedAgentId]) {
    return null;
  }

  const agent = agents[selectedAgentId];
  const currentTask = agent.currentTaskId ? tasks[agent.currentTaskId] : null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputInstruction.trim()) return;
    sendAgentInstruction(agent.id, inputInstruction);
    setInputInstruction('');
  };

  return (
    <aside className="fixed top-13 right-0 w-96 h-[calc(100vh-3.25rem)] bg-white/98 dark:bg-[#11141e]/98 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-200 font-sans transition-colors">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/80 dark:bg-[#151926]/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{agent.name}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 font-medium">
              {agent.role}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{agent.department}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-300 font-medium">
              <Cpu className="w-3 h-3" />
              {agent.model}
            </span>
          </div>
        </div>
        <button
          onClick={() => selectAgent(null)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-700 dark:text-slate-300">
        {/* Status Card */}
        <div className="bg-slate-50 dark:bg-[#171b29] p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Operational Status</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              agent.state === 'WORKING' ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700' :
              agent.state === 'THINKING' ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700' :
              agent.state === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' :
              agent.state === 'WAITING_APPROVAL' ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700' :
              agent.state === 'FAILED' ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700' :
              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {agent.state}
            </span>
          </div>
          <div className="text-slate-800 dark:text-slate-200">
            <span className="text-slate-500 dark:text-slate-400">Current Action: </span>
            <span>{agent.activeAction || 'Active at workstation'}</span>
          </div>
          {currentTask && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <div className="text-blue-600 dark:text-blue-400 font-medium">Assigned Work:</div>
              <div className="font-medium text-slate-900 dark:text-white">{currentTask.title}</div>
              <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-1 mt-2 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300" 
                  style={{ width: `${currentTask.progress}%` }} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 dark:bg-[#171b29] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Token Usage</span>
            </div>
            <div className="text-base font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1">
              {agent.totalTokens.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-[#171b29] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Attributed Cost</span>
            </div>
            <div className="text-base font-mono font-semibold text-amber-600 dark:text-amber-400 mt-1">
              ${agent.estimatedCost.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Assigned Tools */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Authorized Tools</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((tool) => (
              <span
                key={tool}
                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-[11px]"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Core Competencies */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Skills & Roles</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agent.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-[11px]"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* System Directive */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <Database className="w-3 h-3" />
            <span>System Prompt / Directive</span>
          </div>
          <div className="p-2.5 rounded bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed shadow-2xs">
            {agent.systemPrompt}
          </div>
        </div>

        {/* Deliverable / Live Output */}
        {currentTask && currentTask.output && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <Sparkles className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span>Deliverable & Live Output</span>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-cyan-900/50 text-slate-200 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {currentTask.output}
            </div>
          </div>
        )}

        {/* Terminal Logs */}
        {currentTask && currentTask.logs.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
              <Terminal className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Execution Stream</span>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-[10px] space-y-1 max-h-32 overflow-y-auto">
              {currentTask.logs.map((log, i) => (
                <div key={i} className="leading-tight">{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Command Input */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#151926]/60">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={inputInstruction}
            onChange={(e) => setInputInstruction(e.target.value)}
            placeholder={`Instruct ${agent.name}...`}
            className="flex-1 px-3 py-1.5 rounded-md bg-white dark:bg-[#0c0e14] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans shadow-2xs"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center justify-center shadow-sm cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
