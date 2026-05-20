import { useState } from 'react';
import { 
  Search, Book, FileText, Scale, Gavel, Building2, Download, 
  Bookmark, BookmarkCheck, Eye, X, Zap, ShieldCheck 
} from 'lucide-react';

interface DocCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  documents: Document[];
}

interface Document {
  id: string;
  title: string;
  type: 'PDF' | 'DOCX' | 'TXT';
  size: string;
  date: string;
  previewContent: string;
  aiInsights: string;
}

const CATEGORIES: ReadonlyArray<DocCategory> = Object.freeze([
  {
    id: 'civil',
    name: 'Civil Law',
    icon: Scale,
    description: 'Contracts, property disputes, and family law documents.',
    documents: [
      { 
        id: 'c1', 
        title: 'Standard Lease Agreement', 
        type: 'PDF', 
        size: '2.4 MB', 
        date: '2024-02-15',
        previewContent: "THIS LEASE AGREEMENT is made between Landlord and Tenant. The Premises shall be used solely for residential purposes. Monthly rental fees shall be due on the 1st of every calendar month. Landlord reserves the right to audit the premises upon 24 hours written notice.",
        aiInsights: "This residential template is standard. The 24-hour audit clause is legally compliant and protects tenant privacy adequately. No high-risk items found."
      },
      { 
        id: 'c2', 
        title: 'Divorce Petition Template', 
        type: 'DOCX', 
        size: '1.1 MB', 
        date: '2024-01-20',
        previewContent: "IN THE FAMILY COURT OF CIVIL LITIGATION. In the Matter of the dissolution of the marriage of Petitioner and Respondent. Petitioner alleges that there has been an irretrievable breakdown of the marriage relationship, and there remains no reasonable prospect of reconciliation.",
        aiInsights: "Procedurally complete. Ensure localized court jurisdiction criteria are filled out properly in section 4 before filing."
      },
      { 
        id: 'c3', 
        title: 'Property Sale Deed', 
        type: 'PDF', 
        size: '3.5 MB', 
        date: '2023-12-10',
        previewContent: "THIS PROPERTY SALE DEED transfers full absolute ownership rights from Vendor to Purchaser for the agreed-upon consideration price. Vendor warrants that the property is completely free from any mortgage, legal claims, liens, or structural disputes.",
        aiInsights: "HIGH-FIDELITY DEED: Ensure title search certificate is attached to verify the Vendor warranty stated in paragraph 2."
      },
    ]
  },
  {
    id: 'criminal',
    name: 'Criminal Law',
    icon: Gavel,
    description: 'Penal codes, procedural guidelines, and case law summaries.',
    documents: [
      { 
        id: 'cr1', 
        title: 'Criminal Procedure Code Summary', 
        type: 'PDF', 
        size: '5.2 MB', 
        date: '2024-02-01',
        previewContent: "UNDERSTANDING ARREST AND INVESTIGATION POWERS. Under the procedural penal parameters, investigating officers must furnish reasons in writing when conducting arrests for non-cognizable offenses, and satisfy judicial magistrate criteria.",
        aiInsights: "Excellent quick reference guide for paralegals. Outlines custody timelines and bail application frameworks clearly."
      },
      { 
        id: 'cr2', 
        title: 'Bail Application Format', 
        type: 'DOCX', 
        size: '0.8 MB', 
        date: '2024-01-15',
        previewContent: "APPLICATION FOR BAIL UNDER PENAL GUIDELINE SECTION 437. May it please your Honor, the applicant is innocent of the alleged crimes, has solid ties to the community, and presents no flight or evidence tampering risks.",
        aiInsights: "Standard judicial bail draft. Ready to import. Custom parameters must be populated for applicant custody history."
      },
    ]
  },
  {
    id: 'corporate',
    name: 'Corporate Law',
    icon: Building2,
    description: 'Company incorporation, compliance, and regulatory documents.',
    documents: [
      { 
        id: 'co1', 
        title: 'Articles of Incorporation', 
        type: 'PDF', 
        size: '1.8 MB', 
        date: '2024-02-10',
        previewContent: "ARTICLES OF INCORPORATION. The name of the corporation shall be Startup Ventures Corp. The purpose of the corporation is to engage in any lawful business action. The authorized stock count shall consist of 10,000,000 shares of common stock.",
        aiInsights: "Standard corporate structuring template. Includes indemnification safety parameters for directors and officers."
      },
      { 
        id: 'co2', 
        title: 'Board Resolution Template', 
        type: 'DOCX', 
        size: '0.5 MB', 
        date: '2024-02-05',
        previewContent: "RESOLVED, that the corporation is hereby authorized to open a commercial checking account at Silicon Valley Finance, and the designated officers listed herein are authorized to approve and sign withdrawals and draft instruments.",
        aiInsights: "Standard banking resolution draft. Ensure certified secretary signature block at bottom is signed before presenting to bank branches."
      },
      { 
        id: 'co3', 
        title: 'Non-Disclosure Agreement (NDA)', 
        type: 'PDF', 
        size: '3.1 MB', 
        date: '2024-01-30',
        previewContent: "MUTUAL NON-DISCLOSURE AGREEMENT. The Receiving Party agrees to hold all Disclosing Party Confidential Material in strict confidence, and shall not disclose it to any third party for a duration of five (5) years following termination.",
        aiInsights: "STANDARD NDA: Contains mutual definitions. The 5-year confidentiality duration clause in Section 3 is market-standard and moderate risk."
      },
    ]
  },
  {
    id: 'constitutional',
    name: 'Constitutional Law',
    icon: Book,
    description: 'Constitution articles, amendments, and landmark judgments.',
    documents: [
      { 
        id: 'cn1', 
        title: 'Constitution Reference Guide', 
        type: 'PDF', 
        size: '12.5 MB', 
        date: '2023-11-26',
        previewContent: "PREAMBLE: We, the people, do solemnly resolve to constitute this nation into a Sovereign, Socialist, Secular, Democratic Republic and to secure to all its citizens Justice, Liberty, Equality and Fraternity.",
        aiInsights: "Comprehensive judicial reference guide mapping the fundamental articles of the Constitution. Extremely helpful for research briefs."
      },
      { 
        id: 'cn2', 
        title: 'Fundamental Rights Overview', 
        type: 'PDF', 
        size: '1.5 MB', 
        date: '2024-01-01',
        previewContent: "CIVIL LIBERTIES AND RIGHTS ANALYSIS. Citizens are guaranteed the Right to Equality, Right to Freedom of Speech and Expression, and Right to Constitutional Remedies under judicial review processes.",
        aiInsights: "Sleek explanatory overview mapping the constitutional safeguards. Highlights landmark supreme court decisions."
      },
    ]
  },
]);

const POPULAR_SUGGESTIONS: ReadonlyArray<string> = Object.freeze([
  "Lease Agreement", 
  "NDA Template", 
  "Bail Application", 
  "Articles of Incorporation"
]);

import { useCallback, useRef, useEffect, useMemo } from 'react';

export function DocumentationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const downloadTimerRef = useRef<any | null>(null);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
  }, []);

  const toggleBookmark = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  }, []);

  const handleDownload = useCallback((docId: string, docTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingDocId(docId);
    
    if (downloadTimerRef.current) {
      clearTimeout(downloadTimerRef.current);
    }
    
    // Simulate active downloading progress bar feedback in a memory-safe timeout
    downloadTimerRef.current = setTimeout(() => {
      setDownloadingDocId(null);
      alert(`Successfully downloaded: ${docTitle}`);
    }, 1500);
  }, []);

  // Cleanup active timeouts on component unmount to prevent stale state sets
  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        clearTimeout(downloadTimerRef.current);
      }
    };
  }, []);

  // Filter and map expensive document listings inside useMemo to avoid recalculations on un-related rerenders
  const displayCategories = useMemo(() => {
    const filteredCategories = activeCategory === 'all'
      ? CATEGORIES
      : CATEGORIES.filter(c => c.id === activeCategory);

    return filteredCategories.map(cat => ({
      ...cat,
      documents: cat.documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        doc.previewContent.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(cat => cat.documents.length > 0 || searchQuery === '');
  }, [activeCategory, searchQuery]);

  return (
    <div className="app-container py-8 max-w-7xl">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Legal Documentation Library</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
          Access a curated library of standard legal templates, drafts, and historical constitutional guide files.
        </p>
      </div>

      {/* Search and Filters panel */}
      <div className="flex flex-col lg:flex-row gap-4 mb-3">
        {/* Search bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search templates, clauses, or text excerpt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
          />
        </div>

        {/* Category Toggles scroll list */}
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${activeCategory === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-455 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${activeCategory === cat.id
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-455 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <cat.icon size={14} />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* --- FEATURE 3: Search suggestions triggers below search container --- */}
      <div className="flex flex-wrap items-center gap-2 mb-8 text-xs">
        <span className="text-gray-400 dark:text-gray-500 font-medium">Common terms:</span>
        {POPULAR_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => handleSuggestionClick(suggestion)}
            className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-850 text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-white transition-colors"
          >
            {suggestion}
          </button>
        ))}
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-red-500 font-semibold hover:underline ml-2"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Main Grid Content */}
      <div className="space-y-8">
        {displayCategories.map((category) => (
          <div key={category.id} className="animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary-600/10 text-primary-500">
                <category.icon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{category.name}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{category.description}</p>
              </div>
            </div>

            {/* Document grid items */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.documents.map((doc) => {
                const isBookmarked = bookmarkedIds.includes(doc.id);
                const isDownloading = downloadingDocId === doc.id;
                
                return (
                  <div
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className="group bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-primary-500/50 transition-all cursor-pointer flex flex-col justify-between h-44 relative overflow-hidden"
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="p-2 rounded-lg bg-gray-55 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-primary-600/10 group-hover:text-primary-500 transition-colors">
                          <FileText size={18} />
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Bookmark trigger */}
                          <button
                            onClick={(e) => toggleBookmark(doc.id, e)}
                            className="p-1 rounded-full text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Bookmark template toggle"
                          >
                            {isBookmarked ? (
                              <BookmarkCheck size={16} className="text-amber-500" />
                            ) : (
                              <Bookmark size={16} />
                            )}
                          </button>
                          
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase">
                            {doc.type}
                          </span>
                        </div>
                      </div>

                      {/* Header details */}
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-primary-500 transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-normal">
                        {doc.previewContent}
                      </p>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-850">
                      <span>{doc.size} • {doc.date}</span>
                      
                      <div className="flex items-center gap-2">
                        {/* Immersive Preview button */}
                        <button 
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-450 hover:text-white hover:bg-primary-600 transition-all flex items-center gap-1"
                          aria-label="Launch document viewer"
                        >
                          <Eye size={12} />
                          <span className="text-[9px] uppercase font-bold tracking-wider">Preview</span>
                        </button>
                        
                        {/* Download button with simulated loading progress */}
                        <button 
                          onClick={(e) => handleDownload(doc.id, doc.title, e)}
                          disabled={isDownloading}
                          className={`p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-450 hover:text-white hover:bg-emerald-600 transition-all ${isDownloading ? 'bg-emerald-600/20 text-emerald-500 border-emerald-500/20' : ''}`}
                          aria-label="Download template file"
                        >
                          {isDownloading ? (
                            <span className="text-[9px] uppercase font-bold tracking-widest animate-pulse">Saving...</span>
                          ) : (
                            <Download size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {category.documents.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-450 italic bg-gray-50 dark:bg-gray-950/20 rounded-xl border border-gray-150 dark:border-gray-800">
                No matching legal documents found in {category.name}.
              </div>
            )}
          </div>
        ))}

        {displayCategories.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm max-w-xl mx-auto">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Search size={28} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">No reference files found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Try adjusting your active keywords or category nodes.</p>
          </div>
        )}
      </div>

      {/* --- FEATURE 5: Immersive document viewer modal (Side-by-side) --- */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col justify-between animate-slide-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-250 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-600/10 text-primary-500">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">{previewDoc.title}</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-450 uppercase tracking-widest">{previewDoc.type} • {previewDoc.size}</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Close document viewer modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body (Side-by-side layout) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto">
              {/* Left Column: Legal Text Parchment preview */}
              <div className="p-6 bg-amber-50/50 dark:bg-gray-950/80 border-b md:border-b-0 md:border-r border-gray-150 dark:border-gray-850 overflow-y-auto max-h-[50vh] md:max-h-none">
                <span className="text-[9px] uppercase font-extrabold tracking-widest text-gray-500 block mb-2">Original Document Draft</span>
                <div className="font-serif text-sm leading-relaxed text-gray-850 dark:text-gray-350 p-4 border border-gray-200 dark:border-gray-800/80 bg-white dark:bg-gray-950 rounded-lg shadow-inner select-text">
                  {previewDoc.previewContent}
                </div>
              </div>

              {/* Right Column: AI Ingestion Analysis summary */}
              <div className="p-6 space-y-4 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50">
                <span className="text-[9px] uppercase font-extrabold tracking-widest text-primary-500 block mb-2 flex items-center gap-1">
                  <Zap size={10} /> AI Ingestion Summary
                </span>
                
                {/* Visual score details */}
                <div className="p-4 bg-gray-100/50 dark:bg-gray-950 rounded-xl border border-gray-150 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="text-emerald-500 h-4.5 w-4.5" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Audit Assessment Passed</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal">
                    {previewDoc.aiInsights}
                  </p>
                </div>

                {/* Simulated Risk Meter */}
                <div className="p-4 bg-gray-100/50 dark:bg-gray-950 rounded-xl border border-gray-150 dark:border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Draft Liability Index:</span>
                    <span className="text-blue-500 font-bold">Low Risk</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: '20%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-250 dark:border-gray-800 flex justify-end gap-3">
              <button 
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                Close Preview
              </button>
              <button 
                onClick={(e) => { handleDownload(previewDoc.id, previewDoc.title, e); setPreviewDoc(null); }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 shadow-md shadow-primary-500/20 transition-all flex items-center gap-1.5"
              >
                <Download size={12} />
                Download Template
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
