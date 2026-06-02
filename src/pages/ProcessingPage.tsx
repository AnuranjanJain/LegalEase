import React, { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Cpu, Sparkles, UploadCloud, CheckCircle2, ChevronRight, MessageSquare } from 'lucide-react';
import { useDocumentProcessing } from '../contexts/DocumentProcessingContext';
import { ProcessingStepper } from '../components/ProcessingStepper';
import { useToast } from '../contexts/ToastContext';
import { ChatStorageService } from '../services/storage';

export function ProcessingPage() {
  const { activeProcessing, processDocument, clearProcessing } = useDocumentProcessing();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Find the active processing document or the most recent one
  const activeDocs = Object.values(activeProcessing);
  const activeDoc = activeDocs.find(d => d.status !== 'completed' && d.status !== 'failed') || activeDocs[activeDocs.length - 1];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      showToast(`Initiating cognitive audit pipeline for "${file.name}"...`, 'info');
      try {
        await processDocument(file);
        showToast(`Document "${file.name}" successfully analyzed by AI!`, 'success');
      } catch (err: any) {
        showToast(`AI audit failed: ${err?.message || err}`, 'error');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      showToast(`Initiating cognitive audit pipeline for "${file.name}"...`, 'info');
      try {
        await processDocument(file);
        showToast(`Document "${file.name}" successfully analyzed by AI!`, 'success');
      } catch (err: any) {
        showToast(`AI audit failed: ${err?.message || err}`, 'error');
      }
    }
  };

  // Launch AI Chatbot with this document as active context
  const handleOpenInChat = () => {
    if (!activeDoc || !activeDoc.summary) return;

    // Create a new session in ChatStorageService or integrate into active
    try {
      const session = ChatStorageService.createSession(`Discussion: ${activeDoc.name}`);
      ChatStorageService.saveSession({
        id: session.id,
        title: session.title,
        messages: [
          {
            id: 'welcome-msg',
            text: `Hello! I have loaded the document **"${activeDoc.name}"** into my sandbox active context and fully parsed it using the chunked AI summarization pipeline. You can ask me any question about the clauses, covenants, or risks.`,
            sender: 'bot',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date().toISOString()
          }
        ],
        documentContext: {
          name: activeDoc.name,
          text: activeDoc.summary // Use the generated summary brief as chat context
        }
      });
      showToast('Loaded document context into AI Sandbox Chatbot!', 'success');
      navigate('/chatbot');
    } catch (error) {
      console.error(error);
      showToast('Failed to switch chatbot context.', 'error');
    }
  };

  return (
    <div className="relative overflow-hidden bg-background-light dark:bg-background-dark min-h-screen text-gray-800 dark:text-gray-200 flex flex-col justify-center items-center py-12 px-4">
      
      {/* Decorative High-Tech Mesh Background Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-600/10 dark:bg-primary-600/5 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[90px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        
        {activeDoc ? (
          /* ACTIVE PROCESSING VIEW */
          <div className="w-full bg-white/75 dark:bg-gray-950/45 backdrop-blur-md rounded-2xl shadow-xl border border-gray-150 dark:border-gray-850 p-8 md:p-10 space-y-8 animate-slide-up">
            
            {/* Header info */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-wider uppercase mb-2 animate-pulse">
                <Cpu size={12} />
                <span>Cognitive Extraction Active</span>
              </div>
              
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight truncate max-w-md mx-auto" title={activeDoc.name}>
                {activeDoc.status === 'completed' ? 'Analysis Complete' : 'Analyzing Document'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold max-w-xs mx-auto truncate">
                File: {activeDoc.name}
              </p>
            </div>

            {/* Stepper Graphic component */}
            <ProcessingStepper
              status={activeDoc.status}
              progress={activeDoc.progress}
              currentBlock={activeDoc.currentBlock}
              totalBlocks={activeDoc.totalBlocks}
              error={activeDoc.error}
              startedAt={activeDoc.startedAt}
            />

            {/* Completed state summary preview */}
            {activeDoc.status === 'completed' && activeDoc.summary && (
              <div className="space-y-4 pt-4 border-t border-gray-150 dark:border-gray-800/80 animate-slide-up text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Cognitive Brief Preview
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Ready
                  </span>
                </div>
                
                {/* Scrollable brief container */}
                <div className="w-full max-h-48 overflow-y-auto p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 text-xs font-medium leading-relaxed whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                  {activeDoc.summary}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6 border-t border-gray-150 dark:border-gray-805">
              
              {activeDoc.status === 'failed' ? (
                <>
                  <button
                    onClick={() => clearProcessing(activeDoc.id)}
                    className="px-5 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors"
                  >
                    Clear Error
                  </button>
                  <NavLink
                    to="/documents"
                    className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    Return to Vault
                  </NavLink>
                </>
              ) : activeDoc.status === 'completed' ? (
                <>
                  <NavLink
                    to="/documents"
                    className="px-5 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center transition-colors border border-gray-200 dark:border-gray-800 rounded-xl bg-white/40 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Document Vault
                  </NavLink>
                  
                  <button
                    onClick={handleOpenInChat}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare size={14} />
                    <span>Open in AI Chat</span>
                  </button>

                  <NavLink
                    to="/dashboard"
                    className="px-6 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl hover:shadow-lg hover:shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={14} />
                    <span>Command Center</span>
                  </NavLink>
                </>
              ) : (
                /* Still active */
                <button
                  onClick={() => clearProcessing(activeDoc.id)}
                  className="px-5 py-2.5 text-xs font-bold text-red-500 hover:text-red-650 flex items-center justify-center transition-colors hover:bg-red-500/5 rounded-xl"
                >
                  Cancel Ingestion
                </button>
              )}
            </div>

          </div>
        ) : (
          /* EMPTY/WAITING STATE - DIRECT UPLOADER */
          <div className="w-full bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl shadow-xl border border-gray-150 dark:border-gray-850 p-8 md:p-10 text-center animate-slide-up">
            
            <div className="w-16 h-16 bg-primary-600/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Cpu size={32} />
            </div>

            <div className="space-y-2 mb-8">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                AI Processing Vault
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
                Ingest any contract, NDA, or terms of service file here. The multi-step chunking pipeline extracts structural semantics and runs deep audits.
              </p>
            </div>

            {/* Direct File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group cursor-pointer p-8 rounded-xl border-2 border-dashed text-center transition-all duration-300 bg-white/50 dark:bg-gray-900/10 ${
                isDragging
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-[0_0_15px_rgba(37,99,235,0.08)] scale-[1.01]'
                  : 'border-gray-250 dark:border-gray-850 hover:border-primary hover:bg-gray-50/50 dark:hover:bg-gray-900/5'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.txt"
              />
              <UploadCloud size={24} className="mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-gray-850 dark:text-white">
                {isDragging ? 'Drop contract here' : 'Select contract or Drag & Drop'}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Supports PDF, DOCX, TXT up to 10MB</p>
            </div>

            <div className="flex justify-center pt-6 border-t border-gray-150 dark:border-gray-855 mt-8">
              <NavLink
                to="/documents"
                className="px-5 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
              >
                <span>Browse Document Vault</span>
                <ChevronRight size={14} />
              </NavLink>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
