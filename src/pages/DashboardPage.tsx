import { FileText, Clock, CheckCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function DashboardPage() {
  const stats = [
    { label: 'Documents Processed', value: '24', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Pending Review', value: '3', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { label: 'Total Uploads', value: '128', icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const recentDocs = [
    { title: 'Employment Contract - TechCorp', status: 'Completed', date: '2 hours ago' },
    { title: 'Lease Agreement 2024', status: 'Processing', date: '5 mins ago' },
    { title: 'NDA - Startup Inc', status: 'Completed', date: 'Yesterday' },
  ];

  return (
    <div className="app-container py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

      {/* Recent Documents */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
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
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                doc.status === 'Completed' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {doc.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
