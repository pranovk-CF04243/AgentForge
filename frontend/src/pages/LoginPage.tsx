import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Github, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Mail, 
  Lock, 
  CheckCircle2, 
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { apiFetchJSON } from '../lib/api';

type Mode = 'login' | 'bootstrap';

const SHOWCASE_AGENTS = [
  {
    name: 'Dr. Marcus Cole',
    role: 'Principal Software Architect',
    status: 'Validating System DAG',
    dept: 'Architecture',
    color: 'from-blue-500 to-indigo-600',
    avatar: 'MC',
    pulse: 'bg-blue-500 dark:bg-blue-400',
  },
  {
    name: 'Caleb Vance',
    role: 'Staff SRE & Kubernetes Lead',
    status: 'Canary Health 100% Pods',
    dept: 'DevOps',
    color: 'from-emerald-500 to-teal-600',
    avatar: 'CV',
    pulse: 'bg-emerald-500 dark:bg-emerald-400',
  },
  {
    name: 'Orion Spark',
    role: 'Lead Business Analyst',
    status: 'Decomposing PRD to Epics',
    dept: 'Product',
    color: 'from-purple-500 to-pink-600',
    avatar: 'OS',
    pulse: 'bg-purple-500 dark:bg-purple-400',
  },
  {
    name: 'Devon Reed',
    role: 'Senior QA Automation Lead',
    status: 'Zero Regressions Verified',
    dept: 'Quality',
    color: 'from-amber-500 to-orange-600',
    avatar: 'DR',
    pulse: 'bg-amber-500 dark:bg-amber-400',
  },
];

const PLATFORM_METRICS = [
  { label: 'Digital Workforce', value: '14 Agents' },
  { label: 'Security Standard', value: 'Zero-Trust RBAC' },
  { label: 'Infra Deployment', value: 'Live K8s GitOps' },
];

export const LoginPage: React.FC = () => {
  const { login, loginWithGitHub, bootstrapRequired } = useAuthStore();
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    if (bootstrapRequired) setMode('bootstrap');
    else setMode('login');
  }, [bootstrapRequired]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      let msg = err.message || 'Invalid email or password';
      try {
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(msg.slice(jsonStart));
          if (parsed.error) msg = parsed.error;
        }
      } catch {}
      if (msg.includes('Failed to fetch')) {
        msg = 'Connection error: unable to reach backend engine at http://localhost:8080';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const data = await apiFetchJSON<{ accessToken: string; user: any; workspace: any; role: string }>(
        '/api/auth/bootstrap',
        {
          method: 'POST',
          body: JSON.stringify({ name, email, password, workspaceName }),
        }
      );
      const { setAccessToken } = await import('../lib/api');
      setAccessToken(data.accessToken);
      useAuthStore.setState({
        user: data.user,
        workspace: data.workspace,
        role: data.role as any,
        isAuthenticated: true,
        bootstrapRequired: false,
      });
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      import('../lib/api').then(({ setAccessToken }) => {
        setAccessToken(token);
        window.history.replaceState({}, '', window.location.pathname);
        useAuthStore.getState().restoreSession();
      });
    }
  };

  useEffect(() => {
    handleGitHubCallback();
  }, []);

  const fillCredentials = (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError('');
  };

  return (
    <div className="min-h-screen w-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-x-hidden relative select-none font-sans transition-colors duration-200">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-400/10 dark:bg-blue-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-300/10 dark:bg-indigo-600/10 blur-[160px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-cyan-400/5 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* Cybernetic Grid Overlay (Adapts to Light & Dark) */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"
        style={{
          maskImage: 'radial-gradient(ellipse at center, black 45%, transparent 88%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 45%, transparent 88%)',
        }}
      />

      {/* Top Brand Header Bar */}
      <header className="relative z-10 w-full px-6 lg:px-12 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-[#07090e]/60 backdrop-blur-md transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white font-mono">AgentForge</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold tracking-wider">
              Autonomous OS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Core Engine Online</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center shadow-2xs cursor-pointer group"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500 group-hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 group-hover:-rotate-12 transition-transform" />
            )}
          </button>
        </div>
      </header>

      {/* Main Dual-Pane Hero & Auth Layout */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
        
        {/* Left Side: Futuristic Digital Workforce Showcase */}
        <div className="w-full lg:w-7/12 flex flex-col justify-center space-y-7">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs font-mono text-blue-700 dark:text-blue-300 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Full-Lifecycle Autonomous AI Engineering Office</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Deploy an autonomous <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-cyan-300 dark:to-indigo-400">
                AI digital workforce.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              14 specialized digital engineers orchestrating product epics, architectural DAGs, code synthesis, testing pipelines, and Kubernetes GitOps deployments.
            </p>
          </div>

          {/* Live Agent Telemetry Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            {SHOWCASE_AGENTS.map((agent, i) => (
              <div 
                key={i} 
                className="group relative p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/90 hover:border-blue-400 dark:hover:border-blue-500/40 hover:bg-white dark:hover:bg-slate-900/90 transition-all duration-300 backdrop-blur-md shadow-sm dark:shadow-lg shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center text-[10px] font-bold text-white font-mono shadow-xs`}>
                      {agent.avatar}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-white transition-colors truncate max-w-[130px]">
                        {agent.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                        {agent.role}
                      </p>
                    </div>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.pulse} animate-ping`} />
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/50 text-[10px] font-mono">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5 text-blue-500 dark:text-blue-400" />
                    {agent.status}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">{agent.dept}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Platform Highlights Ticker */}
          <div className="flex items-center gap-6 pt-2 border-t border-slate-200 dark:border-slate-800/80 max-w-xl">
            {PLATFORM_METRICS.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  {item.value}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Glassmorphic Cockpit Card */}
        <div className="w-full lg:w-5/12 max-w-md">
          <div className="relative group">
            {/* Outer Glow Edge */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-cyan-500/15 dark:from-blue-600/30 dark:via-indigo-600/30 dark:to-cyan-500/30 opacity-70 blur-xl group-hover:opacity-100 transition duration-500" />

            <div className="relative bg-white/95 dark:bg-[#0d121f]/90 border border-slate-200/90 dark:border-slate-700/70 rounded-2xl p-7 sm:p-8 shadow-xl dark:shadow-2xl shadow-slate-200/50 backdrop-blur-2xl transition-colors">
              
              {/* Header inside form */}
              <div className="mb-6 space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                    {mode === 'bootstrap' ? 'Initialize Workspace' : 'Sign in to Command'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    {mode === 'bootstrap' ? 'SETUP' : 'ENTERPRISE'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {mode === 'bootstrap' 
                    ? 'Create the primary Owner account & workspace credentials' 
                    : 'Access your team dashboard, 3D office, and agent pipelines'}
                </p>
              </div>

              {/* Login Mode */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                      Work Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                        Password
                      </label>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Protected by Bcrypt</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Quick-Fill Credentials Helper Pills */}
                  <div className="pt-1">
                    <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                      Quick Demo Autofill:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fillCredentials('owner@agentforge.ai', 'Password123!')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-amber-200 dark:border-slate-700/70 text-[11px] font-mono text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        title="Fill Owner account"
                      >
                        <span>👑</span>
                        <span>Owner</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fillCredentials('developer@agentforge.ai', 'Password123!')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-emerald-200 dark:border-slate-700/70 text-[11px] font-mono text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        title="Fill Developer account"
                      >
                        <span>⚡</span>
                        <span>Developer</span>
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 group mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Command Center</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <span className="relative px-3 bg-white dark:bg-[#0d121f] text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      OR AUTHENTICATE WITH
                    </span>
                  </div>

                  {/* GitHub OAuth Button */}
                  <button
                    type="button"
                    onClick={loginWithGitHub}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 font-medium text-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs"
                  >
                    <Github className="w-4 h-4 text-slate-900 dark:text-white" />
                    <span>Continue with GitHub</span>
                  </button>

                  {/* Invite-Only Notice */}
                  <p className="text-center text-[11px] text-slate-500 pt-1">
                    Access is invite-only. Contact your workspace administrator for an invitation link.
                  </p>
                </form>
              )}

              {/* Bootstrap Mode (First Run) */}
              {mode === 'bootstrap' && (
                <form onSubmit={handleBootstrap} className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-mono">
                    <Building2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>First-time setup: Create Owner account & Workspace</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Vance"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono mb-1">
                        Workspace Name
                      </label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="AgentForge Core"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono mb-1">
                      Owner Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@company.com"
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono mb-1">
                      Master Password <span className="text-slate-500">(min 8 chars)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        minLength={8}
                        required
                        className="w-full px-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                    <span>{isLoading ? 'Creating Workspace...' : 'Initialize Workspace'}</span>
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Footer System Status Bar */}
      <footer className="relative z-10 w-full px-6 lg:px-12 py-3.5 border-t border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-[#07090e]/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500 transition-colors">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>AgentForge Enterprise · Zero-Trust RBAC & Session JWT Security</span>
        </div>
        <div>
          <span>Multi-Tenant Architecture · Kubernetes v1.31 Ready</span>
        </div>
      </footer>
    </div>
  );
};
