import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react';

interface FeedbackWidgetProps {
  responseType: 'chatbot' | 'summary' | 'simplify' | 'compare';
}

const CATEGORIES = [
  'Incorrect summary',
  'Missing important clause',
  'Misleading explanation',
  'Poor comparison result',
  'Irrelevant chatbot answer',
  'Other'
];

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ responseType }) => {
  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (selectedRating: 'thumbs_up' | 'thumbs_down', submitCategory?: string, submitMessage?: string) => {
    try {
      setIsSubmitting(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          response_type: responseType,
          rating: selectedRating,
          category: submitCategory || category || null,
          message: submitMessage || message || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsUp = () => {
    if (submitted) return;
    setRating('thumbs_up');
    handleSubmit('thumbs_up');
  };

  const handleThumbsDown = () => {
    if (submitted) return;
    setRating('thumbs_down');
    setExpanded(true);
  };

  const handleDetailedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit('thumbs_down', category, message);
  };

  if (submitted) {
    return (
      <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400 mt-2">
        <CheckCircle2 size={16} />
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col items-start space-y-3">
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Was this response helpful?</span>
        <button
          onClick={handleThumbsUp}
          disabled={isSubmitting}
          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            rating === 'thumbs_up' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
          }`}
          aria-label="Thumbs up"
        >
          <ThumbsUp size={16} className={rating === 'thumbs_up' ? 'fill-current' : ''} />
        </button>
        <button
          onClick={handleThumbsDown}
          disabled={isSubmitting}
          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            rating === 'thumbs_down' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
          }`}
          aria-label="Thumbs down"
        >
          <ThumbsDown size={16} className={rating === 'thumbs_down' ? 'fill-current' : ''} />
        </button>
      </div>

      {expanded && !submitted && (
        <form onSubmit={handleDetailedSubmit} className="w-full max-w-md bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-md p-3 shadow-sm space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              What went wrong? (Optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional details (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Tell us more about the issue..."
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setRating(null);
              }}
              className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
