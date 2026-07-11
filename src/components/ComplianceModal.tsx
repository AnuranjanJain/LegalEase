import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useCompliance } from '../contexts/ComplianceContext';

export function ComplianceModal() {
  const { isModalOpen, closeModal, acceptCompliance } = useCompliance();
  const [isChecked, setIsChecked] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setIsChecked(false);
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="compliance-modal-title">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
      
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3 text-amber-700 dark:text-amber-500">
            <ShieldAlert size={24} />
            <h2 id="compliance-modal-title" className="text-lg font-bold">Important Legal Disclaimer</h2>
          </div>
          <button 
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg p-1"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-sm text-gray-700 dark:text-gray-300 space-y-4">
          <p>
            Before proceeding, you must acknowledge the limitations of the AI tools provided by LegalEase.
          </p>
          
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 text-gray-800 dark:text-gray-200">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p><strong>Not Legal Advice:</strong> This tool provides automated AI-generated summaries and risk evaluations. It does <strong>not</strong> substitute for qualified legal counsel.</p>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p><strong>No Attorney-Client Privilege:</strong> Using this service does not establish an attorney-client relationship.</p>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p><strong>Accuracy Not Guaranteed:</strong> The AI may hallucinate or misinterpret complex legal nuances. Always verify outputs with a licensed professional.</p>
            </div>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 mt-6 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input 
                type="checkbox" 
                className="peer sr-only"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 peer-checked:bg-primary-600 peer-checked:border-primary-600 peer-focus:ring-2 peer-focus:ring-primary-500 peer-focus:ring-offset-2 dark:peer-focus:ring-offset-gray-900 transition-all flex items-center justify-center">
                <svg className={`w-3.5 h-3.5 text-white transition-transform ${isChecked ? 'scale-100' : 'scale-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 select-none group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
              I acknowledge that I understand these limitations and accept full liability for my use of this software.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button 
            onClick={closeModal}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
          >
            Cancel
          </button>
          <button 
            onClick={acceptCompliance}
            disabled={!isChecked}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            I Accept & Continue
          </button>
        </div>
        
      </div>
    </div>
  );
}
