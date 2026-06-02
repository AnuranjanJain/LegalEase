import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '../services/api';
import { StorageService, Document } from '../services/storage';

// ── Processing Metrics Service ─────────────────────────────────────────────
// Persists historical processing durations to localStorage so the UI can
// compute dynamic time estimates instead of relying on hardcoded claims.
const METRICS_STORAGE_KEY = 'le_processing_metrics';
const MAX_HISTORY_ENTRIES = 50;

export interface ProcessingMetricEntry {
  durationMs: number;
  fileSizeBytes: number;
  totalBlocks: number;
  timestamp: string;
}

export const ProcessingMetricsService = {
  getHistory: (): ProcessingMetricEntry[] => {
    try {
      const raw = localStorage.getItem(METRICS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  record: (entry: ProcessingMetricEntry) => {
    try {
      const history = ProcessingMetricsService.getHistory();
      history.unshift(entry);
      // Keep only the most recent entries
      localStorage.setItem(
        METRICS_STORAGE_KEY,
        JSON.stringify(history.slice(0, MAX_HISTORY_ENTRIES))
      );
    } catch (err) {
      console.error('Failed to persist processing metric:', err);
    }
  },

  /** Returns the average processing duration in milliseconds, or null if no data. */
  getAverageDurationMs: (): number | null => {
    const history = ProcessingMetricsService.getHistory();
    if (history.length === 0) return null;
    const total = history.reduce((sum, e) => sum + e.durationMs, 0);
    return total / history.length;
  },
};

export interface ProcessingState {
  id: string;
  name: string;
  status: 'idle' | 'reading' | 'chunking' | 'summarizing' | 'rendering' | 'completed' | 'failed';
  progress: number;
  currentBlock: number;
  totalBlocks: number;
  error?: string;
  summary?: string;
  /** Epoch timestamp (ms) when processing started — used for elapsed time display */
  startedAt: number;
  /** File size in bytes — used for size-aware time estimation */
  fileSizeBytes: number;
}

interface DocumentProcessingContextType {
  activeProcessing: Record<string, ProcessingState>;
  processDocument: (file: File) => Promise<string>;
  clearProcessing: (docId: string) => void;
}

const DocumentProcessingContext = createContext<DocumentProcessingContextType | undefined>(undefined);

export function chunkText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  if (!text || text.trim() === '') return [];
  
  // Split by whitespace to extract words
  const words = text.trim().split(/\s+/);
  if (words.length <= chunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let i = 0;
  
  // Safety bounds
  const size = chunkSize <= 0 ? 2000 : chunkSize;
  const lap = overlap < 0 ? 0 : (overlap >= size ? size - 1 : overlap);
  
  while (i < words.length) {
    const chunkWords = words.slice(i, i + size);
    chunks.push(chunkWords.join(' '));
    
    // If the slice completely consumed the remaining text, stop slicing
    if (i + chunkWords.length >= words.length) {
      break;
    }
    
    // Advance sliding window
    i += (size - lap);
    
    // Safety exit to prevent infinite loops
    if (i >= words.length || chunkWords.length < size) {
      break;
    }
  }
  
  return chunks;
}

export function DocumentProcessingProvider({ children }: { children: ReactNode }) {
  const [activeProcessing, setActiveProcessing] = useState<Record<string, ProcessingState>>({});

  const clearProcessing = useCallback((docId: string) => {
    setActiveProcessing((prev) => {
      const copy = { ...prev };
      delete copy[docId];
      return copy;
    });
  }, []);

  const processDocument = useCallback(async (file: File): Promise<string> => {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'txt';
    
    // 1. Create document in StorageService
    const newDoc: Document = {
      id: docId,
      name: file.name,
      type: fileExtension,
      size: file.size,
      uploadDate: new Date().toISOString(),
      status: 'processing'
    };
    StorageService.saveDocument(newDoc);

    // 2. Initialize active processing state
    const initialState: ProcessingState = {
      id: docId,
      name: file.name,
      status: 'reading',
      progress: 10,
      currentBlock: 0,
      totalBlocks: 0,
      startedAt: Date.now(),
      fileSizeBytes: file.size,
    };
    
    setActiveProcessing((prev) => ({ ...prev, [docId]: initialState }));

    try {
      // Step 1: Reading File (Upload & Extraction)
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadData = await api.upload<{ filename: string; text: string }>('/upload', formData);
      
      if (!uploadData.text || uploadData.text.trim() === '') {
        throw new Error('No text content could be extracted from this document.');
      }

      // Save intermediate state
      StorageService.updateDocument(docId, { extractedText: uploadData.text });
      
      // Step 2: Chunking Document
      setActiveProcessing((prev) => {
        const current = prev[docId];
        if (!current) return prev;
        return {
          ...prev,
          [docId]: {
            ...current,
            status: 'chunking',
            progress: 30
          }
        };
      });

      // Split words: 2000 words chunk with 200 words overlap
      const chunks = chunkText(uploadData.text, 2000, 200);
      const totalBlocks = chunks.length;
      
      setActiveProcessing((prev) => {
        const current = prev[docId];
        if (!current) return prev;
        return {
          ...prev,
          [docId]: {
            ...current,
            status: 'summarizing',
            progress: 40,
            totalBlocks,
            currentBlock: 1
          }
        };
      });

      // Step 3: Sequential AI Summarization of Blocks
      const summaries: string[] = [];
      
      for (let idx = 0; idx < chunks.length; idx++) {
        // Update live progress
        setActiveProcessing((prev) => {
          const current = prev[docId];
          if (!current) return prev;
          const chunkProgress = 40 + Math.floor((idx / totalBlocks) * 45);
          return {
            ...prev,
            [docId]: {
              ...current,
              status: 'summarizing',
              currentBlock: idx + 1,
              progress: chunkProgress
            }
          };
        });

        // Call AI summaries endpoint
        const summaryResponse = await api.post<{ summary: string }>('/summarize', { text: chunks[idx] });
        summaries.push(summaryResponse.summary);
      }

      // Step 4: Rendering Final Analysis
      setActiveProcessing((prev) => {
        const current = prev[docId];
        if (!current) return prev;
        return {
          ...prev,
          [docId]: {
            ...current,
            status: 'rendering',
            progress: 90
          }
        };
      });

      // Synthesize compiled summary document
      let finalSummary = '';
      if (summaries.length === 1) {
        finalSummary = summaries[0];
      } else {
        finalSummary = `# Executive Summary & AI Audit Report\n\n` +
          `*This document was analyzed in **${summaries.length} semantic blocks** to preserve structural syntax and ensure high edge-context fidelity without LLM API context window timeouts.*\n\n` +
          `## Executive Overview\n` +
          `Below is the synthesized core brief derived from standard clause isolated metrics, high-liability terms, and legal covenant audits.\n\n` +
          `## Section-by-Section Key Analysis\n\n` +
          summaries.map((s, idx) => `### Block ${idx + 1} Analysis\n${s}`).join('\n\n');
      }

      // 3. Mark processed in StorageService
      StorageService.updateDocument(docId, {
        status: 'processed',
        summary: finalSummary
      });

      // 4. Set completed state & record processing duration metric
      setActiveProcessing((prev) => {
        const current = prev[docId];
        if (!current) return prev;

        // Persist timing metric for future dynamic estimates
        ProcessingMetricsService.record({
          durationMs: Date.now() - current.startedAt,
          fileSizeBytes: current.fileSizeBytes,
          totalBlocks,
          timestamp: new Date().toISOString(),
        });

        return {
          ...prev,
          [docId]: {
            ...current,
            status: 'completed',
            progress: 100,
            summary: finalSummary
          }
        };
      });

      return finalSummary;

    } catch (error: any) {
      console.error('Document processing pipeline failure:', error);
      const errorMessage = error?.message || 'An unexpected error occurred during document parsing.';
      
      setActiveProcessing((prev) => {
        const current = prev[docId];
        if (!current) return prev;
        return {
          ...prev,
          [docId]: {
            ...current,
            status: 'failed',
            progress: 100,
            error: errorMessage
          }
        };
      });

      StorageService.updateDocument(docId, {
        status: 'processed', // set status to ready, so it's not stuck forever
        summary: `### Audit Analysis Pipeline Failure\n\nAn error occurred while compiling the cognitive brief:\n\n> **Error**: ${errorMessage}\n\nplease try uploading the document again or verify service logs.`
      });

      throw error;
    }
  }, []);

  return (
    <DocumentProcessingContext.Provider value={{ activeProcessing, processDocument, clearProcessing }}>
      {children}
    </DocumentProcessingContext.Provider>
  );
}

export function useDocumentProcessing() {
  const ctx = useContext(DocumentProcessingContext);
  if (!ctx) throw new Error('useDocumentProcessing must be used within DocumentProcessingProvider');
  return ctx;
}
