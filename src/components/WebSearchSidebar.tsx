import { useState } from 'react';
import { Search, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export function WebSearchSidebar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WebSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await api.post('/api/legal/web-search', { query, max_results: 5 });
      setResults(response.results || []);
    } catch (error) {
      console.error('Web search failed', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full shadow-lg">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Search size={16} className="text-primary-600 dark:text-primary-400" />
          Legal Web Search
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Augment AI insights with live legal context
        </p>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search statutes, case law..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-950 border border-transparent focus:border-primary-500 rounded-lg text-sm transition-all text-gray-900 dark:text-white"
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <button type="submit" className="hidden">Search</button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 space-y-3">
            <Loader2 className="animate-spin text-primary-500" size={24} />
            <p className="text-xs text-gray-500 dark:text-gray-400">Searching web resources...</p>
          </div>
        ) : results.length > 0 ? (
          results.map((result, idx) => (
            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-primary-500/30 transition-all group">
              <a 
                href={result.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-sm text-primary-600 dark:text-primary-400 group-hover:underline flex items-start gap-1"
              >
                <span className="line-clamp-2">{result.title}</span>
                <ExternalLink size={12} className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                {result.snippet}
              </p>
              <div className="mt-2 text-[10px] text-gray-400 truncate">
                {new URL(result.url).hostname}
              </div>
            </div>
          ))
        ) : hasSearched ? (
          <div className="text-center text-sm text-gray-500 py-8">
            No results found for "{query}".
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500 py-8">
            Enter a query above to search live web context.
          </div>
        )}
      </div>
    </div>
  );
}
