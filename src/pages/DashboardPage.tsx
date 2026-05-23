import { useState, useMemo } from 'react';
import { 
  FileText, Clock, CheckCircle, UploadCloud, Search, 
  ArrowRight, Shield, Zap, AlertTriangle, Play 
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShareButton } from '../components/ShareButton';
import { WhatsAppShareModal } from '../components/WhatsAppShareModal';
import { Document } from '../services/storage';

interface StatItem {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
  percent: number;
}

const STATS: ReadonlyArray<StatItem> = Object.freeze([
  { label: 'Documents Processed', value: '24', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', percent: 85 },
  { label: 'Pending Review', value: '3', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', percent: 15 },
  { label: 'Total Ingestions', value: '128', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', percent: 100 },
]);

interface RecentDocItem {
  title: string;
  type: string;
  status: 'Completed' | 'Processing';
  date: string;
  risk: 'Low' | 'Medium' | 'High';
  riskScore: number;
  confidence: number;
}

const RECENT_DOCS: ReadonlyArray<RecentDocItem> = Object.freeze([
  { title: 'Employment Contract - TechCorp', type: 'Employment', status: 'Completed', date: '2 hours ago', risk: 'Low', riskScore: 18, confidence: 96 },
  { title: 'Commercial Lease Agreement 2026', type: 'Lease', status: 'Processing', date: '5 mins ago', risk: 'Medium', riskScore: 48, confidence: 91 },
  { title: 'NDA - Startup Partners LLC', type: 'NDA', status: 'Completed', date: 'Yesterday', risk: 'High', riskScore: 78, confidence: 94 },
  { title: 'Master Service Agreement (MSA)', type: 'Other', status: 'Completed', date: '3 days ago', risk: 'Medium', riskScore: 52, confidence: 89 },
  { title: 'Consulting Services Contract', type: 'Employment', status: 'Completed', date: '4 days ago', risk: 'Low', riskScore: 12, confidence: 95 },
]);

const CHART_COLORS = Object.freeze(['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']);

export function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'All' | 'NDA' | 'Lease' | 'Employment' | 'Other'>('All');
  const [shareDoc, setShareDoc] = useState<Document | null>(null);

  // Dynamic Search & Category Filtering mapped cleanly from stable RECENT_DOCS
  const filteredDocs = useMemo(() => {
    return RECENT_DOCS.filter((doc) => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            doc.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategoryFilter === 'All' || doc.type === selectedCategoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategoryFilter]);

  // Chart Data calculation derived from our document states computed once dynamically
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    RECENT_DOCS.forEach((doc) => {
      const type = doc.type || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map((key) => ({
      name: key,
      value: counts[key],
    }));
  }, []);

  const handleQuickIngest = () => {
  };

  return (
    <div className="app-container py-8 max-w-7xl">
      
      {/* Title & Introduction Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Legal Command Center</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Monitor contract risk thresholds, review dynamic AI extraction timelines, and audit active legal profiles.
          </p>
        </div>

        {/* Quick Action Trigger Button */}
        <NavLink
          to="/documents"
          className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-primary-600 hover:bg-primary-500 shadow-lg shadow-primary-500/20 transition-all duration-300"
        >
          <UploadCloud size={16} className="mr-2" />
          Ingest Document
        </NavLink>
      </div>

      {/* --- FEATURE 1: Quick Actions Dashboard Panel --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div 
          onClick={handleQuickIngest}
          className="group cursor-pointer p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 hover:border-primary/50 transition-all shadow-sm duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary-500/10 text-primary-500 group-hover:scale-110 transition-transform">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Smart Clause Audit</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Isolate liability and non-competes instantly.</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div className="group cursor-pointer p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 hover:border-emerald-500/50 transition-all shadow-sm duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Compliance Ingest</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Audit documents against SOC-2 or GDPR mandates.</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div className="group cursor-pointer p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 hover:border-purple-500/50 transition-all shadow-sm duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Compare</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Highlight side-by-side deviations across versions.</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Stats Grid featuring premium glassmorphism panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {STATS.map((stat) => (
          <div 
            key={stat.label} 
            className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            {/* Soft Ambient Icon Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-gray-100 to-transparent dark:from-gray-800/10 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color} group-hover:rotate-12 transition-transform duration-300`} />
              </div>
            </div>

            {/* In-Stat Progress Bar */}
            <div className="mt-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full ${stat.color === 'text-emerald-500' ? 'bg-emerald-500' : stat.color === 'text-amber-500' ? 'bg-amber-500' : 'bg-primary-600'}`}
                style={{ width: `${stat.percent}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Core Split Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Timeline list + search filters) - Spans 2 columns on large viewports */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Document Timeline Module container */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            
            {/* Title with search filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-gray-200 dark:border-gray-800 gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity Timeline</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Real-time state and audit trails of documents</p>
              </div>
              
              <NavLink 
                to="/documents" 
                className="text-xs font-semibold text-primary-500 hover:text-primary-600 hover:underline flex items-center gap-1 sm:ml-auto"
              >
                Manage all →
              </NavLink>
            </div>

            {/* Filter pills and dynamic search bar */}
            <div className="py-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Dynamic search input */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-450 dark:text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter activity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Category pills filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                {(['All', 'NDA', 'Lease', 'Employment', 'Other'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedCategoryFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${selectedCategoryFilter === filter 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* --- FEATURE 2: Dynamic Vertical Timeline Component --- */}
            <div className="pt-4">
              {filteredDocs.length > 0 ? (
                <div className="relative border-l border-gray-150 dark:border-gray-800 ml-4 pl-6 space-y-8">
                  {filteredDocs.map((doc) => {
                    const isProcessing = doc.status === 'Processing';
                    
                    return (
                      <div key={doc.title} className="relative group/item">
                        {/* Timeline Node Point */}
                        <div className={`absolute -left-[31px] top-1 h-[11px] w-[11px] rounded-full border-2 border-white dark:border-gray-900 transition-colors duration-300 ${isProcessing 
                          ? 'bg-amber-500 animate-ping' 
                          : 'bg-emerald-500'}`}
                        ></div>
                        <div className={`absolute -left-[31px] top-1 h-[11px] w-[11px] rounded-full border-2 border-white dark:border-gray-900 ${isProcessing 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'}`}
                        ></div>

                        {/* Timeline Item Details */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-950/40 hover:bg-gray-100/50 dark:hover:bg-gray-950/80 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{doc.type}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-450 dark:text-gray-500">{doc.date}</span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover/item:text-primary-500 transition-colors">
                              {doc.title}
                            </h4>
                            
                            {/* --- FEATURE 3: Risk scoring, risk-level indices and AI confidence gauges --- */}
                            {!isProcessing && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 items-center pt-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${doc.risk === 'High' 
                                  ? 'text-red-500 bg-red-500/10 border-red-500/20' 
                                  : doc.risk === 'Medium' 
                                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                                    : 'text-blue-500 bg-blue-500/10 border-blue-500/20'}`}
                                >
                                  <AlertTriangle size={10} />
                                  {doc.risk} Risk ({doc.riskScore}%)
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                  AI Confidence: <strong className="text-gray-700 dark:text-gray-300">{doc.confidence}%</strong>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Action Button/Processing tags */}
                          <div className="sm:self-center flex items-center gap-1">
                            {isProcessing ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                                Active Ingestion
                              </span>
                            ) : (
                              <>
                                {/* WhatsApp share — build a lightweight Document shape from RECENT_DOCS */}
                                <ShareButton
                                  document={{
                                    id: `dash_${doc.title.replace(/\s+/g, '_')}`,
                                    name: doc.title,
                                    type: 'pdf',
                                    size: 0,
                                    uploadDate: new Date().toISOString(),
                                    status: 'processed',
                                  }}
                                  onShare={setShareDoc}
                                  variant="icon"
                                />
                                <NavLink 
                                  to="/documents"
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all"
                                  aria-label="Review AI Audit details"
                                >
                                  <Play size={12} className="text-gray-400 hover:text-primary-500" />
                                </NavLink>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50/50 dark:bg-gray-950/20 rounded-xl border-2 border-dashed border-gray-150 dark:border-gray-800">
                  <FileText className="mx-auto text-gray-300 dark:text-gray-650 h-8 w-8 mb-2" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">No documents matched</p>
                  <p className="text-xs text-gray-500 dark:text-gray-450 mt-0.5">Try clearing filters or search variables.</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Recharts Chart & AI Confidence score gauge */}
        <div className="space-y-6">
          
          {/* Chart Card */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col justify-between h-[360px]">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Portfolio Breakdown</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Category distribution across system</p>
            </div>
            
            <div className="h-52 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#111827', borderRadius: '8px', border: '1px solid #1F2937', color: '#FFF', fontSize: '11px' }}
                    itemStyle={{ color: '#FFF' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={32}
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Risk Score Overview Dial */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Mean AI Confidence</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Aggregate AI prediction rating</p>
            
            {/* Visual Gauge dial */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative flex items-center justify-center">
                
                {/* Circular Track */}
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle 
                    cx="56" 
                    cy="56" 
                    r="48" 
                    className="stroke-gray-100 dark:stroke-gray-800 fill-transparent" 
                    strokeWidth="8"
                  />
                  <circle 
                    cx="56" 
                    cy="56" 
                    r="48" 
                    className="stroke-primary-600 fill-transparent" 
                    strokeWidth="8" 
                    strokeDasharray="301.6" 
                    strokeDashoffset="21" // represents 93% fill
                  />
                </svg>
                
                {/* Value Text */}
                <div className="absolute text-center">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">93.0%</span>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-500 block font-semibold mt-0.5">Optimal</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold">
                <CheckCircle size={10} />
                <span>Zero system degradation detected</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* WhatsApp Share Modal */}
      <WhatsAppShareModal
        document={shareDoc}
        onClose={() => setShareDoc(null)}
      />
    </div>
  );
}