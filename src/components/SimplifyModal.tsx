import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, AlertTriangle, Sparkles, Loader2, Download } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { FeedbackWidget } from './FeedbackWidget';

interface SimplifyModalProps {
  clauseText: string | null;
  onClose: () => void;
}

export function SimplifyModal({ clauseText, onClose }: SimplifyModalProps) {
  const { showToast } = useToast();
  const [simplifiedText, setSimplifiedText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close animation handler
  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  // Fetch simplified translation
  useEffect(() => {
    if (!clauseText) return;

    const fetchSimplification = async () => {
      setLoading(true);
      setError('');
      setSimplifiedText('');
      
      // Animate in on mount
      requestAnimationFrame(() => setIsVisible(true));

      try {
        const data = await api.post<{ simplifiedText: string }>('/api/simplify', {
          text: clauseText,
        });

        if (!data || !data.simplifiedText) {
          throw new Error('Received an empty response from the simplification service.');
        }

        setSimplifiedText(data.simplifiedText);
      } catch (err) {
        console.error('Failed to simplify clause:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred while communicating with the AI service.');
      } finally {
        setLoading(false);
      }
    };

    fetchSimplification();
  }, [clauseText]);

  // Focus trap and accessibility handlers
  useEffect(() => {
    if (!clauseText) return;

    // Save previous active element to restore focus when modal closes
    const previousActiveElement = document.activeElement as HTMLElement;

    // Focus close button on mount
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }

      // Simple focus trap: Tab and Shift+Tab
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex="0"]'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Block background body scrolling
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [clauseText, handleClose]);

  if (!clauseText) return null;

  const handleCopy = async () => {
    if (!simplifiedText) return;
    try {
      await navigator.clipboard.writeText(simplifiedText);
      setCopied(true);
      showToast('Simplified explanation copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy text. Please copy manually.', 'error');
    }
  };

  const handleExportRedline = async () => {
    if (!clauseText || !simplifiedText) return;
    setIsExporting(true);
    showToast('Generating redlined document...', 'info');
    try {
      const blob = await api.postBlob('/api/export/redline-docx', {
        original_text: clauseText,
        suggested_text: simplifiedText,
      });

      const today = new Date().toISOString().split('T')[0];
      const filename = `redline-clause-${today}.docx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Redlined DOCX exported successfully!', 'success');
    } catch (err) {
      console.error('Failed to export redlined DOCX:', err);
      showToast(err instanceof Error ? err.message : 'Failed to export redlined DOCX.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-250
        ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="simplify-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal content container */}
      <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
          border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]
          transition-all duration-250 ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600/10 text-primary flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 id="simplify-modal-title" className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                AI Jargon Simplification
              </h2>
              <p className="text-[10px] text-gray-550 dark:text-gray-400 mt-0.5">
                Translating legal clauses to plain English
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={handleClose}
            aria-label="Close simplification modal"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-grow text-left space-y-5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-850">
          {/* Original Clause */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-550">
              Original Legal Clause
            </span>
            <div className="p-4 rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-550/5 dark:bg-gray-950/20 font-mono text-[11px] text-gray-650 dark:text-gray-405 leading-relaxed max-h-40 overflow-y-auto">
              {clauseText}
            </div>
          </div>

          {/* Simplified Explanation */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                Plain English Explanation
              </span>
              {loading && (
                <span className="text-[10px] text-gray-450 flex items-center gap-1.5 font-medium animate-pulse">
                  <Loader2 size={12} className="animate-spin text-primary" />
                  Generating summary...
                </span>
              )}
            </div>

            <div className="min-h-36 flex flex-col justify-center p-5 rounded-xl border border-primary-600/15 dark:border-gray-800 bg-primary-600/5 dark:bg-gray-950/30">
              {loading ? (
                <div className="space-y-3 animate-pulse py-2" aria-label="Loading simplified text">
                  <div className="h-3 bg-primary-600/20 dark:bg-gray-800 rounded w-full"></div>
                  <div className="h-3 bg-primary-600/20 dark:bg-gray-800 rounded w-5/6"></div>
                  <div className="h-3 bg-primary-600/20 dark:bg-gray-800 rounded w-4/5"></div>
                  <div className="h-3 bg-primary-600/20 dark:bg-gray-800 rounded w-2/3"></div>
                </div>
              ) : error ? (
                <div className="flex items-start gap-3 text-red-650 dark:text-red-400 py-1" role="alert">
                  <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold">Simplification Failed</h4>
                    <p className="text-[11px] leading-relaxed mt-1">{error}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-4">
                  <div className="text-xs text-gray-800 dark:text-gray-250 leading-relaxed whitespace-pre-wrap select-text">
                    {simplifiedText}
                  </div>
                  <FeedbackWidget responseType="simplify" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-[9px] text-gray-400 dark:text-gray-550 flex items-center gap-1">
            <Sparkles size={10} />
            AI-generated explanation preserves the core legal obligations.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={loading || !!error || !simplifiedText}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                ${copied
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-gray-900 border-gray-250 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed'
                }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Explanation'}</span>
            </button>
            <button
              onClick={handleExportRedline}
              disabled={loading || !!error || !simplifiedText || isExporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border bg-white dark:bg-gray-900 border-gray-250 dark:border-gray-800 text-gray-750 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin text-primary" /> : <Download size={14} />}
              <span>Export Redline</span>
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-850 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
