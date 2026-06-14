import { useState, useEffect, useRef } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { 
  RefreshCcw, CheckCircle, Clock, Cpu, Sparkles, 
  AlertTriangle, FileText, BookOpen, ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { StorageService } from '../services/storage';
import { useToast } from '../contexts/ToastContext';
import { useRedactedText } from '../hooks/useRedactedText';
import { useRedaction } from '../contexts/RedactionContext';
import { RedactedText } from '../components/RedactedText';
import { ReadabilityScore } from '../components/ReadabilityScore';

// Word-based sliding window chunking algorithm
function chunkText(text: string, windowSize: number = 2000, overlap: number = 200): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= windowSize) {
    return [text];
  }
  const chunks: string[] = [];
  const step = windowSize - overlap;
  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + windowSize);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
    if (i + windowSize >= words.length) {
      break;
    }
  }
  return chunks;
}

type StageStatus = 'pending' | 'processing' | 'completed' | 'failed';

export function ProcessingPage() {
  const location = useLocation();
  const { showToast } = useToast();
  const hasStarted = useRef(false);

  // Retrieve state passed from DocumentsPage
  const { docId, file } = (location.state as { docId?: string; file?: File }) || {};

  // Pipeline execution states
  const [stage1Status, setStage1Status] = useState<StageStatus>('pending');
  const [stage2Status, setStage2Status] = useState<StageStatus>('pending');
  const [stage3Status, setStage3Status] = useState<StageStatus>('pending');
  const [stage4Status, setStage4Status] = useState<StageStatus>('pending');

  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [finalSummary, setFinalSummary] = useState('');
  const [originalText, setOriginalText] = useState('');

  // Apply PII redaction to the live preview (original summary kept in state)
  const redactedSummary = useRedactedText(finalSummary);
  const { isRedactionEnabled } = useRedaction();

  // Run the document processing pipeline
  useEffect(() => {
    if (!docId || !file || hasStarted.current) return;
    hasStarted.current = true;

    const executePipeline = async () => {
      let extractedText = '';
      let chunks: string[] = [];
      const summaries: string[] = [];

      // --- STAGE 1: Reading & Parsing File ---
      setStage1Status('processing');
      try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadData = await api.upload<{ filename: string; text: string }>('/upload', formData);
        extractedText = uploadData.text;
        setOriginalText(extractedText);
        setStage1Status('completed');
      } catch (err) {
        setStage1Status('failed');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to upload and parse file.');
        StorageService.updateDocumentStatus(docId, 'failed');
        showToast('Document parsing failed.', 'error');
        return;
      }

      // --- STAGE 2: Chunking Document ---
      setStage2Status('processing');
      try {
        // Chunking text into blocks of 2000 words with 200-word overlap
        chunks = chunkText(extractedText, 2000, 200);
        setTotalChunks(chunks.length);
        setStage2Status('completed');
      } catch (err) {
        setStage2Status('failed');
        setErrorMessage('Failed to segment document into semantic chunks.');
        StorageService.updateDocumentStatus(docId, 'failed');
        showToast('Document chunking failed.', 'error');
        return;
      }

      // --- STAGE 3: AI Summarizing Block X of Y ---
      setStage3Status('processing');
      try {
        for (let i = 0; i < chunks.length; i++) {
          setCurrentChunkIndex(i + 1);
          const response = await api.post<{ summary: string }>('/summarize', { text: chunks[i] });
          summaries.push(response.summary);
        }
        setStage3Status('completed');
      } catch (err) {
        setStage3Status('failed');
        setErrorMessage(err instanceof Error ? err.message : 'Error encountered during AI block summarization.');
        StorageService.updateDocumentStatus(docId, 'failed');
        showToast('AI summarization failed.', 'error');
        return;
      }

      // --- STAGE 4: Rendering Final Analysis ---
      setStage4Status('processing');
      try {
        let compiledBrief = '';

        if (summaries.length === 1) {
          compiledBrief = summaries[0];
        } else {
          // Combine all summaries with formatting
          const combinedSummariesText = summaries
            .map((s, index) => `### Section ${index + 1} Brief\n${s}`)
            .join('\n\n');

          // If combined text is short enough, compile an overall unified brief
          if (combinedSummariesText.length <= 15000) {
            try {
              const response = await api.post<{ summary: string }>('/summarize', { 
                text: `Below are brief summaries of different parts of a legal document. Combine them into one unified, cohesive, and logically structured final legal brief overview, highlighting key liabilities, dates, and terms:\n\n${combinedSummariesText}` 
              });
              compiledBrief = `## Unified Executive Brief\n\n${response.summary}\n\n---\n\n## Detailed Section Breakdowns\n\n${combinedSummariesText}`;
            } catch (briefErr) {
              console.warn('Failed to compile overall executive brief, falling back to concatenated summaries:', briefErr);
              compiledBrief = `## Section summaries\n\n${combinedSummariesText}`;
            }
          } else {
            compiledBrief = `## Detailed Section Breakdowns\n\n${combinedSummariesText}`;
          }
        }

        setFinalSummary(compiledBrief);

        // Fetch clause-level risk assessment
        let analyzedClauses: any[] = [];
        try {
          const response = await api.post<{ clauses: any[] }>('/legal/analyze-clauses', { text: extractedText });
          analyzedClauses = response.clauses;
        } catch (clauseErr) {
          console.warn('Failed to analyze clauses, falling back to empty clauses array:', clauseErr);
        }

        setStage4Status('completed');

        // Save complete results back to StorageService
        StorageService.updateDocumentStatus(docId, 'processed', compiledBrief, extractedText, analyzedClauses);
        showToast(`"${file.name}" analyzed successfully!`, 'success');
      } catch (err) {
        setStage4Status('failed');
        setErrorMessage('Failed to compile and render final analysis report.');
        StorageService.updateDocumentStatus(docId, 'failed');
        showToast('Brief compilation failed.', 'error');
      }
    };

    executePipeline();
  }, [docId, file, showToast]);

  // Overall pipeline progress percentage calculation
  const getOverallProgress = () => {
    let progress = 0;
    if (stage1Status === 'completed') progress += 25;
    if (stage1Status === 'processing') progress += 12;

    if (stage2Status === 'completed') progress += 25;
    if (stage2Status === 'processing') progress += 12;

    if (stage3Status === 'completed') progress += 25;
    if (stage3Status === 'processing') {
      progress += Math.floor((currentChunkIndex / (totalChunks || 1)) * 25);
    }

    if (stage4Status === 'completed') progress += 25;
    if (stage4Status === 'processing') progress += 12;

    return progress;
  };

  const overallProgress = getOverallProgress();
  const isPipelineFailed = 
    stage1Status === 'failed' || 
    stage2Status === 'failed' || 
    stage3Status === 'failed' || 
    stage4Status === 'failed';
  const isPipelineCompleted = stage4Status === 'completed';

  return (
    <div className="relative overflow-hidden bg-background-light dark:bg-background-dark min-h-screen text-gray-800 dark:text-gray-200 flex flex-col justify-center items-center py-10">
      
      {/* Decorative High-Tech Mesh Background Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-600/10 dark:bg-primary-600/5 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[90px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="app-container relative z-10 py-6 max-w-3xl w-full px-4">
        
        {/* Main Glowing Processing Panel */}
        <div className="w-full bg-white/75 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl shadow-xl border border-gray-150 dark:border-gray-850 p-6 md:p-10 space-y-8 animate-slide-up">
          
          {/* Active File Metadata Header */}
          {file ? (
            <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-gray-150 dark:border-gray-850 text-left">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary-600/10 text-primary-600 dark:text-primary-400">
                  <FileText size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-md">{file.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-450 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB · {file.name.split('.').pop()?.toUpperCase()} format
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                isPipelineFailed ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                isPipelineCompleted ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                'bg-primary-600/10 text-primary-600 border border-primary-600/20 animate-pulse'
              }`}>
                {isPipelineFailed ? 'Audit Failed' : isPipelineCompleted ? 'Audit Complete' : 'Analyzing'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <AlertTriangle className="text-amber-500" size={48} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Active Analysis Session</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm text-center">
                Please upload a document inside the Vault to start the preprocessing pipeline.
              </p>
              <NavLink 
                to="/documents" 
                className="px-5 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl shadow-lg shadow-primary-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Go to Document Vault
              </NavLink>
            </div>
          )}

          {file && (
            <>
              {/* Concentric Rotating Scanner Graphic */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                {/* Outer Ring */}
                <div className={`absolute inset-0 rounded-full border-2 border-t-primary-600 border-r-transparent border-b-transparent border-l-transparent ${isPipelineCompleted || isPipelineFailed ? '' : 'animate-spin'}`}></div>
                {/* Middle Ring */}
                <div className={`absolute inset-2 rounded-full border border-t-transparent border-r-emerald-500 border-b-transparent border-l-transparent ${isPipelineCompleted || isPipelineFailed ? '' : 'animate-spin'}`} style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                {/* Inner Glowing Orb */}
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 ${
                  isPipelineFailed 
                    ? 'bg-gradient-to-tr from-red-650 to-rose-600 text-white shadow-red-500/20' 
                    : isPipelineCompleted
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/20'
                    : 'bg-gradient-to-tr from-primary-600 to-indigo-650 text-white shadow-primary-500/30 animate-pulse'
                }`}>
                  {isPipelineFailed ? (
                    <AlertTriangle size={28} />
                  ) : (
                    <Cpu size={28} className={isPipelineCompleted ? '' : 'animate-pulse'} />
                  )}
                </div>
              </div>

              {/* Progress and status */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span>Pipeline Progress</span>
                  <span>{overallProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isPipelineFailed ? 'bg-red-500' : 'bg-gradient-to-r from-primary-600 to-emerald-500'
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  ></div>
                </div>
              </div>

              {/* Dynamic Step-by-Step Stepper */}
              <div className="space-y-4 text-left">
                
                {/* STAGE 1: Reading File */}
                <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  stage1Status === 'completed' ? 'border-emerald-500/15 bg-emerald-550/5 dark:bg-emerald-500/5' :
                  stage1Status === 'processing' ? 'border-primary-600/20 bg-primary-600/5 dark:bg-primary-500/5' :
                  stage1Status === 'failed' ? 'border-red-500/15 bg-red-500/5' :
                  'border-gray-150 dark:border-gray-850/65 bg-transparent opacity-65'
                }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                    stage1Status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    stage1Status === 'processing' ? 'bg-primary-600/10 text-primary-600 dark:text-primary-400' :
                    stage1Status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-gray-100 dark:bg-gray-850 text-gray-400'
                  }`}>
                    {stage1Status === 'completed' ? <CheckCircle size={16} /> :
                     stage1Status === 'processing' ? <RefreshCcw size={16} className="animate-spin" /> :
                     stage1Status === 'failed' ? <AlertTriangle size={16} /> :
                     <Clock size={16} />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Stage 1: Reading & Parsing Document
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase ${
                        stage1Status === 'completed' ? 'text-emerald-500' :
                        stage1Status === 'processing' ? 'text-primary' :
                        stage1Status === 'failed' ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {stage1Status === 'completed' ? 'Completed' :
                         stage1Status === 'processing' ? 'In Progress' :
                         stage1Status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-450 leading-relaxed">
                      {stage1Status === 'completed' ? 'Text successfully parsed and structural syntax preserved.' :
                       stage1Status === 'processing' ? 'Extracting structural text using backend parser...' :
                       stage1Status === 'failed' ? 'Error: Failed to parse structural layout of document.' :
                       'Extract structure, headings, and paragraph margins.'}
                    </p>
                  </div>
                </div>

                {/* STAGE 2: Chunking Document */}
                <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  stage2Status === 'completed' ? 'border-emerald-500/15 bg-emerald-550/5 dark:bg-emerald-500/5' :
                  stage2Status === 'processing' ? 'border-primary-600/20 bg-primary-600/5 dark:bg-primary-500/5' :
                  stage2Status === 'failed' ? 'border-red-500/15 bg-red-500/5' :
                  'border-gray-150 dark:border-gray-850/65 bg-transparent opacity-65'
                }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                    stage2Status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    stage2Status === 'processing' ? 'bg-primary-600/10 text-primary-600 dark:text-primary-400' :
                    stage2Status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-gray-100 dark:bg-gray-850 text-gray-400'
                  }`}>
                    {stage2Status === 'completed' ? <CheckCircle size={16} /> :
                     stage2Status === 'processing' ? <RefreshCcw size={16} className="animate-spin" /> :
                     stage2Status === 'failed' ? <AlertTriangle size={16} /> :
                     <Clock size={16} />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Stage 2: Sliding-Window Text Chunking
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase ${
                        stage2Status === 'completed' ? 'text-emerald-500' :
                        stage2Status === 'processing' ? 'text-primary' :
                        stage2Status === 'failed' ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {stage2Status === 'completed' ? 'Completed' :
                         stage2Status === 'processing' ? 'In Progress' :
                         stage2Status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-450 leading-relaxed">
                      {stage2Status === 'completed' ? `Generated ${totalChunks} semantic segments (2000 words, 200 overlapping words).` :
                       stage2Status === 'processing' ? 'Applying sliding-window segmentation algorithm...' :
                       stage2Status === 'failed' ? 'Error: Failed to chunk text context.' :
                       'Segment document into overlapping blocks to protect context borders.'}
                    </p>
                  </div>
                </div>

                {/* STAGE 3: AI Summarizing Block X of Y */}
                <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  stage3Status === 'completed' ? 'border-emerald-500/15 bg-emerald-550/5 dark:bg-emerald-500/5' :
                  stage3Status === 'processing' ? 'border-primary-600/20 bg-primary-600/5 dark:bg-primary-500/5' :
                  stage3Status === 'failed' ? 'border-red-500/15 bg-red-500/5' :
                  'border-gray-150 dark:border-gray-850/65 bg-transparent opacity-65'
                }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                    stage3Status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    stage3Status === 'processing' ? 'bg-primary-600/10 text-primary-600 dark:text-primary-400' :
                    stage3Status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-gray-100 dark:bg-gray-850 text-gray-400'
                  }`}>
                    {stage3Status === 'completed' ? <CheckCircle size={16} /> :
                     stage3Status === 'processing' ? <RefreshCcw size={16} className="animate-spin" /> :
                     stage3Status === 'failed' ? <AlertTriangle size={16} /> :
                     <Clock size={16} />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Stage 3: AI Summarizing Block {stage3Status === 'processing' ? `${currentChunkIndex} of ${totalChunks}` : totalChunks > 0 ? `${totalChunks} of ${totalChunks}` : 'X of Y'}
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase ${
                        stage3Status === 'completed' ? 'text-emerald-500' :
                        stage3Status === 'processing' ? 'text-primary' :
                        stage3Status === 'failed' ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {stage3Status === 'completed' ? 'Completed' :
                         stage3Status === 'processing' ? 'Summarizing' :
                         stage3Status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-450 leading-relaxed">
                      {stage3Status === 'completed' ? `Successfully analyzed and summarized all ${totalChunks} document blocks.` :
                       stage3Status === 'processing' ? `Invoking LLM summarization pipeline for block ${currentChunkIndex} of ${totalChunks}...` :
                       stage3Status === 'failed' ? 'Error: Upstream AI summarize model timed out.' :
                       'Analyze blocks sequentially with context-retention headers.'}
                    </p>
                    
                    {stage3Status === 'processing' && totalChunks > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1 overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${(currentChunkIndex / totalChunks) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STAGE 4: Rendering Final Analysis */}
                <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  stage4Status === 'completed' ? 'border-emerald-500/15 bg-emerald-550/5 dark:bg-emerald-500/5' :
                  stage4Status === 'processing' ? 'border-primary-600/20 bg-primary-600/5 dark:bg-primary-500/5' :
                  stage4Status === 'failed' ? 'border-red-500/15 bg-red-500/5' :
                  'border-gray-150 dark:border-gray-850/65 bg-transparent opacity-65'
                }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                    stage4Status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    stage4Status === 'processing' ? 'bg-primary-600/10 text-primary-600 dark:text-primary-400' :
                    stage4Status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-gray-100 dark:bg-gray-850 text-gray-400'
                  }`}>
                    {stage4Status === 'completed' ? <CheckCircle size={16} /> :
                     stage4Status === 'processing' ? <RefreshCcw size={16} className="animate-spin" /> :
                     stage4Status === 'failed' ? <AlertTriangle size={16} /> :
                     <Clock size={16} />}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Stage 4: Rendering Final Analysis & Remediation
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase ${
                        stage4Status === 'completed' ? 'text-emerald-500' :
                        stage4Status === 'processing' ? 'text-primary' :
                        stage4Status === 'failed' ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {stage4Status === 'completed' ? 'Completed' :
                         stage4Status === 'processing' ? 'In Progress' :
                         stage4Status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-450 leading-relaxed">
                      {stage4Status === 'completed' ? 'Cohesive brief compiled successfully! Ready for cognitive audit.' :
                       stage4Status === 'processing' ? 'Compiling block summaries into structural brief...' :
                       stage4Status === 'failed' ? 'Error: Failed to compile cohesive brief.' :
                       'Generate unified report combining key findings and liability indexes.'}
                    </p>
                  </div>
                </div>

              </div>

              {/* Error Alert Display */}
              {isPipelineFailed && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 rounded-xl text-left text-xs leading-relaxed animate-pulse">
                  <AlertTriangle className="flex-shrink-0" size={18} />
                  <div>
                    <span className="font-bold block">Pipeline Failure:</span>
                    <span>{errorMessage || 'An error occurred during text chunking or API models interaction. Please try again.'}</span>
                  </div>
                </div>
              )}
              {/* Live Preview Panel (Only displayed when successfully finished) */}
              {isPipelineCompleted && finalSummary && (
                <>
                  <div className="bg-gray-50/50 dark:bg-gray-950/20 rounded-xl border border-gray-150 dark:border-gray-850 p-5 text-left space-y-3 animate-slide-up">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-850 pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-1.5">
                        <BookOpen size={14} />
                        Previewing Compiled AI Summary
                      </span>
                      <div className="flex items-center gap-2">
                        {isRedactionEnabled && (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                            <ShieldCheck size={11} />
                            PII Redacted
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-medium">Rendered instantly</span>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto text-xs text-gray-700 dark:text-gray-300 leading-relaxed space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-850">
                      <div className="whitespace-pre-line prose prose-sm dark:prose-invert">
                        <RedactedText text={redactedSummary} />
                      </div>
                    </div>
                  </div>
                  <ReadabilityScore originalText={originalText} summaryText={finalSummary} />
                </>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6 border-t border-gray-150 dark:border-gray-850">
                {isPipelineFailed ? (
                  <button
                    onClick={() => {
                      hasStarted.current = false;
                      setStage1Status('pending');
                      setStage2Status('pending');
                      setStage3Status('pending');
                      setStage4Status('pending');
                      setErrorMessage('');
                    }}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCcw size={14} />
                    <span>Retry Pipeline</span>
                  </button>
                ) : (
                  <NavLink 
                    to="/documents" 
                    className="px-5 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center"
                  >
                    {isPipelineCompleted ? 'Back to Vault' : 'Cancel Audit'}
                  </NavLink>
                )}
                <NavLink 
                  to="/dashboard" 
                  className={`px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                    isPipelineCompleted 
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:scale-[1.02] shadow-emerald-500/10'
                      : 'bg-primary-600 hover:bg-primary-500 shadow-primary-500/20'
                  }`}
                >
                  <Sparkles size={14} />
                  <span>{isPipelineCompleted ? 'Go to Command Center' : 'Wait in Command Center'}</span>
                </NavLink>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
