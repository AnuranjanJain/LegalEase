import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input/textarea (unless it's the exact shortcut meant for them)
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';

      // Cmd/Ctrl + / : Focus Search
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        navigate('/documents');
        // Give time for navigation, then focus the search input
        setTimeout(() => {
          const searchInput = document.getElementById('global-search-input');
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
      }

      // Cmd/Ctrl + U : Open Upload
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'u') {
        if (!isInputFocused) {
          e.preventDefault();
          navigate('/documents');
          setTimeout(() => {
            const uploadTrigger = document.getElementById('global-upload-trigger');
            if (uploadTrigger) {
              uploadTrigger.click();
            }
          }, 100);
        }
      }

      // Cmd/Ctrl + D : Go to Dashboard
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        // Prevent default browser bookmark shortcut
        e.preventDefault();
        navigate('/dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
