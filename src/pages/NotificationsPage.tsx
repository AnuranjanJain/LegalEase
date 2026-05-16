import { Bell, Trash2, CheckCircle } from 'lucide-react';

export function NotificationsPage() {
  const notifications = [
    {
      id: 1,
      title: 'Document Processed',
      message: 'Your contract_2024.pdf has been successfully processed.',
      timestamp: '2 hours ago',
      read: false,
      type: 'success',
    },
    {
      id: 2,
      title: 'New Message',
      message: 'You have a new message from Legal Assistant.',
      timestamp: '5 hours ago',
      read: false,
      type: 'info',
    },
    {
      id: 3,
      title: 'Dashboard Update',
      message: 'Your dashboard has been updated with new analytics.',
      timestamp: '1 day ago',
      read: true,
      type: 'info',
    },
    {
      id: 4,
      title: 'Processing Complete',
      message: 'All your documents have been processed successfully.',
      timestamp: '2 days ago',
      read: true,
      type: 'success',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="app-container max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={32} className="text-primary" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Stay updated with your latest alerts and messages</p>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                notification.read
                  ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                {notification.type === 'success' ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : (
                  <Bell size={20} className="text-blue-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold ${notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white font-bold'}`}>
                  {notification.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{notification.message}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{notification.timestamp}</p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                )}
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  aria-label="Delete notification"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {notifications.length === 0 && (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
