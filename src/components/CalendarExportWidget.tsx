import { useState } from 'react';
import { CalendarPlus, Download, RefreshCcw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { LegalDeadline, generateICS } from '../utils/icsGenerator';

interface CalendarExportWidgetProps {
  documentText: string;
}

export function CalendarExportWidget({ documentText }: CalendarExportWidgetProps) {
  const { showToast } = useToast();
  const [deadlines, setDeadlines] = useState<LegalDeadline[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!documentText) {
      showToast("No document text available to extract from.", "error");
      return;
    }

    setIsExtracting(true);
    setError(null);
    showToast("Extracting legal deadlines... This may take a moment.", "info");

    try {
      const response = await api.post<{ deadlines: LegalDeadline[] }>('/legal/extract-deadlines', { text: documentText });
      
      if (response.deadlines && response.deadlines.length > 0) {
        setDeadlines(response.deadlines);
        showToast(`Successfully extracted ${response.deadlines.length} deadlines!`, "success");
      } else {
        setDeadlines([]);
        showToast("No significant deadlines or dates found in the document.", "info");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      const msg = err instanceof Error ? err.message : "Failed to extract deadlines.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadICS = () => {
    if (!deadlines || deadlines.length === 0) return;

    try {
      const icsString = generateICS(deadlines);
      const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'legal-deadlines.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast("Calendar file downloaded successfully!", "success");
    } catch (err) {
      console.error("Export error:", err);
      showToast("Failed to generate calendar file.", "error");
    }
  };

  return (
    <div className="bg-white/75 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-150 dark:border-gray-850 p-5 mt-6 animate-slide-up">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarPlus size={18} className="text-primary-600" />
            Calendar & Deadline Export
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-450 mt-1 max-w-lg leading-relaxed">
            Automatically extract key court filings, contractual renewals, and milestones, and add them directly to your preferred calendar app.
          </p>
        </div>
        
        <div className="flex-shrink-0">
          {!deadlines && !error && (
            <button
              onClick={handleExtract}
              disabled={isExtracting}
              className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-lg shadow-md shadow-primary-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtracting ? <RefreshCcw size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
              <span>{isExtracting ? "Extracting..." : "Find Deadlines"}</span>
            </button>
          )}
          
          {error && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-red-500 font-medium">Extraction failed</span>
              <button
                onClick={handleExtract}
                className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCcw size={12} />
                Retry
              </button>
            </div>
          )}
          
          {deadlines && deadlines.length > 0 && (
            <button
              onClick={handleDownloadICS}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Download size={14} />
              <span>Export .ICS File ({deadlines.length})</span>
            </button>
          )}
        </div>
      </div>
      
      {deadlines && deadlines.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-850">
          <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Identified Milestones</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deadlines.map((dl, idx) => (
              <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-850 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-gray-900 dark:text-white text-xs">{dl.title}</span>
                  <span className="text-[10px] font-mono text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">{dl.date}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-450">{dl.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {deadlines && deadlines.length === 0 && (
        <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-850 flex items-center gap-2 text-gray-500 text-xs">
          <AlertTriangle size={14} className="text-amber-500" />
          No specific dates or deadlines were detected in this document.
        </div>
      )}
    </div>
  );
}
