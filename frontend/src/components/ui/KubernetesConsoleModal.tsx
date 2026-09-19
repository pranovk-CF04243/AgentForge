import React, { useState, useEffect } from 'react';
import { useStore, LivePod } from '../../store/useStore';
import {
  X,
  Server,
  Activity,
  Cpu,
  Layers,
  Terminal,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Zap,
  Box,
  ExternalLink,
  ChevronRight,
  HardDrive,
  HeartPulse,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';

export const KubernetesConsoleModal: React.FC = () => {
  const isK8sModalOpen = useStore((state) => state.isK8sModalOpen);
  const setK8sModalOpen = useStore((state) => state.setK8sModalOpen);
  const clusterStatus = useStore((state) => state.clusterStatus);
  const liveWorkloads = useStore((state) => state.liveWorkloads);
  const activePodLogs = useStore((state) => state.activePodLogs);
  const isDeployingCluster = useStore((state) => state.isDeployingCluster);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const projects = useStore((state) => state.projects);

  const fetchClusterStatus = useStore((state) => state.fetchClusterStatus);
  const fetchClusterWorkloads = useStore((state) => state.fetchClusterWorkloads);
  const fetchPodLogs = useStore((state) => state.fetchPodLogs);
  const provisionNamespace = useStore((state) => state.provisionNamespace);
  const deployToCluster = useStore((state) => state.deployToCluster);
  const deploymentHealthReports = useStore((state) => state.deploymentHealthReports);
  const fetchClusterHealth = useStore((state) => state.fetchClusterHealth);
  const validateCredentialsForDeploy = useStore((state) => state.validateCredentialsForDeploy);

  const [activeTab, setActiveTab] = useState<'WORKLOADS' | 'LOGS' | 'PROVISION'>('WORKLOADS');
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<string>('');
  const [cpuLimit, setCpuLimit] = useState('2');
  const [memLimit, setMemLimit] = useState('4Gi');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const activeProject = projects[selectedProjectId];
  const targetNamespace = `agentforge-${selectedProjectId}-dev`.toLowerCase();
  const healthReport = deploymentHealthReports[selectedProjectId];

  useEffect(() => {
    if (isK8sModalOpen) {
      fetchClusterStatus();
      fetchClusterWorkloads();
      fetchClusterHealth(selectedProjectId);
      const interval = setInterval(() => {
        fetchClusterStatus();
        fetchClusterWorkloads();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isK8sModalOpen, selectedProjectId, fetchClusterStatus, fetchClusterWorkloads, fetchClusterHealth]);

  useEffect(() => {
    if (liveWorkloads?.pods && liveWorkloads.pods.length > 0 && !selectedPodForLogs) {
      setSelectedPodForLogs(liveWorkloads.pods[0].name);
    }
  }, [liveWorkloads, selectedPodForLogs]);

  if (!isK8sModalOpen) return null;

  const handleDeploy = async () => {
    setFeedbackMsg(null);

    // Pre-deploy credential gate check
    try {
      const credCheck = await validateCredentialsForDeploy(selectedProjectId, 'dev');
      if (credCheck && credCheck.blocked) {
        setFeedbackMsg({
          type: 'error',
          text: `Deployment blocked! Missing required credentials: ${credCheck.blockers.join(', ')}. Please configure or stub them in Specification Studio > Credentials.`
        });
        return;
      }
      if (credCheck && credCheck.warnings.length > 0) {
        setFeedbackMsg({
          type: 'success',
          text: `Advisory: Deploying with stubbed credentials (${credCheck.warnings.join(', ')}). Proceeding with dev rollout...`
        });
      }
    } catch (err) {
      console.warn('Credential pre-check advisory:', err);
    }

    const res = await deployToCluster(selectedProjectId, 'dev');
    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message || 'Deployed successfully!' });
      setActiveTab('WORKLOADS');
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Deployment failed.' });
    }
  };

  const handleProvision = async () => {
    setIsProvisioning(true);
    setFeedbackMsg(null);
    try {
      const res = await provisionNamespace(selectedProjectId, 'dev', cpuLimit, memLimit);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || 'Namespace provisioned!' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || 'Provisioning failed.' });
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleViewLogs = (pod: LivePod) => {
    setSelectedPodForLogs(pod.name);
    setActiveTab('LOGS');
    fetchPodLogs(pod.name, pod.namespace);
  };

  const isOnline = clusterStatus?.status === 'ONLINE';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-[#0c0f1d] border border-slate-200 dark:border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#111628]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold tracking-tight">Kubernetes Management Console</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isOnline 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isOnline ? `ONLINE (${clusterStatus?.version || 'v1.31.0'})` : 'OFFLINE'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {clusterStatus?.cluster_type || 'Embedded K3s'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Active Project: <strong className="text-slate-700 dark:text-slate-200">{activeProject?.name || selectedProjectId}</strong></span>
                <span>•</span>
                <span>Namespace: <code className="font-mono text-blue-600 dark:text-blue-400">{targetNamespace}</code></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDeploy}
              disabled={isDeployingCluster || !isOnline}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isDeployingCluster ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deploying Manifests...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Deploy to Cluster</span>
                </>
              )}
            </button>

            <button
              onClick={() => setK8sModalOpen(false)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Telemetry Row */}
        <div className="grid grid-cols-4 gap-4 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#0f1424]/60 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Cluster Nodes</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {clusterStatus?.nodes?.length || 0} Node ({clusterStatus?.nodes?.[0]?.os || 'Linux'})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Live Pods</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {liveWorkloads?.pods?.filter(p => p.is_ready).length || 0} / {liveWorkloads?.pods?.length || 0} Running
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Deployments</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {liveWorkloads?.deployments?.length || 0} Active ({liveWorkloads?.services?.length || 0} Services)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Security & RBAC</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">Enforced & Sandboxed</div>
            </div>
          </div>
        </div>

        {/* Feedback Alert Bar */}
        {feedbackMsg && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            <span className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedbackMsg.text}
            </span>
            <button onClick={() => setFeedbackMsg(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('WORKLOADS')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'WORKLOADS'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Workloads & Live Pods ({liveWorkloads?.pods?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'LOGS'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live Pod Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('PROVISION')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'PROVISION'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Namespace Provisioning & Quotas</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-[#0a0d18]/50">
          {activeTab === 'WORKLOADS' && (
            <div className="space-y-6">
              {/* Post-Deploy 3-Stage Verification & SRE Health Status */}
              {healthReport && (
                <div className={`p-4 rounded-xl border transition-all shadow-sm ${
                  healthReport.overall === 'HEALTHY'
                    ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
                    : healthReport.overall === 'DEGRADED'
                    ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/30'
                    : 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/30'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <HeartPulse className={`w-4 h-4 ${
                          healthReport.overall === 'HEALTHY'
                            ? 'text-emerald-500'
                            : healthReport.overall === 'DEGRADED'
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`} />
                        <h4 className="font-bold text-xs tracking-wider uppercase font-mono text-slate-800 dark:text-slate-200">
                          Post-Deploy Verification & SRE Health
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          healthReport.overall === 'HEALTHY'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : healthReport.overall === 'DEGRADED'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}>
                          {healthReport.overall}
                        </span>
                        {healthReport.errorClassification && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold">
                            {healthReport.errorClassification}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Evaluated via 3-stage validation suite (Pod Lifecycle + Log Regex Scan + HTTP Service Probe)
                        {healthReport.namespace && ` • Namespace: ${healthReport.namespace}`}
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        setIsCheckingHealth(true);
                        try {
                          await fetchClusterHealth(selectedProjectId);
                        } finally {
                          setIsCheckingHealth(false);
                        }
                      }}
                      disabled={isCheckingHealth}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition cursor-pointer shadow-2xs"
                    >
                      <RotateCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                      <span>{isCheckingHealth ? 'Probing...' : 'Re-check Health'}</span>
                    </button>
                  </div>

                  {/* 3 Probe Result Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center gap-2 text-xs font-mono p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      {healthReport.podCheckPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Stage 1: Pod State</div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          {healthReport.podCheckPassed ? 'Running & Ready' : 'Degraded / CrashLoop'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      {healthReport.logScanPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Stage 2: Log Scan</div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          {healthReport.logScanPassed ? 'Zero Panic / Exceptions' : 'Fatal Error Regex Match'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono p-2 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      {healthReport.healthProbePassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Stage 3: HTTP Probe</div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          {healthReport.healthProbePassed ? 'HTTP 200 Probe OK' : 'Probe Failed'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Log Error Excerpts */}
                  {healthReport.errorExcerpts && healthReport.errorExcerpts.length > 0 && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-rose-900/40 text-[11px] font-mono text-rose-400 overflow-x-auto">
                      <div className="text-[10px] uppercase font-bold text-rose-500 mb-1 flex items-center gap-1.5">
                        <Terminal className="w-3 h-3" />
                        <span>Log Error Trace ({healthReport.errorExcerpts.length} entries):</span>
                      </div>
                      <pre className="whitespace-pre-wrap leading-relaxed">{healthReport.errorExcerpts.join('\n')}</pre>
                    </div>
                  )}

                  {/* Remediation Dispatch Banner */}
                  {healthReport.remediationRequired && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/30">
                      <Zap className="w-4 h-4 shrink-0 text-amber-500" />
                      <div className="leading-tight">
                        <strong className="font-bold">Remediation Loop Activated:</strong> Autonomous bug fix dispatched to Senior Developer (<code>agent-backend</code>).
                        {healthReport.remediationAttempt > 0 && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400 font-bold">
                            Attempt #{healthReport.remediationAttempt} of 2
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pods Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span>Deployed Pods in</span>
                    <code className="text-blue-600 dark:text-blue-400 lowercase">{targetNamespace}</code>
                  </h3>
                  <button
                    onClick={() => fetchClusterWorkloads()}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                {(!liveWorkloads?.pods || liveWorkloads.pods.length === 0) ? (
                  <div className="p-8 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center">
                    <Box className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Live Pods in this Namespace</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                      Click the "Deploy to Cluster" button in the top right to launch your project's containers into the embedded K3s cluster.
                    </p>
                    <button
                      onClick={handleDeploy}
                      disabled={isDeployingCluster || !isOnline}
                      className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition-all"
                    >
                      🚀 Deploy Baseline Manifests
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {liveWorkloads.pods.map((pod) => (
                      <div
                        key={pod.name}
                        className="p-4 rounded-xl bg-white dark:bg-[#111628] border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-blue-500/40 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                pod.phase === 'Running' && pod.is_ready 
                                  ? 'bg-emerald-500 animate-pulse' 
                                  : pod.phase === 'Running'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`} />
                              <span className="font-mono text-xs font-bold truncate text-slate-800 dark:text-slate-200">
                                {pod.name}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              pod.phase === 'Running' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                              {pod.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                            <div>Ready: <strong className="text-slate-700 dark:text-slate-200">{pod.ready}</strong></div>
                            <div>Restarts: <strong className="text-slate-700 dark:text-slate-200">{pod.restarts}</strong></div>
                            <div>Pod IP: <code className="font-mono text-slate-600 dark:text-slate-300">{pod.pod_ip}</code></div>
                            <div>Image: <span className="truncate text-slate-600 dark:text-slate-300">{pod.images[0] || 'default'}</span></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(pod.age).toLocaleTimeString()}
                          </span>
                          <button
                            onClick={() => handleViewLogs(pod)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                          >
                            <Terminal className="w-3 h-3" />
                            <span>Terminal Logs</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Services & Deployments */}
              {liveWorkloads?.deployments && liveWorkloads.deployments.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Deployments & Service Endpoints
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {liveWorkloads.deployments.map((d) => (
                      <div key={d.name} className="p-3.5 rounded-xl bg-white dark:bg-[#111628] border border-slate-200 dark:border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>Deployment: {d.name}</span>
                          <span className="text-emerald-500">{d.ready_replicas} / {d.replicas} Replicas</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Available: {d.available_replicas} • Updated: {d.updated_replicas}
                        </div>
                      </div>
                    ))}

                    {liveWorkloads.services?.map((s) => (
                      <div key={s.name} className="p-3.5 rounded-xl bg-white dark:bg-[#111628] border border-slate-200 dark:border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>Service: {s.name}</span>
                          <span className="text-blue-500 font-mono">{s.ports.join(', ')}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          <span>Type: {s.type} • Cluster IP: <code className="font-mono">{s.cluster_ip}</code></span>
                        </div>
                        <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center justify-between">
                            <span>Local Access (Port Forward)</span>
                          </span>
                          <code className="text-[10px] text-slate-700 dark:text-slate-300 font-mono select-all overflow-x-auto whitespace-nowrap">
                            kubectl port-forward svc/{s.name} 8080:{s.ports[0] ? s.ports[0].split(":")[0] : "80"} -n {liveWorkloads.namespace}
                          </code>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'LOGS' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Select Container:</span>
                  <select
                    value={selectedPodForLogs}
                    onChange={(e) => {
                      setSelectedPodForLogs(e.target.value);
                      fetchPodLogs(e.target.value, targetNamespace);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {liveWorkloads?.pods?.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => selectedPodForLogs && fetchPodLogs(selectedPodForLogs, targetNamespace)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {/* Terminal View */}
              <div className="flex-1 bg-slate-950 rounded-2xl p-4 font-mono text-xs text-slate-200 overflow-y-auto border border-slate-800 shadow-inner">
                {activePodLogs?.isLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Tailing stdout/stderr from pod container...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-emerald-400">
                    {activePodLogs?.logs || 'No output stream from this pod.'}
                  </pre>
                )}
              </div>
            </div>
          )}

          {activeTab === 'PROVISION' && (
            <div className="max-w-xl mx-auto py-6 space-y-6">
              <div className="p-5 rounded-2xl bg-white dark:bg-[#111628] border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span>Dedicated Project Namespace Provisioner</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                  Provisions an isolated Kubernetes namespace with ResourceQuota, LimitRange, and ServiceAccount RBAC.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Namespace Identifier
                    </label>
                    <input
                      type="text"
                      disabled
                      value={targetNamespace}
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        CPU Limit Quota
                      </label>
                      <input
                        type="text"
                        value={cpuLimit}
                        onChange={(e) => setCpuLimit(e.target.value)}
                        placeholder="e.g. 2 or 4"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Memory Limit Quota
                      </label>
                      <input
                        type="text"
                        value={memLimit}
                        onChange={(e) => setMemLimit(e.target.value)}
                        placeholder="e.g. 4Gi"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleProvision}
                    disabled={isProvisioning || !isOnline}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isProvisioning ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Applying Kubernetes Quotas...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Provision Isolated Namespace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
