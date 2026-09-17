import React, { useState } from 'react';
import { useServiceAccountStore } from '../../store/useServiceAccountStore';
import { useStore } from '../../store/useStore';
import { ServiceAccount } from '../../types/serviceAccount';
import { 
  Key, 
  ShieldAlert, 
  Plus, 
  Copy, 
  Check, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Server,
  X,
  Shield,
  Terminal
} from 'lucide-react';

const AVAILABLE_SCOPES = [
  { id: 'projects:read', label: 'Projects Read', description: 'View project metadata and architecture blueprints' },
  { id: 'projects:write', label: 'Projects Write', description: 'Create and modify project definitions and requirements' },
  { id: 'tasks:execute', label: 'Tasks Execute', description: 'Dispatch and run automated AI agent coding tasks' },
  { id: 'events:read', label: 'Events Read', description: 'Stream real-time Kafka audit events and telemetry' },
  { id: 'incidents:write', label: 'Incidents Write', description: 'Trigger and resolve production War Room incidents' },
  { id: 'artifacts:upload', label: 'Artifacts Upload', description: 'Upload build artifacts and compiled binaries' },
];

export const ServiceAccountsDashboard: React.FC = () => {
  const { 
    serviceAccounts, 
    loading, 
    fetchServiceAccounts, 
    createServiceAccount, 
    revokeServiceAccount,
    recentlyCreatedKey,
    clearRecentlyCreatedKey
  } = useServiceAccountStore();

  const projects = useStore((state) => state.projects);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('proj-1');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['projects:read', 'tasks:execute']);
  const [submitting, setSubmitting] = useState(false);

  // Revoke confirmation modal state
  const [revokingAccount, setRevokingAccount] = useState<ServiceAccount | null>(null);

  // Copied state for raw key modal
  const [copiedRawKey, setCopiedRawKey] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('ALL');

  const handleOpenCreate = () => {
    setAccountName('');
    setSelectedScopes(['projects:read', 'tasks:execute']);
    setIsCreateModalOpen(true);
  };

  const handleToggleScope = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scopeId));
    } else {
      setSelectedScopes([...selectedScopes, scopeId]);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || selectedScopes.length === 0) return;

    setSubmitting(true);
    await createServiceAccount(accountName.trim(), selectedProjectId, selectedScopes);
    setSubmitting(false);
    setIsCreateModalOpen(false);
  };

  const handleCopyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRawKey(true);
    setTimeout(() => setCopiedRawKey(false), 2500);
  };

  const filteredAccounts = serviceAccounts.filter((sa) => {
    const matchesSearch = sa.name.toLowerCase().includes(searchQuery.toLowerCase()) || sa.maskedKey.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'ALL' || sa.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Never used';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago (${date.toLocaleDateString()})`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#07090e] overflow-y-auto p-6 font-sans">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 dark:bg-indigo-950/50 border border-indigo-400/30 text-indigo-600 dark:text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Service Account Management
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                  Secure Vault
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Create cryptographically scoped API credentials, monitor live last-used timestamps, and trigger instant revocation with cache invalidation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchServiceAccounts()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-colors cursor-pointer"
            title="Refresh service accounts cache"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Cache</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Service Account</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service accounts or keys..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 dark:text-slate-400">Filter Project:</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
          >
            <option value="ALL">All Projects</option>
            <option value="proj-1">proj-1: Enterprise E-Commerce Microservices</option>
            <option value="proj-2">proj-2: Customer Onboarding OAuth2 API</option>
          </select>
        </div>
      </div>

      {/* Service Accounts Table */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Service Account Name</th>
                <th className="py-3 px-4">Project Scope</th>
                <th className="py-3 px-4">API Key Hash</th>
                <th className="py-3 px-4">Assigned Scopes</th>
                <th className="py-3 px-4">Last Used Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-50" />
                    <span>No service accounts match your criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((sa) => (
                  <tr key={sa.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{sa.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {sa.id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                        {sa.projectId}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[11px]">
                          {sa.maskedKey}
                        </span>
                        <button
                          onClick={() => handleCopyKey(sa.maskedKey)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          title="Copy masked key identifier"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {sa.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 font-mono"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className={sa.revoked ? 'text-slate-400 line-through' : 'font-medium'}>
                          {formatTimestamp(sa.lastUsedAt)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {sa.revoked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Revoked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!sa.revoked && (
                        <button
                          onClick={() => setRevokingAccount(sa)}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 transition-colors cursor-pointer"
                        >
                          Revoke Key
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SERVICE ACCOUNT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Key className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">Create Scoped Service Account</h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Account Name
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. CI/CD Pipeline GitHub Actions"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Project Scope
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="proj-1">proj-1: Enterprise E-Commerce Microservices</option>
                  <option value="proj-2">proj-2: Customer Onboarding OAuth2 API</option>
                  <option value="proj-global">Global (All Projects)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Fine-Grained Permission Scopes
                </label>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <div
                        key={scope.id}
                        onClick={() => handleToggleScope(scope.id)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 text-slate-900 dark:text-white'
                            : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-semibold font-mono text-xs">{scope.id}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{scope.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedScopes.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Generating Key...' : 'Generate API Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECENTLY CREATED RAW KEY MODAL (SHOWN ONCE) */}
      {recentlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-500/10">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h2 className="font-bold text-sm">Service Account Created Successfully</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> Copy your secret API key now. For security, it will never be displayed again.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Account Name
                </label>
                <div className="text-xs font-medium text-slate-900 dark:text-white">{recentlyCreatedKey.name}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Secret API Key (af_live_...)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={recentlyCreatedKey.rawKey || recentlyCreatedKey.maskedKey}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none select-all"
                  />
                  <button
                    onClick={() => handleCopyKey(recentlyCreatedKey.rawKey || recentlyCreatedKey.maskedKey)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all shrink-0 cursor-pointer"
                  >
                    {copiedRawKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRawKey ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={clearRecentlyCreatedKey}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                >
                  I have saved this key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE CONFIRMATION MODAL WITH CACHE INVALIDATION */}
      {revokingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-rose-500/10">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h2 className="font-bold text-sm">Confirm Key Revocation & Cache Invalidation</h2>
              </div>
              <button
                onClick={() => setRevokingAccount(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Are you sure you want to revoke <strong className="text-slate-900 dark:text-white">{revokingAccount.name}</strong> (<span className="font-mono text-[11px]">{revokingAccount.maskedKey}</span>)?
              </p>

              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/40 text-rose-800 dark:text-rose-200 text-xs">
                <strong>Action Effect:</strong> This will instantly invalidate all Redis/memory API key caches across distributed microservices. Any subsequent requests using this key will be rejected immediately with HTTP 401 Unauthorized.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRevokingAccount(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await revokeServiceAccount(revokingAccount.id);
                    setRevokingAccount(null);
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                >
                  Yes, Revoke Instantly
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
