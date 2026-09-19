import React from 'react';
import { useStore } from '../../store/useStore';
import { ShieldCheck, XCircle, CheckCircle, AlertTriangle, GitPullRequest } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export const ApprovalModal: React.FC = () => {
  const activeApprovalModal = useStore((state) => state.activeApprovalModal);
  const decideApproval = useStore((state) => state.decideApproval);
  const agents = useStore((state) => state.agents);
  const tasks = useStore((state) => state.tasks);
  const perms = usePermissions();

  if (!activeApprovalModal) return null;

  const agent = agents[activeApprovalModal.agentId];
  const task = tasks[activeApprovalModal.taskId];

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-cyber-900 border border-amber-400 dark:border-amber-500/70 rounded-2xl shadow-2xl overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-600/40 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Human Approval Required
              </h3>
              <span className="text-xs text-amber-700 dark:text-amber-300 font-mono">
                Action: {activeApprovalModal.actionType}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 font-mono text-[11px] font-bold">
            GATE BLOCKED
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300 font-sans">
          <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
            {activeApprovalModal.description || 'An AI agent has reached a restricted governance boundary requiring explicit human authorization.'}
          </p>

          <div className="bg-slate-50 dark:bg-cyber-800/80 p-3 rounded-lg border border-slate-200 dark:border-cyber-700 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Requesting Agent:</span>
              <span className="text-cyan-700 dark:text-cyber-accent font-bold">{agent?.name || activeApprovalModal.agentId} ({agent?.role})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Target Task:</span>
              <span className="text-slate-900 dark:text-white font-medium">{task?.title || activeApprovalModal.taskId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Target Environment:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">staging-cluster-us-east-1</span>
            </div>
            {activeApprovalModal.prUrl && (
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-cyber-700/50">
                <span className="text-slate-500 dark:text-slate-400">GitHub Pull Request:</span>
                <a
                  href={activeApprovalModal.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline font-bold"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  View Pull Request
                </a>
              </div>
            )}
          </div>

          {/* Diff Preview / Change Plan */}
          {activeApprovalModal.diffPreview && (
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Deployment Diff Preview:</span>
              <pre className="p-2.5 rounded bg-slate-900 text-emerald-400 font-mono text-[10px] overflow-x-auto border border-slate-800">
                {activeApprovalModal.diffPreview}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-[11px]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Approving this action will trigger automated Helm rollout and commit audit logs.</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-cyber-800/50 border-t border-slate-200 dark:border-cyber-700/60 flex items-center justify-end gap-3">
          {perms.canApproveTask ? (
            <>
              <button
                onClick={() => decideApproval(activeApprovalModal.id, false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Action</span>
              </button>
              <button
                onClick={() => decideApproval(activeApprovalModal.id, true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 text-xs font-mono font-bold transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve & Authorize</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Approval restricted: requires Admin or Owner role.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
