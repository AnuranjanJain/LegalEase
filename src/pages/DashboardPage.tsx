import { useMemo } from 'react';
import { FileText, Clock, CheckCircle, UploadCloud, MessageSquare, AlertTriangle } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { StorageService, ChatStorageService } from '../services/storage';

export function DashboardPage() {
  const allDocs = useMemo(() => StorageService.getDocuments(), []);
  const chatSessions = useMemo(() => ChatStorageService.getSessions(), []);

  const processedCount = useMemo(() =>
    allDocs.filter(d => d.status === 'processed').length, [allDocs]);

  const processingCount = useMemo(() =>
    allDocs.filter(d => d.status === 'processing').length, [allDocs]);

  const totalCount = allDocs.length;

  const totalClausesFlagged = useMemo(() => 
    allDocs.reduce((acc, doc) => acc + (doc.clauses?.length || 0), 0)
  , [allDocs]);

  const totalChatMessages = useMemo(() => 
    chatSessions.reduce((acc, s) => acc + (s.messageCount || 0), 0)
  , [chatSessions]);

  const stats = useMemo(() => [
    { label: 'Documents Processed', value: String(processedCount), icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Pending Review', value: String(processingCount), icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { label: 'Total Uploads', value: String(totalCount), icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Clauses Flagged', value: String(totalClausesFlagged), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    { label: 'Chat Messages', value: String(totalChatMessages), icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  ], [processedCount, processingCount, totalCount, totalClausesFlagged, totalChatMessages]);

  const recentDocs = useMemo(() =>
    allDocs.slice(0, 5).map(doc => ({
      title: doc.name,
      type: doc.type?.toUpperCase() || 'Other',
      status: doc.status === 'processed' ? 'Completed' : 'Processing',
      date: new Date(doc.uploadDate).toLocaleDateString(),
    })), [allDocs]);

  // --- FEATURE 1: Logic to parse data dynamically for Recharts ---
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    allDocs.forEach((doc) => {
      const type = doc.type || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.keys(counts).map((key) => ({
      name: key,
      value: counts[key],
    }));
  }, [allDocs]);

  // --- Risk Distribution Data ---
  const riskData = useMemo(() => {
    let high = 0, medium = 0, low = 0;
    allDocs.forEach(doc => {
      doc.clauses?.forEach(c => {
        if (c.riskLevel === 'High') high++;
        else if (c.riskLevel === 'Medium') medium++;
        else if (c.riskLevel === 'Low') low++;
      });
    });
    return [
      { name: 'High Risk', value: high, fill: '#EF4444' },
      { name: 'Medium Risk', value: medium, fill: '#F59E0B' },
      { name: 'Low Risk', value: low, fill: '#10B981' }
    ];
  }, [allDocs]);

  // --- Activity Timeline Data ---
  const timelineData = useMemo(() => {
    const dates: Record<string, number> = {};
    allDocs.forEach(doc => {
      if (doc.uploadDate) {
        const d = new Date(doc.uploadDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        dates[d] = (dates[d] || 0) + 1;
      }
    });
    return Object.keys(dates).map(date => ({
      date,
      uploads: dates[date]
    })).reverse();
  }, [allDocs]);

  // Accessible UI color definitions matching Tailwind theme profiles
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  const navigate = useNavigate();

  const handleUploadTrigger = () => {
    navigate('/documents');
  };

  return (
    <div className="app-container py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

      {/* --- FEATURE 3: Empty State Engineering condition check --- */}
      {recentDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 min-h-[400px]">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 mb-4">
            <UploadCloud size={40} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No documents analyzed yet</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Get started by uploading your first legal document (NDA, Lease, or Employment contract) to populate your analytics dashboard.
          </p>
          <button
            type="button"
            onClick={handleUploadTrigger}
            className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
          >
            Quick Upload
          </button>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Core Content Layout Grid (Splits list and visual module cleanly) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Recent Documents Table List (Occupies 2 columns on wide layouts) */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-fit">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                <NavLink to="/documents" className="text-primary hover:text-primary/80 text-sm font-medium">View all</NavLink>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentDocs.map((doc, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{doc.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{doc.date}</p>
                      </div>
                    </div>

                    {/* --- FEATURE 2: Integrated Health Score & Risk Indicators --- */}
                    <div className="flex items-center space-x-2">
                      {doc.status === 'Processing' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          Processing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* --- FEATURE 1: Integrated Recharts Document Type Distribution Module --- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Document Distribution</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Breakdown of legal categories</p>
              </div>
              <div className="h-56 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#1F2937', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '12px' }}
                      itemStyle={{ color: '#FFF' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Level Distribution BarChart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Risk Level Distribution</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Frequency of flagged clauses by severity</p>
              </div>
              <div className="h-56 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ background: '#1F2937', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity Timeline LineChart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Upload Activity Over Time</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Documents analyzed per day</p>
              </div>
              <div className="h-56 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ background: '#1F2937', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="uploads" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFF' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}