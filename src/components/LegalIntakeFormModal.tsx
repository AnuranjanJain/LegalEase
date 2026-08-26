import React, { useState } from 'react';
import { X, FileSignature, CheckCircle2, AlertCircle, Building2, User, Calendar, Scale } from 'lucide-react';
import { CircularProgressRing } from './CircularProgressRing';
import { useFormProgress, FieldDefinition } from '../hooks/useFormProgress';
import { useToast } from '../contexts/ToastContext';

export interface LegalIntakeFormData {
  clientName: string;
  counterpartyName: string;
  contractType: string;
  jurisdiction: string;
  effectiveDate: string;
  termMonths: string;
  governingLaw: string;
  confidentialityTerms: string;
  indemnityCap: string;
  signerName: string;
  signerTitle: string;
  agreeToTerms: boolean;
}

export interface LegalIntakeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: LegalIntakeFormData) => void;
}

const INITIAL_FORM: LegalIntakeFormData = {
  clientName: '',
  counterpartyName: '',
  contractType: 'Non-Disclosure Agreement',
  jurisdiction: 'California Law',
  effectiveDate: '',
  termMonths: '12',
  governingLaw: '',
  confidentialityTerms: '',
  indemnityCap: '',
  signerName: '',
  signerTitle: '',
  agreeToTerms: false,
};

export const LegalIntakeFormModal: React.FC<LegalIntakeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<LegalIntakeFormData>(INITIAL_FORM);
  const { showToast } = useToast();

  const requiredFieldDefs: FieldDefinition[] = [
    { key: 'clientName', label: 'Primary Client Name', value: formData.clientName, required: true },
    { key: 'counterpartyName', label: 'Counterparty Organization', value: formData.counterpartyName, required: true },
    { key: 'contractType', label: 'Contract Agreement Type', value: formData.contractType, required: true },
    { key: 'jurisdiction', label: 'Legal Jurisdiction', value: formData.jurisdiction, required: true },
    { key: 'effectiveDate', label: 'Effective Start Date', value: formData.effectiveDate, required: true },
    { key: 'governingLaw', label: 'Governing Law Jurisdiction', value: formData.governingLaw, required: true },
    { key: 'indemnityCap', label: 'Indemnification Cap ($)', value: formData.indemnityCap, required: true },
    { key: 'signerName', label: 'Authorized Signer Name', value: formData.signerName, required: true },
    { key: 'agreeToTerms', label: 'Compliance & Verification Confirmation', value: formData.agreeToTerms, required: true },
  ];

  const progress = useFormProgress(requiredFieldDefs);

  const missingLabels = progress.missingRequiredKeys.map((key) => {
    const found = requiredFieldDefs.find((f) => f.key === key);
    return found ? found.label : key;
  });

  if (!isOpen) return null;

  const handleChange = (key: keyof LegalIntakeFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progress.isComplete) {
      showToast(
        `Please complete all required fields (${progress.filledRequired} of ${progress.totalRequired} filled).`,
        'warning'
      );
      return;
    }

    showToast('Legal Intake Form submitted successfully! Generating document...', 'success');
    if (onSuccess) onSuccess(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-600/10 text-primary-600 dark:text-primary-400 rounded-2xl border border-primary-500/20">
              <FileSignature size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Legal Document Intake Form
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Complete required intake fields to generate standardized, compliant legal contracts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close intake form modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[75vh]">
          
          {/* Section 1: Parties */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-150 dark:border-gray-800">
              <Building2 size={18} className="text-primary-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                1. Contracting Parties
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Primary Client / Entity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Legal Corp"
                  value={formData.clientName}
                  onChange={(e) => handleChange('clientName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Counterparty Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nexus Technology Ltd"
                  value={formData.counterpartyName}
                  onChange={(e) => handleChange('counterpartyName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Agreement Parameters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-150 dark:border-gray-800">
              <Calendar size={18} className="text-primary-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                2. Agreement Parameters
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Contract Agreement Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.contractType}
                  onChange={(e) => handleChange('contractType', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                >
                  <option value="Non-Disclosure Agreement">Non-Disclosure Agreement (NDA)</option>
                  <option value="Master Services Agreement">Master Services Agreement (MSA)</option>
                  <option value="Employment Agreement">Employment Agreement</option>
                  <option value="Software Licensing Agreement">Software Licensing Agreement</option>
                  <option value="Independent Contractor Agreement">Independent Contractor Agreement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Primary Jurisdiction <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.jurisdiction}
                  onChange={(e) => handleChange('jurisdiction', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                >
                  <option value="California Law">California Law</option>
                  <option value="New York Law">New York Law</option>
                  <option value="Delaware Corporate Law">Delaware Corporate Law</option>
                  <option value="Indian Contract Act">Indian Contract Act</option>
                  <option value="United Kingdom Law">United Kingdom Law</option>
                  <option value="European Union Law">European Union Law</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Effective Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.effectiveDate}
                  onChange={(e) => handleChange('effectiveDate', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Legal & Financial Terms */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-150 dark:border-gray-800">
              <Scale size={18} className="text-primary-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                3. Legal & Financial Provisions
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Governing Law State/Country <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. State of California"
                  value={formData.governingLaw}
                  onChange={(e) => handleChange('governingLaw', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Indemnification Liability Cap ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500,000"
                  value={formData.indemnityCap}
                  onChange={(e) => handleChange('indemnityCap', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Custom Confidentiality Scope / Special Clauses (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Detail non-compete bounds, intellectual property retention, or custom dispute resolution procedures..."
                value={formData.confidentialityTerms}
                onChange={(e) => handleChange('confidentialityTerms', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Section 4: Authorized Signer & Compliance */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-150 dark:border-gray-800">
              <User size={18} className="text-primary-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                4. Signer Credentials & Verification
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Authorized Signer Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  value={formData.signerName}
                  onChange={(e) => handleChange('signerName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Signer Official Title / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Legal Officer"
                  value={formData.signerTitle}
                  onChange={(e) => handleChange('signerTitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formData.agreeToTerms}
                onChange={(e) => handleChange('agreeToTerms', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="font-bold">Compliance Verification Confirmation <span className="text-red-500">*</span>:</span> I confirm that all submitted details are accurate, authorized under organizational power of attorney, and compliant with applicable jurisdictional privacy and contract guidelines.
              </span>
            </label>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold">
              {progress.isComplete ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 size={16} /> 100% Required Fields Completed
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/20">
                  <AlertCircle size={16} /> {progress.filledRequired} of {progress.totalRequired} required fields filled
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
                  progress.isComplete
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/30'
                }`}
              >
                Generate Legal Document
              </button>
            </div>
          </div>
        </form>

        {/* Floating Circular Progress Ring Inside Modal */}
        <CircularProgressRing
          filledRequired={progress.filledRequired}
          totalRequired={progress.totalRequired}
          percentage={progress.percentage}
          label="Intake Completion"
          isFloating={true}
          position="bottom-right"
          missingFieldLabels={missingLabels}
        />
      </div>
    </div>
  );
};
