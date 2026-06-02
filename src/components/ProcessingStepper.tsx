import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, AlertTriangle, FileText, LayoutList, BrainCircuit, Terminal, Clock } from 'lucide-react';
import { ProcessingMetricsService } from '../contexts/DocumentProcessingContext';

interface ProcessingStepperProps {
  status: 'idle' | 'reading' | 'chunking' | 'summarizing' | 'rendering' | 'completed' | 'failed';
  progress: number;
  currentBlock: number;
  totalBlocks: number;
  error?: string;
  /** Epoch timestamp (ms) when processing started — enables live elapsed time */
  startedAt?: number;
}

/** Formats a duration in milliseconds into a compact human-readable string. */
function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function ProcessingStepper({
  status,
  progress,
  currentBlock,
  totalBlocks,
  error,
  startedAt
}: ProcessingStepperProps) {

  // ── Live Elapsed Time Counter ──────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!startedAt || status === 'completed' || status === 'failed') return;
    // Immediately set the initial elapsed value
    setElapsedMs(Date.now() - startedAt);
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [startedAt, status]);

  // ── Dynamic ETA from historical processing metrics ─────────────────────
  const estimatedTotalMs = ProcessingMetricsService.getAverageDurationMs();
  const estimatedRemainingMs =
    estimatedTotalMs !== null && progress > 0
      ? Math.max(0, (estimatedTotalMs * (100 - progress)) / 100)
      : null;

  // Define the stages
  const stages = [
    {
      key: 'reading',
      title: 'Reading File',
      description: 'Parsing uploaded file and executing structural layout OCR analysis.',
      icon: FileText
    },
    {
      key: 'chunking',
      title: 'Chunking Document',
      description: 'Isolating boundaries and splitting content into overlapping semantic blocks.',
      icon: LayoutList
    },
    {
      key: 'summarizing',
      title: `AI Summarizing Block ${currentBlock || 0} of ${totalBlocks || 0}`,
      description: 'Running sequential cognitive LLM audits to synthesize core briefs.',
      icon: BrainCircuit
    },
    {
      key: 'rendering',
      title: 'Rendering Final Analysis',
      description: 'Compiling structured audits, risk indexes, and rendering the report.',
      icon: Terminal
    }
  ];

  // Helper to determine the state of each stage
  const getStageState = (_stageKey: string, index: number) => {
    if (status === 'failed') {
      // Find where it failed
      const activeIndex = getActiveStageIndex();
      if (index === activeIndex) return 'failed';
      if (index < activeIndex) return 'completed';
      return 'pending';
    }

    if (status === 'completed') return 'completed';

    const activeIndex = getActiveStageIndex();
    if (index < activeIndex) return 'completed';
    if (index === activeIndex) return 'active';
    return 'pending';
  };

  const getActiveStageIndex = (): number => {
    switch (status) {
      case 'reading': return 0;
      case 'chunking': return 1;
      case 'summarizing': return 2;
      case 'rendering': return 3;
      case 'completed': return 4;
      default: return 0;
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Dynamic Circular Progress Indicator */}
      <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
        {/* Ambient background blur */}
        <div className={`absolute inset-0 rounded-full blur-[20px] transition-all duration-1000 opacity-20 ${
          status === 'failed' ? 'bg-red-500' : status === 'completed' ? 'bg-emerald-500' : 'bg-primary'
        }`}></div>

        {/* Circular Track */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="54"
            className="stroke-gray-100 dark:stroke-gray-800 fill-transparent"
            strokeWidth="6"
          />
          <circle
            cx="64"
            cy="64"
            r="54"
            className={`fill-transparent transition-all duration-550 ease-out ${
              status === 'failed' 
                ? 'stroke-red-500' 
                : status === 'completed' 
                  ? 'stroke-emerald-500' 
                  : 'stroke-primary'
            }`}
            strokeWidth="6"
            strokeDasharray="339.3"
            strokeDashoffset={339.3 - (339.3 * progress) / 100}
            strokeLinecap="round"
          />
        </svg>

        {/* Middle Core Badge */}
        <div className="absolute text-center">
          {status === 'failed' ? (
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto animate-bounce" />
          ) : status === 'completed' ? (
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto animate-pulse" />
          ) : (
            <>
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{progress}%</span>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-500 block font-semibold mt-0.5">
                {status === 'reading' && 'Extracting'}
                {status === 'chunking' && 'Semantic'}
                {status === 'summarizing' && `Block ${currentBlock}/${totalBlocks}`}
                {status === 'rendering' && 'Synthesizing'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Dynamic Timing Info Bar */}
      {status !== 'completed' && status !== 'failed' && startedAt && (
        <div className="flex items-center justify-center gap-4 px-4 py-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-800/60 text-center">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Clock size={12} className="text-primary animate-pulse" />
            <span className="text-[11px] font-semibold">
              Elapsed: <span className="text-gray-800 dark:text-gray-200">{formatDuration(elapsedMs)}</span>
            </span>
          </div>
          {estimatedRemainingMs !== null && estimatedRemainingMs > 0 ? (
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Est. remaining: <span className="text-primary dark:text-primary-400">{formatDuration(estimatedRemainingMs)}</span>
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 italic">
              {estimatedTotalMs !== null ? 'Almost done...' : 'Analyzing your document...'}
            </div>
          )}
        </div>
      )}

      {/* Completed Timing Summary */}
      {status === 'completed' && startedAt && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={12} />
          <span>Completed in {formatDuration(elapsedMs)}</span>
        </div>
      )}

      {/* List of Stages */}
      <div className="space-y-4">
        {stages.map((stage, idx) => {
          const state = getStageState(stage.key, idx);
          const StageIcon = stage.icon;

          return (
            <div
              key={stage.key}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 backdrop-blur-sm ${
                state === 'completed'
                  ? 'border-emerald-500/15 bg-emerald-500/5 dark:bg-emerald-500/5'
                  : state === 'active'
                    ? 'border-primary/20 bg-primary/5 dark:bg-primary/5 shadow-[0_0_15px_rgba(37,99,235,0.02)]'
                    : state === 'failed'
                      ? 'border-red-500/15 bg-red-500/5 dark:bg-red-500/5'
                      : 'border-gray-200 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-950/10 opacity-55'
              }`}
            >
              {/* Left Side Icon Indicator */}
              <div className={`p-2 rounded-lg transition-transform ${
                state === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : state === 'active'
                    ? 'bg-primary/10 text-primary animate-pulse scale-105'
                    : state === 'failed'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-gray-100 dark:bg-gray-850 text-gray-450 dark:text-gray-500'
              }`}>
                {state === 'completed' && <CheckCircle2 className="h-5 w-5" />}
                {state === 'active' && <Loader2 className="h-5 w-5 animate-spin" />}
                {state === 'failed' && <AlertTriangle className="h-5 w-5" />}
                {state === 'pending' && <StageIcon className="h-5 w-5" />}
              </div>

              {/* Text Description */}
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${
                    state === 'active' ? 'text-primary dark:text-primary-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    Stage {idx + 1}: {stage.title}
                  </h4>
                  <span className={`text-[10px] font-extrabold uppercase ${
                    state === 'completed'
                      ? 'text-emerald-500'
                      : state === 'active'
                        ? 'text-primary animate-pulse'
                        : state === 'failed'
                          ? 'text-red-500'
                          : 'text-gray-450 dark:text-gray-500'
                  }`}>
                    {state === 'completed' && 'Completed'}
                    {state === 'active' && 'In Progress'}
                    {state === 'failed' && 'Error'}
                    {state === 'pending' && 'Queueing'}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal truncate-2-lines">
                  {stage.description}
                </p>

                {/* Sub-Progress bar in the active step */}
                {state === 'active' && (
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden mt-3">
                    <div
                      className="bg-gradient-to-r from-primary to-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Failure Error Alert Box */}
      {status === 'failed' && error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-left animate-slide-up flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider mb-1">
              Analysis pipeline terminated
            </h4>
            <p className="text-xs text-red-650 dark:text-red-300/80 leading-normal">
              {error}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
