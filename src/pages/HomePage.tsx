import { useState } from 'react';
import { 
  ArrowRight, FileText, Shield, Zap, Scale, MessageSquare, 
  AlertTriangle, Lock, Globe, FileSearch, CheckCircle2, ChevronDown,
  Briefcase, Rocket, UserCheck , Star
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

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

interface Review {
  name: string;
  role: string;
  review: string;
  rating: number;
}

const REVIEWS: Review[] = [
  {
    name: "Sarah Johnson",
    role: "Startup Founder",
    review:
      "LegalEase helped us identify risky clauses in investor agreements within seconds. It saved our team hours of manual review.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Legal Consultant",
    review:
      "The AI clause analysis is surprisingly accurate. The plain-English explanations make legal documents much easier to understand.",
    rating: 5,
  },
  {
    name: "Emily Davis",
    role: "Freelancer",
    review:
      "I use LegalEase before signing client contracts. The risk alerts have helped me avoid several unfavorable agreements.",
    rating: 4,
  },
];

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

export function HomePage() {
  const [activeDemoClause, setActiveDemoClause] = useState<'term' | 'indem' | 'ip'>('term');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const btnPrimary = "inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-xl text-white bg-primary-600 hover:bg-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all duration-300";
  const btnSecondary = "inline-flex items-center justify-center px-8 py-3.5 border border-gray-300 dark:border-gray-700 text-base font-semibold rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 backdrop-blur-sm transition-all duration-300";
  const btnTab = (isActive: boolean) => 
  `py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
    isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
  }`;

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
                <NavLink to="/documents" className={btnPrimary}>
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 animate-pulse" />
                </NavLink>
                <NavLink to="/chatbot" className={btnSecondary}>
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
                <button 
                onClick={() => setActiveDemoClause('term')}
                className={btnTab(activeDemoClause === 'term')}
                >
                  Termination
                  </button>
                  <button 
                  onClick={() => setActiveDemoClause('indem')}
                  className={btnTab(activeDemoClause === 'indem')}
                  >
                    Indemnity
                    </button>
                    <button 
                    onClick={() => setActiveDemoClause('ip')}
                    className={btnTab(activeDemoClause === 'ip')}
                    >
                      IP Assignment
                      </button>

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

      {/* How It Works Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950 border-b border-gray-150 dark:border-gray-900">
        <div className="app-container">
          <div className="text-center mb-16">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary-600 dark:text-primary-400 block mb-3">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Legal Help In Four Clear Steps
            </h2>
            <div className="h-1.5 w-20 bg-primary-600 mx-auto rounded-full mb-6"></div>
            <p className="text-gray-650 dark:text-gray-450 max-w-2xl mx-auto text-base">
              Choose what you need, share the details, and get practical legal guidance without losing time to confusing paperwork.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="group relative p-7 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-left overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Scale size={22} />
                </div>
                <span className="text-xs font-extrabold tracking-widest text-gray-350 dark:text-gray-600">01</span>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Pick a service</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Select the legal category, document type, or issue that best matches your situation.
              </p>
            </div>

            <div className="group relative p-7 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-left overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <FileText size={22} />
                </div>
                <span className="text-xs font-extrabold tracking-widest text-gray-350 dark:text-gray-600">02</span>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Submit your query</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Upload a document or describe your request so LegalEase can understand the context.
              </p>
            </div>

            <div className="group relative p-7 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-left overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <MessageSquare size={22} />
                </div>
                <span className="text-xs font-extrabold tracking-widest text-gray-350 dark:text-gray-600">03</span>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Get matched</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Connect with relevant resources, AI insights, or legal professionals for your next step.
              </p>
            </div>

            <div className="group relative p-7 rounded-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-left overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={22} />
                </div>
                <span className="text-xs font-extrabold tracking-widest text-gray-350 dark:text-gray-600">04</span>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Track guidance</h3>
              <p className="text-sm leading-relaxed text-gray-650 dark:text-gray-400">
                Review recommendations, monitor request progress, and return whenever you need updates.
              </p>
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

      {/* Who Can Benefit Section (Theme Adaptive White Background) */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950 border-t border-gray-150 dark:border-gray-900">
        <div className="app-container">
          <div className="text-center mb-20">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary-600 dark:text-primary-400 block mb-3">
              Targeted Auditing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Who Can Benefit From LegalEase?
            </h2>
            <div className="h-1.5 w-20 bg-primary-600 mx-auto rounded-full mb-6"></div>
            <p className="text-gray-650 dark:text-gray-450 max-w-2xl mx-auto text-base">
              Our intelligent legal parsing engine provides specialized security, risk analysis, and contract transparency for every legal stakeholder.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Card 1: Law Firms & Legal Teams */}
            <div 
              id="benefit-card-lawyers"
              className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-blue-500/10 dark:border-blue-500/5 shadow-sm hover:shadow-[0_15px_30px_-5px_rgba(59,130,246,0.12)] hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 overflow-hidden text-left"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
                <Scale size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Law Firms & Teams
              </h3>
              <p className="text-sm leading-relaxed text-gray-605 dark:text-gray-400">
                Automate due diligence, rapidly audit compliance across massive portfolios, and flag high-liability clauses in seconds instead of hours.
              </p>
            </div>

            {/* Card 2: In-House Counsel */}
            <div 
              id="benefit-card-inhouse"
              className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-500/10 dark:border-emerald-500/5 shadow-sm hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.12)] hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 overflow-hidden text-left"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                <Briefcase size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                In-House Counsel
              </h3>
              <p className="text-sm leading-relaxed text-gray-655 dark:text-gray-400">
                Standardize contract terms, ensure enterprise-wide compliance, and accelerate internal sales/procurement deal cycles with automated risk scores.
              </p>
            </div>

            {/* Card 3: Startups & SMBs */}
            <div 
              id="benefit-card-startups"
              className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-purple-500/10 dark:border-purple-500/5 shadow-sm hover:shadow-[0_15px_30px_-5px_rgba(168,85,247,0.12)] hover:border-purple-500/40 dark:hover:border-purple-500/40 hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 overflow-hidden text-left"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mb-6 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-300">
                <Rocket size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Startups & SMBs
              </h3>
              <p className="text-sm leading-relaxed text-gray-655 dark:text-gray-400">
                Fast-track investment term sheets, vendor service agreements, and partner contracts without early-stage high legal consultation costs.
              </p>
            </div>

            {/* Card 4: Freelancers & Consultants */}
            <div 
              id="benefit-card-freelancers"
              className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-amber-500/10 dark:border-amber-500/5 shadow-sm hover:shadow-[0_15px_30px_-5px_rgba(245,158,11,0.12)] hover:border-amber-500/40 dark:hover:border-amber-500/40 hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 overflow-hidden text-left"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
                <UserCheck size={22} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Freelancers & Solos
              </h3>
              <p className="text-sm leading-relaxed text-gray-655 dark:text-gray-400">
                Demystify complex client NDAs, protect your intellectual property rights, and clearly audit payment and termination clauses before signing.
              </p>
            </div>

          </div>
        </div>
      </section>

      
      
      {/* Reviews & Feedback Section */}
<section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
  <div className="app-container">
    <div className="text-center mb-16">
      <span className="text-xs font-extrabold uppercase tracking-widest text-primary-600 dark:text-primary-400 block mb-3">
        Reviews & Feedback
      </span>

      <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
        Trusted By Professionals Worldwide
      </h2>

      <div className="h-1.5 w-20 bg-primary-600 mx-auto rounded-full mb-6"></div>

      <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        See how LegalEase is helping businesses, freelancers, and legal
        professionals simplify complex contracts and reduce risk.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {REVIEWS.map((review, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          {/* Rating */}
          <div className="flex gap-1 mb-4">
            {[...Array(review.rating)].map((_, i) => (
              <Star
                key={i}
                size={18}
                className="fill-yellow-400 text-yellow-400"
              />
            ))}
          </div>

          {/* Review Text */}
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            "{review.review}"
          </p>

          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">
              {review.name
                .split(" ")
                .map((word) => word[0])
                .join("")}
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {review.name}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {review.role}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Trust Summary */}
    <div className="mt-16 text-center">
      <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
        <Star className="fill-yellow-400 text-yellow-400" size={20} />
        <span className="font-semibold text-gray-800 dark:text-white">
          Rated 4.9/5 by 1,000+ professionals
        </span>
      </div>
    </div>
  </div>
</section>
{/* Security Focus Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-800/80">
        <div className="app-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Graphics */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="absolute w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full filter blur-3xl"></div>
              <div className="border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/80 rounded-2xl p-8 max-w-sm relative z-10 backdrop-blur-md text-left">
                <Lock className="text-primary-600 dark:text-primary-400 h-10 w-10 mb-4" />
                <h4 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Zero-Trust Audits</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
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
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
                Unlike generic LLM platforms that scrape prompts to feed their neural network iterations, LegalEase enforces strict isolation protocols. Each workspace is sandboxed, safeguarding your firm’s litigation briefs and proprietary agreements from leakage.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-primary-600 dark:text-primary-400 mt-1"><Shield size={16} /></div>
                  <div>
                    <h5 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">Full Compliance</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fully compliant with international GDPR and HIPAA regulations.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg text-primary-600 dark:text-primary-400 mt-1"><Lock size={16} /></div>
                  <div>
                    <h5 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">Multi-Factor Control</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Secure user authentication limits file visibility strictly to designated team nodes.</p>
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
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto text-sm">
              Everything you need to know about LegalEase's underlying intelligence, billing safeguards, and data protection.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 shadow-sm text-left"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                >
                  <span className="text-base">{faq.q}</span>
                  <ChevronDown 
                    size={18} 
                    className={`text-gray-400 transition-transform duration-300 ${expandedFaq === index ? 'rotate-180 text-primary-600 dark:text-primary-500' : ''}`} 
                  />
                </button>
                <div 
                  className={`transition-all duration-300 overflow-hidden ${expandedFaq === index ? 'max-h-40 border-t border-gray-100 dark:border-gray-700 py-4 px-6 bg-gray-50/50 dark:bg-gray-900/40' : 'max-h-0 py-0'}`}
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
