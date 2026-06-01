import { useState } from 'react';
import { api } from '../services/api';

type Suggestion = {
  section: string;
  title: string;
  summary: string;
  severity: string;
  matched_keywords?: string[];
  confidence?: number;
};

interface Props {
  description: string;
  onSelect?: (s: Suggestion) => void;
}

export default function LegalMapping({ description, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setError(null);
    if (!description || !description.trim()) {
      setError('Enter a brief problem description to get suggestions.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ suggestions: Suggestion[] }>('/legal/map', { description });
      setSuggestions(res.suggestions || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Suggest IPC/BNS Sections</div>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-primary text-white disabled:opacity-50"
        >
          {loading ? 'Suggesting…' : 'Suggest Sections'}
        </button>
      </div>

      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{s.section} — {s.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.summary}</div>
                </div>
                <div className="ml-4 flex flex-col items-end">
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{s.severity}</div>
                  <button
                    onClick={() => onSelect && onSelect(s)}
                    className="mt-2 text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                  >
                    Insert
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
