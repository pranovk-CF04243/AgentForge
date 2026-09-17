import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { 
  FileText, 
  UploadCloud, 
  Sparkles, 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Layers,
  FileCheck,
  Building2,
  GitBranch,
  Cpu,
  ShieldCheck,
  Zap,
  Terminal,
  RotateCcw
} from 'lucide-react';

export const BRDIntakeModal: React.FC = () => {
  const isBRDModalOpen = useStore((state) => state.isBRDModalOpen);
  const setBRDModalOpen = useStore((state) => state.setBRDModalOpen);
  const projects = useStore((state) => state.projects);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const analyzeBRD = useStore((state) => state.analyzeBRD);

  const [activeTab, setActiveTab] = useState<'DOCUMENT' | 'STRUCTURED'>('DOCUMENT');
  const [targetProjectId, setTargetProjectId] = useState(selectedProjectId || 'proj-1');

  // Document Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentContent, setDocumentContent] = useState('');
  const [supplementaryNotes, setSupplementaryNotes] = useState('');

  // Structured Form State
  const [title, setTitle] = useState('');
  const [narrative, setNarrative] = useState('');
  const [targetBranch, setTargetBranch] = useState('feature/enhancement');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([
    'Endpoints must return valid JSON with error handling',
    'Automated unit and integration test coverage',
  ]);
  const [newCriterion, setNewCriterion] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected project ID when opened
  useEffect(() => {
    if (selectedProjectId) {
      setTargetProjectId(selectedProjectId);
    }
  }, [selectedProjectId, isBRDModalOpen]);

  // Keyboard Shortcuts: Esc to close, Cmd/Ctrl + Enter to analyze
  useEffect(() => {
    if (!isBRDModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBRDModalOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAnalyze();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBRDModalOpen, isAnalyzing, activeTab, documentContent, narrative, targetProjectId, title, targetBranch, acceptanceCriteria, supplementaryNotes]);

  if (!isBRDModalOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setDocumentContent(text || '');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setDocumentContent(text || '');
    };
    reader.readAsText(file);
  };

  const addCriterion = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCriterion.trim()) return;
    setAcceptanceCriteria([...acceptanceCriteria, newCriterion.trim()]);
    setNewCriterion('');
  };

  const addPresetCriterion = (text: string) => {
    if (acceptanceCriteria.includes(text)) return;
    setAcceptanceCriteria([...acceptanceCriteria, text]);
  };

  const removeCriterion = (idx: number) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== idx));
  };

  const appendArchitectureTag = (tagText: string) => {
    setSupplementaryNotes((prev) => {
      if (!prev.trim()) return tagText;
      if (prev.includes(tagText)) return prev;
      return `${prev.trim()}; ${tagText}`;
    });
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;

    let payloadContent = '';
    let payloadTitle = title.trim() || 'System Initiative';

    if (activeTab === 'DOCUMENT') {
      if (!documentContent.trim()) return;
      payloadContent = documentContent;
    } else {
      if (!narrative.trim()) return;
      payloadContent = `FEATURE TITLE: ${payloadTitle}\n\nOBJECTIVE & NARRATIVE:\n${narrative}\n\nTARGET BRANCH: ${targetBranch}\n\nACCEPTANCE CRITERIA:\n${acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}${supplementaryNotes.trim() ? `\n\nSUPPLEMENTARY ARCHITECTURE NOTES:\n${supplementaryNotes.trim()}` : ''}`;
    }

    setIsAnalyzing(true);
    try {
      await analyzeBRD({
        projectId: targetProjectId,
        title: payloadTitle,
        content: payloadContent,
        supplementaryNotes: supplementaryNotes.trim(),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const estimatedTokens = Math.round((documentContent.length || narrative.length) / 4);
  const targetProject = projects[targetProjectId] || Object.values(projects)[0];

  const architecturePresets = [
    'PostgreSQL partition keys & foreign cascade',
    'Redis token bucket rate limiting (100 req/min)',
    'Zero-trust HMAC & JWT bearer auth verification',
    'Kafka asynchronous event ingestion & DLQ',
    'Docker Compose service isolation with healthchecks',
    'P99 latency < 50ms with connection pooling'
  ];

  const criteriaPresets = [
    'Zero-trust auth middleware verifying JWT signature before routing',
    'PostgreSQL database migration with transactional up/down scripts',
    'Automated unit and integration test coverage with mocked external dependencies',
    'Structured JSON error format with trace ID and status code',
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-[#0e121e] border border-slate-200 dark:border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh] ring-1 ring-slate-900/5 dark:ring-white/10 transition-colors duration-200">
        
        {/* Modern Studio Header */}
        <div className="bg-slate-50/90 dark:bg-[#131726]/95 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  BRD Intake & Specification Studio
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300/40 dark:border-cyan-800/60 font-medium">
                  <Zap className="w-3 h-3 text-cyan-500" />
                  Gemini 3.5 AI Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Transform business requirements and technical specs into verified engineering DAG tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Personas Presence Badge */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex -space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-white dark:ring-slate-900" title="Dr. Marcus Cole (Chief Architect)">
                  MC
                </span>
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-white dark:ring-slate-900" title="Orion Spark (Lead BA)">
                  OS
                </span>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Architect & BA Active</span>
            </div>

            <button
              onClick={() => setBRDModalOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Context Ribbon: Project Target & Segmented Tabs */}
        <div className="bg-slate-100/60 dark:bg-[#0a0d16] border-b border-slate-200 dark:border-slate-800/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors">
          {/* Target Project Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Target Project:</span>
            </div>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-cyan-500 shadow-2xs"
            >
              {Object.values(projects).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.building})
                </option>
              ))}
            </select>
            {targetProject && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono hidden md:inline">
                {targetProject.techStack.slice(0, 3).join(', ')}
              </span>
            )}
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl border border-slate-300/60 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('DOCUMENT')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'DOCUMENT'
                  ? 'bg-white dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 shadow-sm border border-slate-200 dark:border-cyan-700/60'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Document (BRD / Spec)</span>
            </button>
            <button
              onClick={() => setActiveTab('STRUCTURED')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'STRUCTURED'
                  ? 'bg-white dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 shadow-sm border border-slate-200 dark:border-cyan-700/60'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Structured Prompt & Criteria</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300">

          {/* TAB 1: Document Upload */}
          {activeTab === 'DOCUMENT' && (
            <div className="space-y-4">
              {/* Modern High-Fidelity Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-cyan-500/80 rounded-2xl p-7 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-[#0a0d16]/70 hover:bg-slate-50 dark:hover:bg-[#0e1322] space-y-3 group shadow-2xs"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".md,.txt,.json,.pdf,.docx,.doc"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto group-hover:scale-108 transition-transform shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    Click to browse or drag & drop specification file
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Accepts Markdown (.md), Text (.txt), JSON, PDF, and Word Documents (.docx)
                  </p>
                </div>

                {/* File extension badges */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {['.MD', '.TXT', '.JSON', '.PDF', '.DOCX'].map((ext) => (
                    <span key={ext} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-medium">
                      {ext}
                    </span>
                  ))}
                </div>

                {uploadedFile && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 dark:bg-cyan-950/80 border border-cyan-400/40 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-xs font-medium mt-2 shadow-xs">
                    <FileCheck className="w-4 h-4 text-cyan-500" />
                    <span>{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                        setDocumentContent('');
                      }}
                      className="ml-1 p-0.5 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Specification Text Content Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Specification Content / Markdown Direct Input</span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    {estimatedTokens > 0 && (
                      <span className="text-cyan-600 dark:text-cyan-400 font-medium">~{estimatedTokens.toLocaleString()} tokens</span>
                    )}
                    {documentContent && (
                      <button
                        type="button"
                        onClick={() => setDocumentContent('')}
                        className="hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={7}
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  placeholder="Parsed document text will appear here. You can also paste raw Markdown or technical documentation directly..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090c14] border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 shadow-2xs leading-relaxed"
                />
              </div>

              {/* Supplementary Architecture Notes Card */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#0a0d17] border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Supplementary Architecture Notes & Technical Constraints (Optional)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Injected into Marcus & Orion's DAG prompt</span>
                </div>

                <textarea
                  rows={3}
                  value={supplementaryNotes}
                  onChange={(e) => setSupplementaryNotes(e.target.value)}
                  placeholder="e.g. Use PostgreSQL for persistence with foreign key cascades; Redis token bucket rate limiting (100 req/min); Zero-trust auth middleware..."
                  className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-[#0e121e] border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs shadow-2xs"
                />

                {/* Quick Architecture Tags */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
                  {architecturePresets.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => appendArchitectureTag(tag)}
                      className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>{tag.split(' ')[0]} {tag.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Structured Form */}
          {activeTab === 'STRUCTURED' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                    <span>Feature / Enhancement Title *</span>
                    <span className="text-[11px] text-slate-400 font-normal">e.g. Multi-Tenant RBAC</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Enterprise Multi-Tenant RBAC & API Key Service"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs shadow-2xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Target Git Feature Branch</span>
                  </label>
                  <input
                    type="text"
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    placeholder="feature/rbac-api-keys"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Narrative Description */}
              <div className="space-y-1">
                <label className="text-slate-700 dark:text-slate-300 font-semibold">
                  Detailed Problem Statement & Business Objective *
                </label>
                <textarea
                  rows={4}
                  required
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Describe what needs to be built, the target users, core business rules, end-to-end data flow, and functional objectives..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs shadow-2xs leading-relaxed resize-none"
                />
              </div>

              {/* Acceptance Criteria Builder Card */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#0a0d17] border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <label className="font-semibold text-slate-800 dark:text-slate-200">
                      Acceptance Criteria & Verification Gates
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-500">{acceptanceCriteria.length} verification rules set</span>
                </div>

                {/* Criteria List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {acceptanceCriteria.map((crit, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-slate-800 text-xs shadow-2xs group hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2.5 flex-1 pr-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{crit}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCriterion(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                        title="Delete criterion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Criterion Input */}
                <form onSubmit={addCriterion} className="flex gap-2">
                  <input
                    type="text"
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    placeholder="Add testable criterion (e.g. Endpoints return 401 on expired tokens)..."
                    className="flex-1 px-3.5 py-2 rounded-lg bg-white dark:bg-[#0a0c13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs shadow-2xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Gate</span>
                  </button>
                </form>

                {/* Quick Criteria Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Recommended Presets:</span>
                  {criteriaPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addPresetCriterion(preset)}
                      className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>{preset.slice(0, 32)}...</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplementary Architecture Notes Card */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#0a0d17] border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <label className="font-semibold text-slate-800 dark:text-slate-200">
                      Supplementary Architecture Notes & Technical Constraints (Optional)
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-500">Tech stack, security, DB schemas, rate limits</span>
                </div>
                <textarea
                  rows={3}
                  value={supplementaryNotes}
                  onChange={(e) => setSupplementaryNotes(e.target.value)}
                  placeholder="e.g. Use PostgreSQL with foreign key cascades; Redis token bucket rate limiting (100 req/min); Zero-trust auth middleware..."
                  className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-[#0e121e] border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs shadow-2xs leading-relaxed"
                />

                {/* Quick Architecture Tags */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Presets:</span>
                  {architecturePresets.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => appendArchitectureTag(tag)}
                      className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>{tag.split(' ')[0]} {tag.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50/90 dark:bg-[#131726]/95 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
            <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Analyzed by Orion Spark (BA) & Dr. Marcus Cole (Architect)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBRDModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || (activeTab === 'DOCUMENT' ? !documentContent.trim() : !narrative.trim())}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-600/25 text-xs cursor-pointer active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzing ? 'Analyzing with BA & Architect...' : 'Analyze & Generate Blueprint'}</span>
              <span className="hidden sm:inline text-[10px] opacity-75 font-mono ml-1 px-1.5 py-0.2 rounded bg-white/20">
                ⌘↵
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
