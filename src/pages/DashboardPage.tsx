import { useMemo } from 'react';
import { FileText, Clock, CheckCircle, UploadCloud, ArrowUpRight, Activity, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export function DashboardPage() {
  const recentDocs = [
    { title: 'Employment Contract - TechCorp', type: 'Employment', status: 'Completed', date: '2 hours ago', id: 'DOC-8829' },
    { title: 'Lease Agreement 2024', type: 'Lease', status: 'Processing', date: '5 mins ago', id: 'DOC-8830' },
    { title: 'NDA - Startup Inc', type: 'NDA', status: 'Completed', date: 'Yesterday', id: 'DOC-8821' },
  ];

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    recentDocs.forEach((doc) => {
      const type = doc.type || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map((key) => ({
      name: key,
      value: counts[key],
    }));
  }, [recentDocs]);

  // Premium minimalist palette (Electric Blue, Emerald, Pure White, Slate)
  const COLORS = ['#3b82f6', '#10b981', '#ffffff', '#334155'];

  const handleUploadTrigger = () => {};

  return (
    <div className="w-full min-h-screen bg-[#030303] text-slate-200 p-6 md:p-10 font-sans relative overflow-hidden">
      
      {/* Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header - Apple Style Typography */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">LegalEase Workspace</span>
            </div>
            <h1 className="text-4xl font-semibold text-white tracking-tight">Overview</h1>
          </div>
          <button
            onClick={handleUploadTrigger}
            className="group relative flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-full text-white bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-md overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <UploadCloud className="w-4 h-4 relative z-10 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="relative z-10">Upload Document</span>
          </button>
        </div>

        {recentDocs.length === 0 ? (
          /* Premium Empty State */
          <div className="flex flex-col items-center justify-center p-16 text-center border border-white/5 rounded-[2rem] bg-white/[0.02] backdrop-blur-xl shadow-2xl min-h-[500px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
            <div className="p-5 bg-white/5 rounded-2xl mb-6 shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10">
              <Activity className="w-10 h-10 text-white/60" />
            </div>
            <h3 className="text-2xl font-medium text-white mb-3 tracking-tight">Awaiting Documents</h3>
            <p className="text-sm text-white/50 max-w-sm mb-8 leading-relaxed">
              Your intelligence dashboard is ready. Upload your first legal contract to begin AI analysis.
            </p>
            <button
              onClick={handleUploadTrigger}
              className="px-6 py-3 text-sm font-medium rounded-full text-black bg-white hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Initialize Upload
            </button>
          </div>
        ) : (
          <>
            {/* Glassmorphic Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Processed', value: '24', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
                { label: 'Reviewing', value: '3', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
                { label: 'Total Files', value: '128', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' }
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className="relative p-6 rounded-[2rem] bg-white/[0.02] backdrop-blur-xl border border-white/5 hover:bg-white/[0.04] transition-all duration-500 group overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  <div className="flex justify-between items-start mb-8">
                    <div className={`p-3 rounded-2xl ${stat.bg} border ${stat.border}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <h3 className="text-4xl font-semibold text-white tracking-tight">{stat.value}</h3>
                    </div>
                    <p className="text-sm font-medium text-white/50">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Recent Activity Table (Spans 2 columns) */}
              <div className="lg:col-span-2 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col h-full relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h2 className="text-lg font-medium text-white tracking-tight">Recent Activity</h2>
                  <NavLink to="/documents" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group">
                    View all <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </NavLink>
                </div>
                
                <div className="flex-1 w-full overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-white/40 border-b border-white/5">
                        <th className="pb-4 font-medium px-4">Document</th>
                        <th className="pb-4 font-medium px-4">Category</th>
                        <th className="pb-4 font-medium px-4">Status</th>
                        <th className="pb-4 font-medium px-4 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {recentDocs.map((doc, idx) => (
                        <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:border-blue-500/30 group-hover:text-blue-400 transition-colors">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-white font-medium mb-0.5">{doc.title}</p>
                                <p className="text-xs text-white/40">{doc.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-white/60">{doc.type}</td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm
                              ${doc.status === 'Completed' 
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${doc.status === 'Completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-blue-400 animate-pulse'}`}></span>
                              {doc.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right text-white/40">{doc.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Minimalist Data Viz */}
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col h-full relative">
                <div className="mb-8 px-2">
                  <h2 className="text-lg font-medium text-white tracking-tight">Analysis Breakdown</h2>
                  <p className="text-sm text-white/40 mt-1">Categorical distribution</p>
                </div>
                <div className="flex-1 w-full relative min-h-[220px] flex items-center justify-center">
                  {/* Inner glow behind chart */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 rounded-full blur-[50px]"></div>
                  
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={6}
                      >
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          background: 'rgba(10, 10, 10, 0.8)', 
                          backdropFilter: 'blur(12px)',
                          borderColor: 'rgba(255, 255, 255, 0.1)', 
                          borderRadius: '16px', 
                          color: '#fff',
                          fontSize: '13px',
                          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)'
                        }}
                        itemStyle={{ color: '#fff', fontWeight: 500 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Custom Center Label */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <span className="block text-3xl font-semibold text-white tracking-tight">{recentDocs.length}</span>
                    <span className="block text-[10px] uppercase tracking-wider text-white/40 mt-1">Docs</span>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}