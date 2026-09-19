import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  Activity, 
  Sun, 
  Moon, 
  ShieldCheck,
  Shield,
  Clock,
  KeyRound,
  RefreshCw,
  Check
} from 'lucide-react';
import { BACKEND_URL, setAccessToken } from '../lib/api';
import { useAuthStore, WorkspaceRole } from '../store/useAuthStore';
import { useStore } from '../store/useStore';

interface InviteDetails {
  workspaceName: string;
  inviterName: string;
  role: string;
  email: string;
  expiresAt: string;
  otpVerified?: boolean;
}

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

const ROLE_BADGE_STYLE: Record<string, string> = {
  owner: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  admin: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  developer: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  viewer: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

export const InviteAcceptPage: React.FC<{ token: string }> = ({ token }) => {
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<'OTP_VERIFY' | 'SET_CREDENTIALS' | 'SUCCESS'>('OTP_VERIFY');
  
  // Step 1: OTP verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 2: User details
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Request OTP function
  const requestOtp = async (isManual = false) => {
    setIsRequestingOtp(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/invites/${token}/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch verification code');
      }
      setOtpSentMessage(data.message || 'Verification code sent to your email');
      setResendCooldown(60);
    } catch (err: any) {
      if (isManual) {
        setError(err.message || 'Failed to send OTP code');
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/invites/${token}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setDetails(d);
          if (d.otpVerified) {
            setStep('SET_CREDENTIALS');
          } else {
            // Automatically request OTP code on page load
            requestOtp();
          }
        }
      })
      .catch(() => setNotFound(true));
  }, [token]);

  // Handle individual digit input
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length > 1) {
      // Pasted full code or multiple digits
      const digits = clean.slice(0, 6).split('');
      const next = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 6) next[i] = d;
      });
      setOtpDigits(next);
      const focusTarget = Math.min(digits.length, 5);
      const el = document.getElementById(`otp-input-${focusTarget}`);
      if (el) el.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);

    // Auto-advance to next input
    if (clean && index < 5) {
      const nextEl = document.getElementById(`otp-input-${index + 1}`);
      if (nextEl) nextEl.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevEl = document.getElementById(`otp-input-${index - 1}`);
      if (prevEl) prevEl.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code');
      return;
    }

    setError('');
    setIsVerifyingOtp(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/invites/${token}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }
      // OTP verified successfully
      setStep('SET_CREDENTIALS');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to accept invite');
      }
      const data = await res.json();
      setAccessToken(data.accessToken);
      useAuthStore.setState({
        user: data.user,
        workspace: data.workspace,
        role: data.role as WorkspaceRole,
        isAuthenticated: true,
      });

      setStep('SUCCESS');
      setTimeout(() => {
        window.history.replaceState({}, '', '/');
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to join workspace');
    } finally {
      setIsLoading(false);
    }
  };

  // Header Component
  const renderHeader = () => (
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
  );

  // Footer Component
  const renderFooter = () => (
    <footer className="relative z-10 w-full px-6 lg:px-12 py-3.5 border-t border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-[#07090e]/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500 transition-colors">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>AgentForge Enterprise · Zero-Trust RBAC & Session JWT Security</span>
      </div>
      <div>
        <span>Multi-Tenant Architecture · Kubernetes v1.31 Ready</span>
      </div>
    </footer>
  );

  // Background Ambience Elements
  const renderBackground = () => (
    <>
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-400/10 dark:bg-blue-600/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-300/10 dark:bg-indigo-600/10 blur-[160px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-cyan-400/5 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div 
        className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none"
        style={{
          maskImage: 'radial-gradient(ellipse at center, black 45%, transparent 88%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 45%, transparent 88%)',
        }}
      />
    </>
  );

  // Loading State
  if (isLoading && !details) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-hidden relative select-none font-sans transition-colors duration-200">
        {renderBackground()}
        {renderHeader()}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="text-xs font-mono tracking-wider text-slate-500">VERIFYING INVITATION TOKEN...</span>
        </main>
        {renderFooter()}
      </div>
    );
  }

  // Not Found / Expired State
  if (notFound) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-hidden relative select-none font-sans transition-colors duration-200">
        {renderBackground()}
        {renderHeader()}
        <main className="relative z-10 flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-2xl bg-white/95 dark:bg-[#0d121f]/90 border border-slate-200/90 dark:border-slate-700/70 shadow-xl dark:shadow-2xl backdrop-blur-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invitation Expired or Invalid</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                This invitation link has expired or has already been used to join AgentForge. Please request a new invite link from your workspace owner or admin.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        </main>
        {renderFooter()}
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-hidden relative select-none font-sans transition-colors duration-200">
        {renderBackground()}
        {renderHeader()}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          <span className="text-xs font-mono tracking-wider text-slate-500">LOADING WORKSPACE DETAILS...</span>
        </main>
        {renderFooter()}
      </div>
    );
  }

  const roleStyle = ROLE_BADGE_STYLE[details.role.toLowerCase()] || ROLE_BADGE_STYLE.developer;

  return (
    <div className="min-h-screen w-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-x-hidden relative select-none font-sans transition-colors duration-200">
      {renderBackground()}
      {renderHeader()}

      {/* Main Dual-Pane Hero & Invite Form */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
        
        {/* Left Side: Digital Workforce & Welcome Showcase */}
        <div className="w-full lg:w-7/12 flex flex-col justify-center space-y-7">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs font-mono text-blue-700 dark:text-blue-300 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Team Invitation from {details.inviterName}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Co-work with an autonomous <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-cyan-300 dark:to-indigo-400">
                AI engineering workforce.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              <strong className="text-slate-900 dark:text-slate-200 font-semibold">{details.inviterName}</strong> has invited you to collaborate in <strong className="text-blue-600 dark:text-blue-400 font-semibold">{details.workspaceName}</strong> as a <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">{details.role}</span>.
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
            <div className="space-y-0.5">
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                {details.workspaceName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Target Workspace</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1 capitalize">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {details.role} Role
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Granted Access</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                72h Token
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Single-Use Invite</div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Glassmorphic Cockpit Card */}
        <div className="w-full lg:w-5/12 max-w-md">
          <div className="relative group">
            {/* Outer Glow Edge */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-cyan-500/15 dark:from-blue-600/30 dark:via-indigo-600/30 dark:to-cyan-500/30 opacity-70 blur-xl group-hover:opacity-100 transition duration-500" />

            <div className="relative bg-white/95 dark:bg-[#0d121f]/90 border border-slate-200/90 dark:border-slate-700/70 rounded-2xl p-7 sm:p-8 shadow-xl dark:shadow-2xl shadow-slate-200/50 backdrop-blur-2xl transition-colors">
              
              {/* Header inside form */}
              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                    {step === 'OTP_VERIFY' ? 'Verify Your Email' : step === 'SET_CREDENTIALS' ? 'Create Your Account' : 'Welcome to AgentForge'}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase border ${roleStyle}`}>
                    {details.role}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {step === 'OTP_VERIFY'
                    ? `Security verification required to join ${details.workspaceName}`
                    : `Set up your credentials for ${details.workspaceName}`}
                </p>
              </div>

              {/* Step indicator tabs */}
              <div className="flex items-center gap-2 mb-5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
                <div className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${step === 'OTP_VERIFY' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-500'}`}>
                  <KeyRound className="w-3 h-3" />
                  <span>1. Verify Email</span>
                </div>
                <div className="text-slate-300 dark:text-slate-700">→</div>
                <div className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${step === 'SET_CREDENTIALS' || step === 'SUCCESS' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs' : 'text-slate-500'}`}>
                  <Lock className="w-3 h-3" />
                  <span>2. Credentials</span>
                </div>
              </div>

              {/* Step 1: OTP Verification Form */}
              {step === 'OTP_VERIFY' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                        6-Digit Security Code
                      </label>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {details.email}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Enter the one-time verification code sent to your email to prove ownership and proceed.
                    </p>

                    {/* 6 Digit segmented input boxes */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`otp-input-${idx}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          className="w-11 h-12 text-center text-lg font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      ))}
                    </div>
                  </div>

                  {otpSentMessage && !error && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px]">
                      <Check className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>{otpSentMessage}</span>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpDigits.join('').length !== 6}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 group mt-2"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Security Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Code & Unlock Setup</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Resend button */}
                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-500">
                    <span>Didn't receive code?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isRequestingOtp}
                      onClick={() => requestOtp(true)}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
                    >
                      {isRequestingOtp ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Account Details & Password Form */}
              {step === 'SET_CREDENTIALS' && (
                <form onSubmit={handleAccept} className="space-y-4">
                  {/* Verified Email Banner */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-mono text-emerald-800 dark:text-emerald-300 truncate max-w-[200px]">
                        {details.email}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Verified ✓
                    </span>
                  </div>

                  {/* Name Field */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Vance"
                        required
                        autoFocus
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                        Create Password
                      </label>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Min 8 characters</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        minLength={8}
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

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 group mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Activating Account & Joining...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup & Join Workspace</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Step 3: Success State */}
              {step === 'SUCCESS' && (
                <div className="py-8 text-center space-y-4 animate-in zoom-in-95">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/20 shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Workspace Joined!</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Your identity has been verified and registered. Redirecting to <strong>{details.workspaceName}</strong>...
                    </p>
                  </div>
                  <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin mx-auto pt-2" />
                </div>
              )}

              {/* Return to Sign-in link */}
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/'; }}
                  className="text-[11px] text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                >
                  Already have an account? <span className="font-semibold underline">Sign In</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>

      {renderFooter()}
    </div>
  );
};
