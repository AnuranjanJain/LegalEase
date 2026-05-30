import { RefreshCcw, CheckCircle, Clock, Cpu, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function ProcessingPage() {
  return (
    <div className="relative overflow-hidden bg-background-light dark:bg-background-dark min-h-screen text-gray-800 dark:text-gray-200 flex flex-col justify-center items-center">
      {/* Decorative High-Tech Mesh Background Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-600/10 dark:bg-primary-600/5 rounded-full filter blur-[120px] animate-pulse"></div>
        <div
          className="absolute top-10 left-10 w-72 h-72 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[90px] animate-pulse"
          style={{ animationDelay: '1.5s' }}
        ></div>
      </div>

      <div className="app-container relative z-10 py-12 max-w-2xl w-full">
        {/* Main Glowing Processing Panel */}
        <div className="w-full bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl shadow-xl border border-gray-150 dark:border-gray-850 p-8 md:p-10 space-y-8 text-center animate-slide-up">
          {/* Concentric Rotating Scanner Graphic */}
          <div className="relative w-28 h-28 mx-auto flex items-center justify-center mb-6">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-t-primary-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            {/* Middle Ring */}
            <div
              className="absolute inset-2 rounded-full border border-t-transparent border-r-emerald-500 border-b-transparent border-l-transparent animate-spin"
              style={{ animationDuration: '3s', animationDirection: 'reverse' }}
            ></div>
            {/* Inner Glowing Orb */}
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 animate-pulse border border-white/10">
              <Cpu size={28} className="animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Analyzing Document
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
              Our AI sandbox engine is executing a deep cognitive review on your
              agreement. This usually completes in under 3 seconds.
            </p>
          </div>

          {/* Analysis Stages */}
          <div className="space-y-5 text-left pt-4">
            {/* Stage 1: Done */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 dark:bg-emerald-500/5 backdrop-blur-sm transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                <CheckCircle size={16} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Stage 1: Document OCR & Structure Mapping
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-500">
                    Completed
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-full"></div>
                </div>
              </div>
            </div>

            {/* Stage 2: Done */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 dark:bg-emerald-500/5 backdrop-blur-sm transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                <CheckCircle size={16} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Stage 2: Boilerplate Clause Isolation
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-500">
                    Completed
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-full"></div>
                </div>
              </div>
            </div>

            {/* Stage 3: Active */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-primary-600/20 bg-primary-600/5 dark:bg-primary-500/5 shadow-[0_0_15px_rgba(37,99,235,0.02)] backdrop-blur-sm transition-all duration-300">
              <div className="p-1.5 rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-400 flex-shrink-0">
                <RefreshCcw size={16} className="animate-spin" />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold text-gray-950 dark:text-white uppercase tracking-wider">
                    Stage 3: Liability & Risk Metric Assessment
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase text-primary animate-pulse">
                    In Progress
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary-600 to-indigo-650 h-full rounded-full w-3/4 animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Stage 4: Pending */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-150 dark:border-gray-850/60 bg-gray-50/50 dark:bg-gray-950/10 backdrop-blur-sm transition-all duration-300 opacity-60">
              <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-850 text-gray-400 flex-shrink-0">
                <Clock size={16} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stage 4: Summary Compiler & Remediation Outputs
                  </h4>
                  <span className="text-[10px] font-extrabold uppercase text-gray-400">
                    Queueing
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-850 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-transparent h-full rounded-full w-0"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6 border-t border-gray-150 dark:border-gray-850">
            <NavLink
              to="/documents"
              className="px-5 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center"
            >
              Cancel Audit
            </NavLink>
            <NavLink
              to="/dashboard"
              className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>Go to Command Center</span>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
