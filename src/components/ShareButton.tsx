import { Document } from '../services/storage';

interface ShareButtonProps {
  document: Document;
  onShare: (doc: Document) => void;
  /** 'icon' = icon-only button (for table rows), 'full' = icon + label (for cards) */
  variant?: 'icon' | 'full';
  className?: string;
}

/**
 * Reusable WhatsApp share trigger button.
 * Calls onShare with the target document when clicked.
 */
export function ShareButton({
  document: doc,
  onShare,
  variant = 'icon',
  className = '',
}: ShareButtonProps) {
  const isDisabled = doc.status === 'processing';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card navigation
    if (!isDisabled) onShare(doc);
  };

  if (variant === 'full') {
    return (
      <button
        id={`share-btn-${doc.id}`}
        onClick={handleClick}
        disabled={isDisabled}
        title={isDisabled ? 'Analysis still in progress' : 'Share on WhatsApp'}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold
          border transition-all duration-200 group/share
          ${isDisabled
            ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-800 text-gray-400'
            : 'border-[#25D366]/40 text-[#25D366] bg-[#25D366]/5 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] hover:shadow-md hover:shadow-[#25D366]/20 hover:scale-[1.03] active:scale-[0.97]'
          } ${className}`}
        aria-label={`Share ${doc.name} on WhatsApp`}
      >
        {/* WhatsApp SVG */}
        <svg viewBox="0 0 32 32" className="w-3.5 h-3.5 flex-shrink-0" fill="none">
          <path
            d="M16 2C8.268 2 2 8.268 2 16c0 2.47.67 4.78 1.836 6.76L2 30l7.44-1.804A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z"
            fill="currentColor"
          />
          <path
            d="M22.5 19.5c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.62.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35z"
            fill="white"
          />
        </svg>
        Share
      </button>
    );
  }

  // icon-only variant
  return (
    <button
      id={`share-icon-${doc.id}`}
      onClick={handleClick}
      disabled={isDisabled}
      title={isDisabled ? 'Analysis still in progress' : 'Share on WhatsApp'}
      className={`p-2 rounded-lg transition-all duration-200
        ${isDisabled
          ? 'opacity-40 cursor-not-allowed text-gray-300 dark:text-gray-600'
          : 'text-gray-400 hover:text-[#25D366] hover:bg-[#25D366]/10 hover:scale-110 active:scale-95'
        } ${className}`}
      aria-label={`Share ${doc.name} on WhatsApp`}
    >
      <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none">
        <path
          d="M16 2C8.268 2 2 8.268 2 16c0 2.47.67 4.78 1.836 6.76L2 30l7.44-1.804A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z"
          fill="currentColor"
        />
        <path
          d="M22.5 19.5c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.62.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35z"
          fill="white"
        />
      </svg>
    </button>
  );
}
