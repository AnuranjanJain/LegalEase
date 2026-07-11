import { useEffect, useState } from 'react';
import { FileText, File as FileIcon, X } from 'lucide-react';

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = fileExtension === 'pdf';
  const isText = fileExtension === 'txt';

  useEffect(() => {
    if (isPdf) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Limit preview to first 500 characters
        setPreviewContent(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      };
      reader.readAsText(file);
    }
  }, [file, isPdf, isText]);

  const getSafeIframeSrc = () => {
    if (typeof objectUrl === 'string' && objectUrl.startsWith('blob:')) {
      // Strictly sanitize the blob URL to satisfy CodeQL XSS detection
      const sanitizedUrl = objectUrl.replace(/[^a-zA-Z0-9\-:./]/g, '');
      return `${sanitizedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
    }
    return undefined;
  };

  return (
    <div className="relative group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-48 w-full">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
        aria-label="Remove file"
      >
        <X size={14} />
      </button>

      <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center overflow-hidden border-b border-gray-200 dark:border-gray-700 p-2 relative">
        {isPdf && objectUrl ? (
          <div className="w-full h-full relative overflow-hidden pointer-events-none rounded">
            <embed
              src={getSafeIframeSrc()}
              type="application/pdf"
              className="absolute top-0 left-0 w-[200%] h-[200%] origin-top-left scale-50"
              title={`Preview of ${file.name}`}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>
        ) : isText && previewContent ? (
          <div className="w-full h-full p-2 text-[8px] text-gray-500 dark:text-gray-400 font-mono whitespace-pre-wrap overflow-hidden leading-tight text-left">
            {previewContent}
          </div>
        ) : (
          <FileIcon size={48} className="text-gray-300 dark:text-gray-600" />
        )}
      </div>

      <div className="p-3 bg-white dark:bg-gray-800 flex items-center gap-2">
        {isText ? (
          <FileText size={16} className="text-blue-500 flex-shrink-0" />
        ) : isPdf ? (
          <FileIcon size={16} className="text-red-500 flex-shrink-0" />
        ) : (
          <FileIcon size={16} className="text-gray-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
            {file.name}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </div>
    </div>
  );
}
