import { useState } from 'react';
import { 
  ArrowRight, FileText, Shield, Zap, Scale, MessageSquare, 
  AlertTriangle, Lock, Globe, FileSearch, CheckCircle2, ChevronDown,
  Search, Activity, Handshake
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

interface DemoClause {
  title: string;
  original: string;
  aiAnalysis: string;
  risk: string;
  riskColor: string;
  remediation: string;
}

const DEMO_CLAUSES: Readonly<Record<'term' | 'indem' | 'ip', DemoClause>> = Object.freeze({
  term: {
    title: "Termination Clause",
    original: "This Agreement may be terminated by either party upon thirty (30) days prior written notice; provided, however, that Company may terminate this Agreement immediately without notice or penalty in the event of any breach of confidentiality by Contractor.",
    aiAnalysis: "UNBALANCED RISK: The immediate termination option without notice or penalty is highly unilateral and only benefits the Company. Contractor is not granted reciprocal rights.",
    risk: "High Risk",
    riskColor: "text-red-650 bg-red-500/10 border-red-500/20 dark:text-red-500",
    remediation: "Negotiate a reciprocal 7-day cure period for any breach of confidentiality before immediate termination can take place."
  },
  indem: {
    title: "Indemnification Clause",
    original: "Contractor agrees to defend, indemnify, and hold harmless the Company and its affiliates from and against any and all claims, liabilities, losses, damages, costs, and expenses (including reasonable attorneys' fees) arising out of or related to Contractor's performance of services.",
    aiAnalysis: "BROAD LIABILITY: The clause covers 'any and all claims' arising out of performance, regardless of fault or negligence by the Contractor.",
    risk: "Medium Risk",
    riskColor: "text-amber-650 bg-amber-500/10 border-amber-500/20 dark:text-amber-500",
    remediation: "Limit indemnification solely to third-party claims arising directly from the Contractor's gross negligence or willful misconduct."
  },
  ip: {
    title: "Intellectual Property Clause",
    original: "All deliverables, materials, inventions, and work product developed or prepared by Contractor in the performance of services under this Agreement shall belong solely and exclusively to the Company, and Contractor hereby assigns all intellectual property rights therein.",
    aiAnalysis: "FULL TRANSFER: Complete transfer of all developed work. Pre-existing materials are not explicitly carved out.",
    risk: "Low Risk",
    riskColor: "text-blue-650 bg-blue-500/10 border-blue-500/20 dark:text-blue-500",
    remediation: "Add a clear 'Pre-Existing IP' clause to protect and exclude your proprietary background libraries or tools from automatic assignment."
  }
});

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: ReadonlyArray<FaqItem> = Object.freeze([
  {
    q: "How does LegalEase simplify legal jargon?",
    a: "LegalEase uses state-of-the-art NLP and large language models (like Schematron-3B and BERT extractive models) to scan your uploaded documents, recognize standard boilerplate clauses, isolate high-liability terms, and translate legalese into concise, human-readable summaries."
  },
  {
    q: "Are my sensitive legal documents stored securely?",
    a: "Absolutely. LegalEase operates under strict local security protocols. Your files are encrypted in transit and at rest, and processed using localized APIs. We do not sell, train on, or share your proprietary documents with external parties."
  },
  {
    q: "What document formats does the platform support?",
    a: "We currently support PDF files (with text parsing and extraction), Microsoft Word (.docx) documents, and standard text (.txt) files. Scanned images can be parsed using the textual layer."
  },
  {
    q: "Can I customize the risk audit parameters?",
    a: "Yes. In the Settings dashboard, you can define risk thresholds, highlight specific concern categories (e.g. intellectual property, payment limits, indemnity cap ratios), and configure custom automated summary outputs."
  }
]);

interface WorkflowStep {
  title: string;
  desc: string;
  icon: React.ComponentType<any>;
  gradient: string;
  glowColor: string;
  route: string;
}

const WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = [
  {
    title: "INGEST",
    desc: "Secure PDF upload to isolated cloud vault.",
    icon: Zap,
    gradient: "from-red-500 via-orange-500 to-red-650",
    glowColor: "rgba(239, 68, 68, 0.4)",
    route: "/documents"
  },
  {
    title: "STRUCTURAL PARSE",
    desc: "AI detects clauses, headers, and parties.",
    icon: Search,
    gradient: "from-amber-500 via-orange-400 to-yellow-500",
    glowColor: "rgba(245, 158, 11, 0.4)",
    route: "/processing"
  },
  {
    title: "RISK SCANNING",
    desc: "Agent identifies 50+ legal red flags.",
    icon: Shield,
    gradient: "from-emerald-500 via-teal-500 to-emerald-650",
    glowColor: "rgba(16, 185, 129, 0.4)",
    route: "/dashboard"
  },
  {
    title: "SIMPLIFICATION",
    desc: "Legalese translated to plain human language.",
    icon: FileText,
    gradient: "from-blue-500 via-cyan-500 to-blue-650",
    glowColor: "rgba(59, 130, 246, 0.4)",
    route: "/chatbot"
  },
  {
    title: "TRUST SCORING",
    desc: "Safety metrics and risk ratings calculated.",
    icon: Activity,
    gradient: "from-indigo-500 via-purple-500 to-indigo-650",
    glowColor: "rgba(99, 102, 241, 0.4)",
    route: "/dashboard"
  },
  {
    title: "CONSULTATION",
    desc: "Interactive AI follow-up for deep clarity.",
    icon: Handshake,
    gradient: "from-fuchsia-500 via-pink-500 to-purple-600",
    glowColor: "rgba(217, 70, 239, 0.4)",
    route: "/chatbot"
  }
];

export function HomePage() {
  const [activeDemoClause, setActiveDemoClause] = useState<'term' | 'indem' | 'ip'>('term');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="overflow-hidden bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-200">
      
      {/* Hero Section with Glowing Mesh Gradients (Theme Adaptive) */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50/50 via-indigo-50/20 to-emerald-50/20 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950 text-gray-900 dark:text-white overflow-hidden border-b border-gray-200/80 dark:border-gray-800">
        
        {/* Futuristic Adaptive Background Gradients */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 dark:bg-primary-600 rounded-full filter blur-[80px] dark:blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-800/10 dark:bg-blue-800 rounded-full filter blur-[70px] dark:blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-10 right-10 w-64 h-64 bg-emerald-700/10 dark:bg-emerald-700 rounded-full filter blur-[90px] opacity-20 dark:opacity-30"></div>
        </div>

        {/* Decorative Adaptive Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb60_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb60_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#8080800e_1px,transparent_1px),linear-gradient(to_bottom,#8080800e_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

        <div className="app-container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Hero Column */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Feature Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-600/10 dark:bg-primary-500/10 border border-primary-600/20 dark:border-primary-500/30 text-primary-750 dark:text-primary-300 text-xs font-semibold mb-6 hover:bg-primary-600/20 dark:hover:bg-primary-500/20 transition-all duration-300">
                <Zap size={12} className="text-primary-600 dark:text-primary-400" />
                <span>Next-Gen Legal AI Assistant</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-gray-900 dark:text-white dark:bg-gradient-to-r dark:from-white dark:via-gray-100 dark:to-blue-200 dark:bg-clip-text dark:text-transparent">
                Simplify Complex <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">Legal Documents</span> In Seconds
              </h1>

              <p className="text-lg text-gray-650 dark:text-gray-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Stop drowning in complex legal jargon. Instantly upload agreements, NDA contracts, and leases to audit liabilities, identify high-risk clauses, and generate plain-English summaries instantly.
              </p>

              <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                <NavLink
                  to="/documents"
                  className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-500 shadow-[0_0_20px_rgba(37,99,235,0.2)] dark:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] dark:hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 animate-pulse" />
                </NavLink>
                <NavLink
                  to="/chatbot"
                  className="inline-flex items-center justify-center px-8 py-3.5 border border-gray-300 dark:border-gray-700 text-base font-semibold rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/80 backdrop-blur-sm transition-all duration-300"
                >
                  <MessageSquare size={18} className="mr-2 text-primary-600 dark:text-primary-400" />
                  Try Live Chatbot
                </NavLink>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800/60 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 text-center lg:text-left">
                  Trusted by legal teams, freelancers, and businesses
                </p>
                <div className="flex flex-wrap gap-x-8 gap-y-4 justify-center lg:justify-start items-center opacity-65 dark:opacity-50 grayscale hover:opacity-90 transition-opacity">
                  <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-gray-800 dark:text-white"><Scale size={16} /> LexPartners</div>
                  <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-gray-800 dark:text-white"><Shield size={16} /> SecureTrust</div>
                  <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-gray-800 dark:text-white"><Lock size={16} /> Encrypta</div>
                  <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-gray-800 dark:text-white"><CheckCircle2 size={16} /> Compliancy</div>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Interactive AI Demo Widget */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-[450px] lg:max-w-none rounded-2xl border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-950/80 p-1.5 backdrop-blur-md shadow-xl dark:shadow-2xl shadow-blue-100/50 dark:shadow-blue-900/20">
                
                {/* Visual Top Bar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-b-gray-800/80 text-xs text-gray-500 dark:text-gray-405">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  </div>
                  <div className="font-mono text-[10px] bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-transparent px-2 py-0.5 rounded text-primary-700 dark:text-primary-400">AI-CLAUSE-ANALYZER.EXE</div>
                </div>

                {/* Demo Tab Toggles */}
                <div className="grid grid-cols-3 gap-1 p-2 bg-gray-100/80 dark:bg-gray-900/50 rounded-lg m-2 border border-gray-200 dark:border-gray-850">
                  <button 
                    onClick={() => setActiveDemoClause('term')}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${activeDemoClause === 'term' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                  >
                    Termination
                  </button>
                  <button 
                    onClick={() => setActiveDemoClause('indem')}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${activeDemoClause === 'indem' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                  >
                    Indemnity
                  </button>
                  <button 
                    onClick={() => setActiveDemoClause('ip')}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${activeDemoClause === 'ip' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                  >
                    IP Assignment
                  </button>
                </div>

                {/* Document Display Panel */}
                <div className="p-4 space-y-4 text-left">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 dark:text-gray-500">Contract Excerpt</span>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/80 rounded-xl text-xs leading-relaxed font-mono border border-gray-200 dark:border-gray-850 text-gray-700 dark:text-gray-300 max-h-[110px] overflow-y-auto">
                      {DEMO_CLAUSES[activeDemoClause].original}
                    </div>
                  </div>

                  {/* AI Ingestion Arrow */}
                  <div className="flex justify-center -my-1 text-primary-600 dark:text-primary-400">
                    <ArrowRight className="rotate-90 h-5 w-5 animate-bounce" />
                  </div>

                  {/* AI Instant Audit Output Panel */}
                  <div className="space-y-2 bg-gray-50 dark:bg-gray-900/90 rounded-xl p-4 border border-gray-200 dark:border-gray-850">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-primary-600 dark:text-gray-400 flex items-center gap-1.5">
                        <Zap size={12} className="text-primary-600 dark:text-primary-400" /> LegalEase Audit
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DEMO_CLAUSES[activeDemoClause].riskColor}`}>
                        {DEMO_CLAUSES[activeDemoClause].risk}
                      </span>
                    </div>

                    <p className="text-xs text-emerald-700 dark:text-emerald-400/95 leading-relaxed font-semibold">
                      {DEMO_CLAUSES[activeDemoClause].aiAnalysis}
                    </p>

                    <div className="pt-2.5 border-t border-gray-200 dark:border-gray-850">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-500 block mb-1">Recommended Action</span>
                      <p className="text-[11px] text-gray-600 dark:text-gray-450 leading-normal">
                        {DEMO_CLAUSES[activeDemoClause].remediation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Trust Metrics Grid Section (Theme Adaptive) */}
      <section className="py-12 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
        <div className="app-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm hover:scale-105 transition-all">
              <span className="text-3xl font-extrabold text-primary-600 dark:text-primary-400 block">99.4%</span>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">AI Accuracy Rate</span>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm hover:scale-105 transition-all">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 block">&lt; 3 Sec</span>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Audit Response Time</span>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm hover:scale-105 transition-all">
              <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 block">50k+</span>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Contracts Audited</span>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm hover:scale-105 transition-all">
              <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 block">SOC-2</span>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Certified Secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* How Our Doc Intelligence Works (Animated workflow flow section) */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#080d16] text-gray-900 dark:text-white relative overflow-hidden border-y border-gray-200 dark:border-gray-900/60 transition-colors duration-500">
        
        {/* Soft background glow meshes */}
        <div className="absolute inset-0 opacity-20 dark:opacity-30 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-100 dark:bg-blue-900/30 rounded-full filter blur-[100px] animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-80 h-80 bg-purple-100 dark:bg-purple-900/15 rounded-full filter blur-[90px] animate-pulse" style={{ animationDelay: '2.5s' }}></div>
        </div>

        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none"></div>

        <div className="app-container relative z-10">
          <div className="text-center mb-20">
            <motion.h2 
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-gray-900 dark:text-white"
            >
              How Our <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">Doc Intelligence</span> Works
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed"
            >
              A multi-stage agentic workflow designed to turn complex legal text into actionable clarity.
            </motion.p>
          </div>

          <div className="relative">
            {/* SVG Connecting Flow Lines (Desktop Only) */}
            <div className="absolute top-10 left-[8%] right-[8%] h-0.5 pointer-events-none hidden lg:block z-0">
              <svg className="w-full h-4 overflow-visible" fill="none">
                <path 
                  d="M 0 8 Q 150 -12 300 8 T 600 8 T 900 8 T 1200 8" 
                  stroke="url(#flow-gradient)" 
                  strokeWidth="2" 
                  strokeDasharray="6 6"
                  className="opacity-30 dark:opacity-25"
                />
                <defs>
                  <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="20%" stopColor="#f59e0b" />
                    <stop offset="40%" stopColor="#10b981" />
                    <stop offset="60%" stopColor="#3b82f6" />
                    <stop offset="80%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Grid container for cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 relative z-10">
              {WORKFLOW_STEPS.map((step, idx) => {
                const IconComponent = step.icon;
                return (
                  <NavLink 
                    key={idx}
                    to={step.route}
                    className="block group"
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: idx * 0.1, type: "spring", stiffness: 100 }}
                      whileHover={{ y: -8 }}
                      className="relative flex flex-col items-center text-center cursor-pointer p-5 rounded-2xl bg-gray-50/60 dark:bg-slate-900/40 border border-gray-200/50 dark:border-white/5 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-900/60 hover:border-gray-300/80 dark:hover:border-white/10 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] h-full"
                    >
                      
                      {/* Hover Glowing Mesh behind card */}
                      <div 
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-60 dark:group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none -z-10"
                        style={{
                          background: `radial-gradient(circle at center, ${step.glowColor} 0%, transparent 70%)`
                        }}
                      ></div>

                      {/* Stage Icon Frame */}
                      <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6 z-10 transition-all duration-300">
                        {/* Gradient border on active/hover */}
                        <div className={`absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br ${step.gradient}`}>
                          <div className="w-full h-full bg-white dark:bg-[#0d121e] rounded-2xl flex items-center justify-center">
                            <IconComponent className="text-gray-800 dark:text-white w-7 h-7 group-hover:scale-110 transition-transform duration-300" />
                          </div>
                        </div>
                        
                        {/* Inner shadow glow on hover */}
                        <div 
                          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient} opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300 -z-10`}
                        ></div>
                      </div>

                      {/* Step Title */}
                      <h3 className="text-xs sm:text-sm font-extrabold tracking-wider mb-2 text-gray-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-cyan-400 transition-colors duration-300 uppercase">
                        {step.title}
                      </h3>

                      {/* Step Desc */}
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300 leading-relaxed font-medium">
                        {step.desc}
                      </p>
                      
                    </motion.div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main Features Grid with Sleek Cards & Micro-Animations */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
        <div className="app-container">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Advanced Tools Built For Smart Teams
            </h2>
            <div className="h-1.5 w-20 bg-primary-600 mx-auto rounded-full mb-6"></div>
            <p className="text-gray-650 dark:text-gray-450 max-w-2xl mx-auto text-base">
              Say goodbye to manual document parsing and high legal auditing consulting bills. Our suite of AI algorithms reviews your files instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Card 1 */}
            <div className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <FileSearch size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Cognitive Contract Audit</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Extract hidden risks, uncapped liabilities, and non-standard indemnification triggers immediately. Clear plain-language insights in seconds.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Shield size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Enterprise-Grade Security</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Your data is protected by AES-256 bank-level encryption. All operations adhere strictly to GDPR, HIPAA, and custom workspace authorization levels.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <MessageSquare size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Interactive Clause Q&A</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Chat interactively with our specialized legal AI. Ask direct questions, request summaries of subclauses, or craft alternative balance proposals.
              </p>
            </div>

            {/* Card 4 */}
            <div className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Automatic Risk Scoring</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Contracts are parsed and classified with a composite risk index, giving you immediate clarity on which documents require manual legal team reviews.
              </p>
            </div>

            {/* Card 5 */}
            <div className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center mb-6 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                <Globe size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Multi-Language Ingestion</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Upload legal documents drafted in English, Spanish, German, French, or Japanese. Summarize and interact with them in your language of choice.
              </p>
            </div>

            {/* Card 6 */}
            <div className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden text-left">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-6 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                <FileText size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Clause Version Comparison</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Compare client markups against your master agreement templates in a side-by-side diff dashboard, highlighting deviations in legal language.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Security Focus Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-955 text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-800/80">
        <div className="app-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Graphics */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="absolute w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full filter blur-3xl"></div>
              <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 rounded-2xl p-8 max-w-sm relative z-10 backdrop-blur-md text-left">
                <Lock className="text-primary-600 dark:text-primary-400 h-10 w-10 mb-4" />
                <h4 className="text-lg font-bold mb-2">Zero-Trust Audits</h4>
                <p className="text-xs text-gray-550 dark:text-gray-450 leading-relaxed mb-4">
                  We leverage local sandbox extraction pipelines to analyze files. Your contracts never end up saved in generic cloud training corpora.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300 font-semibold">
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" /> End-to-End Encryption (AES-256)
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300 font-semibold">
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" /> Isolated API Sandbox Pipelines
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300 font-semibold">
                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" /> Strict Role-Based Data Access
                  </div>
                </div>
              </div>
            </div>

            {/* Right Text */}
            <div className="lg:col-span-7 text-left">
              <span className="text-xs font-extrabold uppercase tracking-widest text-primary-600 dark:text-primary-400 block mb-3">Enterprise Grade Infrastructure</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">
                Your Privacy Is Our Legal Obligation
              </h2>
              <p className="text-gray-650 dark:text-gray-400 leading-relaxed mb-8">
                Unlike generic LLM platforms that scrape prompts to feed their neural network iterations, LegalEase enforces strict isolation protocols. Each workspace is sandboxed, safeguarding your firm’s litigation briefs and proprietary agreements from leakage.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-primary-650 dark:text-primary-400 mt-1"><Shield size={16} /></div>
                  <div>
                    <h5 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">Full Compliance</h5>
                    <p className="text-xs text-gray-500">Fully compliant with international GDPR and HIPAA regulations.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-primary-650 dark:text-primary-400 mt-1"><Lock size={16} /></div>
                  <div>
                    <h5 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">Multi-Factor Control</h5>
                    <p className="text-xs text-gray-500">Secure user authentication limits file visibility strictly to designated team nodes.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="app-container max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-650 dark:text-gray-450 max-w-xl mx-auto text-sm">
              Everything you need to know about LegalEase's underlying intelligence, billing safeguards, and data protection.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-750 overflow-hidden transition-all duration-300 shadow-sm text-left"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-705 transition-colors"
                >
                  <span className="text-base">{faq.q}</span>
                  <ChevronDown 
                    size={18} 
                    className={`text-gray-400 transition-transform duration-300 ${expandedFaq === index ? 'rotate-180 text-primary-600 dark:text-primary-500' : ''}`} 
                  />
                </button>
                <div 
                  className={`transition-all duration-300 overflow-hidden ${expandedFaq === index ? 'max-h-40 border-t border-gray-100 dark:border-gray-700 py-4 px-6 bg-gray-50/50 dark:bg-gray-850/50' : 'max-h-0 py-0'}`}
                >
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
