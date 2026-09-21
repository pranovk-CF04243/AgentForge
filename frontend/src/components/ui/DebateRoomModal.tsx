import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Brain, Users, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export const DebateRoomModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const debates = useStore((state) => state.debates) || {};
  const agents = useStore((state) => state.agents) || {};
  const agentList = Object.values(agents);
  
  const [topic, setTopic] = useState('');
  const [proposer, setProposer] = useState(agentList[0]?.id || 'agent-backend');
  const [reviewer, setReviewer] = useState(agentList[1]?.id || 'agent-qa');
  
  const activeDebate = Object.values(debates).find(d => d.projectId === selectedProjectId && d.status === 'active');
  
  const startDebate = async () => {
    if (!selectedProjectId || !topic.trim()) return;
    
    try {
      await apiFetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          taskId: 'manual',
          topic: topic,
          proposer: proposer,
          reviewer: reviewer
        })
      });
      setTopic('');
    } catch (e) {
      console.error("Failed to start debate", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Multi-Agent Debate Room</h2>
              <div className="text-[11px] text-slate-500 font-medium">Watch agents collaborate and critique architectural decisions</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0B0F19]">
          {!activeDebate ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Start a New Debate</h3>
              <p className="text-[11px] text-slate-500 max-w-md mb-6">
                Select your Proposer and Reviewer agent personas and enter a topic. The agents will debate until consensus is reached.
              </p>
              
              <div className="w-full max-w-md space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Proposer</label>
                    <select
                      value={proposer}
                      onChange={(e) => setProposer(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      {agentList.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Reviewer / Critic</label>
                    <select
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      {agentList.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Implement Redis caching for the auth endpoint..."
                    className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    onKeyDown={(e) => e.key === 'Enter' && startDebate()}
                  />
                  <button
                    onClick={startDebate}
                    disabled={!topic.trim()}
                    className="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Start
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-indigo-500/10 border-b border-indigo-500/20 text-xs font-mono text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Debating: {activeDebate.topic}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeDebate.messages?.map((msg: any, i: number) => {
                  const agent = agents[msg.agentId];
                  const isProposer = msg.agentId === activeDebate.proposerAgentId;
                  
                  return (
                    <div key={i} className={`flex flex-col max-w-[80%] ${isProposer ? 'self-start' : 'self-end items-end'}`}>
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{agent?.role || msg.agentId}</span>
                        <span className="text-[10px] text-slate-400">{agent?.name}</span>
                      </div>
                      <div className={`p-3 rounded-xl text-sm leading-relaxed border ${
                        isProposer 
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm' 
                          : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200 rounded-tr-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
