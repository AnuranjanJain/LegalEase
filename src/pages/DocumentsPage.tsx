import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  UploadCloud, FileText, Trash2, Eye, Search, 
  Grid, List, CheckCircle, ArrowRight, RefreshCcw 
} from 'lucide-react';
import { StorageService, Document } from '../services/storage';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

import { useDocumentProcessing } from '../contexts/DocumentProcessingContext';

import { ShareButton } from '../components/ShareButton';
import { WhatsAppShareModal } from '../components/WhatsAppShareModal';


export function DocumentsPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'All' | 'PDF' | 'DOCX' | 'TXT'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { processDocument } = useDocumentProcessing();

  // Load documents from StorageService on mount
  useEffect(() => {
    setDocuments(StorageService.getDocuments());
  }, []);

  const processFiles = async (files: FileList) => {
    if (files.length === 0) return;
    
    // Process the first file and redirect to progress tracker
    const file = files[0];
    showToast(`Initiating cognitive audit pipeline for "${file.name}"...`, 'info');
    
    try {
      // Run the pipeline asynchronously in background context
      processDocument(file).then(() => {
        showToast(`Document "${file.name}" successfully analyzed by AI!`, 'success');
        setDocuments(StorageService.getDocuments());
      }).catch((err) => {
        showToast(`AI audit failed: ${err.message || err}`, 'error');
        setDocuments(StorageService.getDocuments());
      });
      
      // Redirect straight to processing stepper page
      navigate('/processing');
    } catch (err) {
      console.error(err);
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      if (e.target.value) e.target.value = '';
    }
  };

  const handleDelete = (id: string, name: string) => {
    try {
      const remaining = documents.filter((doc) => doc.id !== id);
      setDocuments(remaining);
      localStorage.setItem('le_documents', JSON.stringify(remaining));
      showToast(`"${name}" deleted successfully.`, 'info');
    } catch (err) {
      showToast('Failed to delete document.', 'error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Search & Type Filtering
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedTypeFilter === 'All' || doc.type.toUpperCase() === selectedTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, selectedTypeFilter]);

  const getDocTypeDetails = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'pdf') {
      return {
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        iconColor: 'text-red-500'
      };
    }
    if (t === 'docx' || t === 'doc') {
      return {
        color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        iconColor: 'text-blue-500'
      };
    }
    return {
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      iconColor: 'text-purple-500'
    };
  };

  const handleReviewDetails = (doc: Document) => {
    if (doc.status === 'processing') {
      showToast('Document analysis is in progress. Please wait...', 'warning');
      navigate('/processing');
    } else {
      showToast(`Initiating cognitive audit review for "${doc.name}"`, 'success');
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative overflow-hidden bg-background-light dark:bg-background-dark min-h-screen text-gray-800 dark:text-gray-200">
      
      {/* Decorative Ambient Background Glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 bg-primary-600/10 dark:bg-primary-600/5 rounded-full filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[90px] animate-pulse" style={{ animationDelay: '2.5s' }}></div>
      </div>

      <div className="app-container relative z-10 py-12 max-w-7xl">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white dark:bg-gradient-to-r dark:from-white dark:to-blue-200 dark:bg-clip-text dark:text-transparent">
              Document Vault
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 max-w-xl">
              Upload, analyze, and manage your legal documents. Our cognitive AI extracts clause metrics and assesses liabilities instantly.
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-5 py-3 text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-500 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/35 hover:scale-[1.02] active:scale-95 transition-all duration-300"
          >
            <UploadCloud size={18} className="mr-2 animate-bounce" />
            Upload Document
          </button>
        </div>

        {/* --- UPLOAD AREA WITH GLASSMORPHISM AND NEUMORPHIC GLOW --- */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group cursor-pointer p-10 rounded-2xl border-2 border-dashed text-center transition-all duration-500 bg-white/70 dark:bg-gray-950/40 backdrop-blur-md relative overflow-hidden mb-10 ${
            isDragging
              ? 'border-primary-600 bg-primary-600/5 dark:bg-primary-500/10 shadow-[0_0_30px_rgba(37,99,235,0.15)] scale-[1.01]'
              : 'border-gray-250 dark:border-gray-800 hover:border-primary-600 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 hover:shadow-md'
          }`}
          role="button"
          aria-label="Upload documents by dragging and dropping or clicking here"
        >
          {/* Ambient card back glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary-600/5 rounded-full filter blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt"
            multiple
          />
          
          <div className="w-16 h-16 bg-primary-600/10 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
            <UploadCloud size={32} />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {isDragging ? 'Drop Files Here' : 'Click to Upload or Drag & Drop'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Supports PDF, DOCX, DOC, and TXT documents.
          </p>
          <span className="inline-block text-[11px] font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            Max File Size: 10MB
          </span>
        </div>

        {/* search and Filters Bar */}
        <div className="bg-white/80 dark:bg-gray-950/80 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm backdrop-blur-md flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          
          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input 
              type="text" 
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Type filters and layout mode toggle */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-850">
              {(['All', 'PDF', 'DOCX', 'TXT'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedTypeFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedTypeFilter === filter 
                      ? 'bg-primary-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Separator line */}
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block"></div>

            {/* View Mode Grid/List buttons */}
            <div className="flex p-1 bg-gray-100/80 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-850">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                aria-label="Grid view"
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                aria-label="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>

        </div>

        {/* --- PREMIUM DYNAMIC DOCUMENT VIEWS --- */}
        {filteredDocs.length > 0 ? (
          viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map((doc) => {
                const isProcessing = doc.status === 'processing';
                const typeInfo = getDocTypeDetails(doc.type);
                
                return (
                  <div 
                    key={doc.id} 
                    className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                  >
                    {/* Glowing bar at top based on file type */}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${doc.type === 'pdf' ? 'from-red-500 to-rose-500' : doc.type === 'docx' ? 'from-blue-500 to-indigo-500' : 'from-purple-500 to-pink-500'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                    <div className="p-6">
                      {/* Header with Type badge and Status */}
                      <div className="flex justify-between items-start mb-4">
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${typeInfo.color}`}>
                          {doc.type}
                        </span>
                        
                        {isProcessing ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                            <RefreshCcw size={10} className="animate-spin" />
                            AI Auditing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle size={10} />
                            Ready
                          </span>
                        )}
                      </div>

                      {/* File Icon & Info */}
                      <div className="flex gap-4 items-start">
                        <div className={`p-3 rounded-xl bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 flex-shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                          <FileText size={28} className={typeInfo.iconColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 
                            onClick={() => handleReviewDetails(doc)}
                            className="text-base font-bold text-gray-900 dark:text-white group-hover:text-primary-500 transition-colors truncate cursor-pointer"
                            title={doc.name}
                          >
                            {doc.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatFileSize(doc.size)}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            Uploaded {formatDate(doc.uploadDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="p-4 bg-gray-50/50 dark:bg-gray-950/20 border-t border-gray-150 dark:border-gray-800/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(doc.id, doc.name)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          aria-label={`Delete ${doc.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                        {/* WhatsApp Share button */}
                        <ShareButton
                          document={doc}
                          onShare={setShareDoc}
                          variant="icon"
                        />
                      </div>

                      <button
                        onClick={() => handleReviewDetails(doc)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border border-gray-250 dark:border-gray-800 hover:border-primary-500 hover:bg-primary-500 hover:text-white transition-all`}
                      >
                        {isProcessing ? (
                          <>
                            <span>View Progress</span>
                            <ArrowRight size={12} className="animate-pulse" />
                          </>
                        ) : (
                          <>
                            <Eye size={12} />
                            <span>Audit Analysis</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-150 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-950/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Document Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Uploaded</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Audit Status</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                    {filteredDocs.map((doc) => {
                      const isProcessing = doc.status === 'processing';
                      const typeInfo = getDocTypeDetails(doc.type);
                      
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-950/40 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0`}>
                                <FileText size={18} className={typeInfo.iconColor} />
                              </div>
                              <div>
                                <h4 
                                  onClick={() => handleReviewDetails(doc)}
                                  className="text-sm font-bold text-gray-950 dark:text-white hover:text-primary transition-colors cursor-pointer truncate max-w-sm"
                                  title={doc.name}
                                >
                                  {doc.name}
                                </h4>
                                <span className={`text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.1 rounded border ${typeInfo.color} inline-block mt-0.5`}>
                                  {doc.type}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatFileSize(doc.size)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(doc.uploadDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isProcessing ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                                <RefreshCcw size={10} className="animate-spin" />
                                Processing
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <CheckCircle size={10} />
                                Analyzed
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleReviewDetails(doc)}
                                className="p-2 text-gray-400 hover:text-primary-500 dark:hover:text-white hover:bg-primary-500/10 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              {/* WhatsApp Share button — list view */}
                              <ShareButton
                                document={doc}
                                onShare={setShareDoc}
                                variant="icon"
                              />
                              <button
                                onClick={() => handleDelete(doc.id, doc.name)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* EMPTY STATE */
          <div className="text-center py-20 bg-white/50 dark:bg-gray-950/20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 shadow-sm">
            <FileText className="mx-auto text-gray-300 dark:text-gray-700 h-16 w-16 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">No Documents Found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-450 max-w-sm mx-auto mb-6">
              There are no documents matching your filters. Upload a contract above or adjust your search.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2.5 text-xs font-bold rounded-xl text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all"
            >
              Upload Sample File
            </button>
          </div>
        )}

      </div>

      {/* WhatsApp Share Modal — portal-rendered above everything */}
      <WhatsAppShareModal
        document={shareDoc}
        onClose={() => setShareDoc(null)}
      />
    </div>
  );
}
