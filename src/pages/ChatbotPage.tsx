import { Send, User, Bot, Paperclip, X, FileText, Sparkles, RefreshCcw, PlusCircle, Trash2, History, Copy, Check, ShieldCheck, Download, GitCompare, Layers, MessageSquare, Search, Pencil, ChevronLeft, ChevronRight, BookOpen, ChevronDown, Globe, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { ChatStorageService, ChatMessage, ChatSessionMetadata } from '../services/storage';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import LegalMapping from '../components/LegalMapping';
import { WebSearchSidebar } from '../components/WebSearchSidebar';
import { useRedaction } from '../contexts/RedactionContext';
import { redact } from '../utils/redaction';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { JURISDICTIONS } from '../config/jurisdictions';

function makeGreeting(): ChatMessage {
  return {
    id: 'default-greeting',
    text: "Hello! I'm LegalEase AI. How can I help you understand your legal documents today?",
    sender: 'bot',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date().toISOString(),
  };
}

const MAX_CONTEXT_MESSAGES = 10;
const MAX_INPUT_CHARS = 2000; // NEW: Character limit constant added here

function buildConversationHistory(msgs: ChatMessage[]) {
  return msgs
    .filter(m => m.id !== 'default-greeting')
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
}

type Citation = { text: string; source: string; chunk_index: number };

export function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([makeGreeting()]);
  const [messageCitations] = useState<Record<string, Citation[]>>({});
  const [openCitationId, setOpenCitationId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionMetadata[]>([]);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSessions, setShowSessions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [messageBranches, setMessageBranches] = useState<Record<string, Array<{ userText: string, botText: string }>>>({});
  const [branchIdx, setBranchIdx] = useState<Record<string, number>>({});

  const [isExporting, setIsExporting] = useState(false);

  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('General / Not Specified');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Multi-document comparison context.
   * Populated when the user navigates here from a multi-doc comparison session
   * created in DocumentsPage. When set, the chat sends `documentIds` to the
   * comparison endpoint instead of `context` to the regular chat endpoint.
   * Mutually exclusive with `uploadedDoc` for a given session.
   */
  const [multiDocContext, setMultiDocContext] = useState<Array<{ id: string; name: string; text: string }> | null>(null);
  
  // State to track which message ID was copied to show the checkmark temporarily
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Announcement text for the aria-live region. Updated whenever the
  // redaction toggle changes so screen readers announce the state change.
  const [redactionAnnouncement, setRedactionAnnouncement] = useState('');

  const { showToast } = useToast();
  const { isRedactionEnabled, redactionStyle } = useRedaction();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Announce redaction state changes to screen readers via aria-live.
  // Skip the very first render (isFirstRender guard) so we don't announce
  // "PII redaction disabled" on page load when the default is already OFF.
  const isFirstRedactionRender = useRef(true);
  useEffect(() => {
    if (isFirstRedactionRender.current) {
      isFirstRedactionRender.current = false;
      return;
    }
    setRedactionAnnouncement(
      isRedactionEnabled
        ? 'PII redaction enabled. Sensitive data is now masked in AI responses.'
        : 'PII redaction disabled. Original AI responses are now shown.'
    );
    // Clear after a short delay so the same message can re-fire if the user
    // toggles rapidly, while not leaving stale text in the live region.
    const timer = setTimeout(() => setRedactionAnnouncement(''), 3000);
    return () => clearTimeout(timer);
  }, [isRedactionEnabled]);

  // ---------------------------------------------------------------------------
  // Clipboard handler.
  //
  // Receives the already-computed displayText (the text currently visible to
  // the user, possibly redacted) to avoid re-running redact() on click.
  // This ensures the copied text always exactly matches what is on screen.
  // ---------------------------------------------------------------------------
  const handleCopy = (displayText: string, id: string) => {
    navigator.clipboard.writeText(displayText);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    ChatStorageService.migrateOldChatHistory();
    const savedId = ChatStorageService.getActiveSessionId();
    const allSessions = ChatStorageService.getSessions();
    setSessions(allSessions);

    if (savedId) {
      const sessionData = ChatStorageService.getSession(savedId);
      if (sessionData) {
        setActiveSessionId(savedId);
        setMessages(sessionData.messages.length > 0 ? sessionData.messages : [makeGreeting()]);
        setUploadedDoc(sessionData.documentContext ?? null);
        setMultiDocContext(sessionData.multiDocContext ?? null);
        setSelectedJurisdiction(sessionData.jurisdiction ?? localStorage.getItem('le_selected_jurisdiction') ?? 'General / Not Specified');
        return;
      }
    }

    const newSession = ChatStorageService.createSession('New Conversation');
    setActiveSessionId(newSession.id);
    setSessions(ChatStorageService.getSessions());
    setMessages([makeGreeting()]);
    setSelectedJurisdiction(newSession.jurisdiction ?? localStorage.getItem('le_selected_jurisdiction') ?? 'General / Not Specified');
  }, []);

  const persistSession = useCallback((msgs: ChatMessage[], docCtx: typeof uploadedDoc, sessionId: string | null, multiCtx: typeof multiDocContext, jur: string) => {
    if (!sessionId) return;
    const firstUser = msgs.find(m => m.sender === 'user');
    const title = firstUser
      ? firstUser.text.substring(0, 50) + (firstUser.text.length > 50 ? '...' : '')
      : 'New Conversation';
    ChatStorageService.saveSession({
      id: sessionId,
      title,
      messages: msgs,
      jurisdiction: jur,
      documentContext: docCtx ?? undefined,
      multiDocContext: multiCtx ?? undefined,
    });
    setSessions(ChatStorageService.getSessions());
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      persistSession(messages, uploadedDoc, activeSessionId, multiDocContext, selectedJurisdiction);
    }
  }, [messages, uploadedDoc, multiDocContext, activeSessionId, selectedJurisdiction, persistSession]);

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsDropdownOpen(prev => {
      const next = !prev;
      if (next) {
        setSearchQuery('');
        setFocusedOptionIndex(-1);
      }
      return next;
    });
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isDropdownOpen]);

  const handleSelectJurisdiction = (j: string) => {
    setSelectedJurisdiction(j);
    localStorage.setItem('le_selected_jurisdiction', j);
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
  };

  const jurisdictionsList = Object.values(JURISDICTIONS);
  const filteredJurisdictions = jurisdictionsList.filter(j =>
    j.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsDropdownOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedOptionIndex(prev => 
          prev < filteredJurisdictions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedOptionIndex(prev => 
          prev > 0 ? prev - 1 : filteredJurisdictions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedOptionIndex >= 0 && focusedOptionIndex < filteredJurisdictions.length) {
          handleSelectJurisdiction(filteredJurisdictions[focusedOptionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsDropdownOpen(false);
        break;
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleNewConversation = () => {
    const newSession = ChatStorageService.createSession('New Conversation');
    setActiveSessionId(newSession.id);
    setMessages([makeGreeting()]);
    setUploadedDoc(null);
    setMultiDocContext(null);
    setSelectedJurisdiction(newSession.jurisdiction ?? localStorage.getItem('le_selected_jurisdiction') ?? 'General / Not Specified');
    setSessions(ChatStorageService.getSessions());
    setShowSessions(false);
  };

  const handleSwitchSession = (id: string) => {
    const sessionData = ChatStorageService.getSession(id);
    if (!sessionData) return;
    ChatStorageService.setActiveSessionId(id);
    setActiveSessionId(id);
    setMessages(sessionData.messages.length > 0 ? sessionData.messages : [makeGreeting()]);
    setUploadedDoc(sessionData.documentContext ?? null);
    setMultiDocContext(sessionData.multiDocContext ?? null);
    setSelectedJurisdiction(sessionData.jurisdiction ?? localStorage.getItem('le_selected_jurisdiction') ?? 'General / Not Specified');
    setShowSessions(false);
  };

  const handleDeleteSession = (id: string) => {
    ChatStorageService.deleteSession(id);
    const remaining = ChatStorageService.getSessions();
    setSessions(remaining);

    if (id === activeSessionId) {
      if (remaining.length > 0) {
        handleSwitchSession(remaining[0].id);
      } else {
        handleNewConversation();
      }
    }
  };

  const handleClearConversation = () => {
    const freshGreeting = makeGreeting();
    setMessages([freshGreeting]);
    setUploadedDoc(null);
    setMultiDocContext(null);

    if (activeSessionId) {
      ChatStorageService.saveSession({
        id: activeSessionId,
        title: 'New Conversation',
        messages: [freshGreeting],
        jurisdiction: selectedJurisdiction,
        documentContext: undefined,
        multiDocContext: undefined,
      });
      setSessions(ChatStorageService.getSessions());
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: input,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const conversationHistory = buildConversationHistory(updatedMessages);
      const botId = crypto.randomUUID();
      const botMessage: ChatMessage = {
        id: botId,
        text: '',
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);

      // ---------------------------------------------------------------------------
      // Route selection:
      //   - Multi-doc comparison session → POST /compare/chat (structured response)
      //   - Single-doc or no-doc session  → POST /chat (streaming)
      // ---------------------------------------------------------------------------
      if (multiDocContext && multiDocContext.length >= 2) {
        const data = await api.post<{ response: string }>(
          '/compare/chat',
          {
            message: currentInput,
            document_ids: multiDocContext.map(d => d.id),
            document_texts: multiDocContext.map(d => ({ id: d.id, name: d.name, text: d.text })),
            conversation_history: conversationHistory,
            jurisdiction: selectedJurisdiction,
          }
        );
        setMessages(prev =>
          prev.map(msg =>
            msg.id === botId
              ? { ...msg, text: data.response || "I couldn't generate a comparison for those documents." }
              : msg
          )
        );
      } else {
        // Standard single-doc streaming path
        const response = await api.stream(
          '/chat',
          { message: currentInput, context: uploadedDoc?.text, jurisdiction: selectedJurisdiction },
          conversationHistory
        );

        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');

        if (reader) {
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6);
                  if (dataStr === '[DONE]') {
                    done = true;
                    break;
                  }
                  try {
                    const data = JSON.parse(dataStr);
                    if (data.response) {
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === botId
                            ? { ...msg, text: msg.text + data.response }
                            : msg
                        )
                      );
                    }
                  } catch (e) {
                    // Ignore incomplete JSON chunks
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message. Please try again.', 'error');
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        text: error instanceof Error
          ? error.message
          : "Sorry, I'm having trouble connecting to the server. Please ensure the backend is running.",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  
  const handleEditSubmit = async (msgId: string) => {
    if (!editText.trim()) {
      setEditingId(null);
      return;
    }
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;

    setIsTyping(true);
    try {
      const historyUntilEdit = buildConversationHistory(messages.slice(0, idx));
      const res = await api.put<{ message_id: string; edited_content: string; response: string }>(
        `/chat/messages/${msgId}`,
        {
          new_content: editText,
          conversation_history: historyUntilEdit,
          context: uploadedDoc?.text
        }
      );

      const newUserMsg = { ...messages[idx], text: res.edited_content };
      const newBotMsgId = crypto.randomUUID();
      const newBotMsg: ChatMessage = {
        id: newBotMsgId,
        text: res.response,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString()
      };

      setMessageBranches(prev => ({
        ...prev,
        [msgId]: [...(prev[msgId] || [{ userText: messages[idx].text, botText: messages[idx + 1]?.text || '' }]), { userText: res.edited_content, botText: res.response }]
      }));
      setBranchIdx(prev => ({ ...prev, [msgId]: (messageBranches[msgId]?.length ?? 1) }));
      // Replace edited msg + its following bot msg
      const updated = [...messages.slice(0, idx), newUserMsg, newBotMsg, ...messages.slice(idx + 2)];
      setMessages(updated);
    } catch (err) {
      showToast('Failed to edit message.', 'error');
    } finally {
      setIsTyping(false);
      setEditingId(null);
      setEditText('');
    }
  };

  const handleBranchNav = (msgId: string, dir: 1 | -1) => {
    const branches = messageBranches[msgId];
    if (!branches) return;
    const currentIdx = branchIdx[msgId] ?? 0;
    const newIdx = Math.max(0, Math.min(branches.length - 1, currentIdx + dir));
    setBranchIdx(prev => ({ ...prev, [msgId]: newIdx }));
    const branch = branches[newIdx];
    const msgIdx = messages.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;
    const updatedUser: ChatMessage = { ...messages[msgIdx], text: branch.userText };
    const updatedBot: ChatMessage = { ...messages[msgIdx + 1], text: branch.botText };
    setMessages(prev => [...prev.slice(0, msgIdx), updatedUser, updatedBot, ...prev.slice(msgIdx + 2)]);
  };

  const handleExportPDF = async () => {
    const chatMessages = messages
      .filter(m => m.id !== 'default-greeting')
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    if (chatMessages.length === 0) {
      showToast('No chat history available to export.', 'warning');
      return;
    }

    setIsExporting(true);
    showToast('Generating PDF chat transcript...', 'info');

    try {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const title = activeSession?.title ? `Chat History: ${activeSession.title}` : 'AI Chat History';

      const blob = await api.postBlob('/api/export/pdf', {
        title,
        chatHistory: chatMessages
      });

      const today = new Date().toISOString().split('T')[0];
      const filename = `chat-history-${today}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('PDF chat transcript exported successfully!', 'success');
    } catch (err) {
      console.error('Failed to export chat transcript:', err);
      showToast(err instanceof Error ? err.message : 'Failed to export PDF.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast(`Uploading "${file.name}"...`, 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // POST upload — backend returns 202 + task_id immediately (#365)
      const initial = await api.upload<{ task_id: string; filename: string; status: string }>(
        '/upload', formData
      );
      const taskId = initial.task_id;
      const filename = initial.filename;

      // Poll /upload/status/:task_id until done or failed
      let progress = 0;
      while (true) {
        await new Promise(r => setTimeout(r, 1500));
        const status = await api.get<{ status: string; progress: number; result: { filename: string; text: string } | null }>(
          `/upload/status/${taskId}`
        );
        progress = status.progress;

        // Update progress toast label via state
        setUploadProgress(progress);

        if (status.status === 'done' && status.result) {
          setUploadedDoc({ name: status.result.filename, text: status.result.text });
          showToast(`Document "${filename}" context integrated successfully!`, 'success');
          const systemMsg: ChatMessage = {
            id: crypto.randomUUID(),
            text: `Successfully uploaded ${filename}. I now have context of this document.`,
            sender: 'bot',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, systemMsg]);
          break;
        }
        if (status.status === 'failed') {
          showToast('Failed to process document.', 'error');
          break;
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('Failed to process document context.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleSummarize = async () => {
    if (!uploadedDoc) return;

    setIsTyping(true);
    showToast('Analyzing and compiling summary...', 'info');
    try {
      const data = await api.post<{ summary: string }>('/summarize', { text: uploadedDoc.text });
      const summaryMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: `Summary of ${uploadedDoc.name}:\n\n${data.summary}`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, summaryMsg]);
      showToast('Summary compiled successfully!', 'success');
    } catch (error) {
      console.error('Summarization failed:', error);
      showToast('Failed to extract document summary.', 'error');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 relative overflow-hidden">

      {/* Session panel */}
      {showSessions && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg max-h-64 overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conversations</span>
            <button onClick={() => setShowSessions(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X size={16} />
            </button>
          </div>
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400 px-4 py-3">No saved conversations.</p>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${session.id === activeSessionId ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
              onClick={() => handleSwitchSession(session.id)}
            >
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{session.title}</p>
                <p className="text-xs text-gray-400">{session.messageCount} messages · {new Date(session.updatedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteSession(session.id); }}
                className="ml-2 flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare size={24} className="text-primary-600 dark:text-primary-400" />
          Legal Assistant
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWebSearch(!showWebSearch)}
            className={`p-2 rounded-lg transition-colors ${showWebSearch ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            title="Toggle Web Search Context"
          >
            <Search size={20} />
          </button>
        </div>
      </header>

      {/* Sub-header with Jurisdiction Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-10 flex-shrink-0 animate-fade-in">
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            <span>Legal Chat Sandbox</span>
          </h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            {multiDocContext && multiDocContext.length >= 2 
              ? `Comparing ${multiDocContext.length} documents` 
              : uploadedDoc 
                ? `Analyzing: ${uploadedDoc.name}` 
                : 'General conversation Mode'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Warning Badge */}
          {selectedJurisdiction === 'General / Not Specified' && (
            <div 
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 animate-pulse shadow-sm"
              role="alert"
            >
              <AlertTriangle size={14} className="flex-shrink-0 text-amber-500" />
              <span>Responses may not reflect jurisdiction-specific legal requirements.</span>
            </div>
          )}

          {/* Searchable Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label id="jurisdiction-label" className="sr-only">Choose Legal Jurisdiction</label>
            <button
              ref={triggerRef}
              role="combobox"
              onClick={toggleDropdown}
              onKeyDown={handleKeyDown}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-labelledby="jurisdiction-label"
              aria-controls="jurisdiction-menu"
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-250 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
            >
              <span className="truncate">{selectedJurisdiction}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {isDropdownOpen && (
              <div 
                id="jurisdiction-menu"
                role="listbox"
                aria-labelledby="jurisdiction-label"
                className="absolute right-0 mt-2 w-[240px] rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-30 overflow-hidden animate-fade-in"
              >
                {/* Search Box */}
                <div className="flex items-center gap-2 p-2 border-b border-gray-100 dark:border-gray-750 bg-gray-50 dark:bg-gray-900">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search jurisdiction..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFocusedOptionIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Options List */}
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredJurisdictions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">No jurisdictions found</div>
                  ) : (
                    filteredJurisdictions.map((j, idx) => {
                      const isSelected = j === selectedJurisdiction;
                      const isFocused = idx === focusedOptionIndex;
                      return (
                        <div
                          key={j}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectJurisdiction(j)}
                          className={`flex items-center justify-between px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-400' 
                              : isFocused 
                                ? 'bg-gray-150 dark:bg-gray-700 text-gray-900 dark:text-white' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                          }`}
                        >
                          <span className="truncate">{j}</span>
                          {isSelected && <span className="w-1.5 h-1.5 bg-primary rounded-full animate-fade-in" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Web Search Sidebar (Slide-in) */}
        <div className={`transition-all duration-300 overflow-hidden ${showWebSearch ? 'w-80' : 'w-0'}`}>
          {showWebSearch && <WebSearchSidebar />}
        </div>

        {/* Message list - takes remaining space */}
        <div className="flex-grow overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6 relative z-10 min-h-0">
          {messages.map((msg: ChatMessage) => {
            const isUser = msg.sender === 'user';
            const displayText =
              !isUser && isRedactionEnabled
                ? redact(msg.text, redactionStyle)
                : msg.text;

            return (
              <div 
                key={msg.id} 
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}
              >
                <div className={`flex items-start max-w-[85%] sm:max-w-[80%] gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Glowing Avatar Circles */}
                  <div className={`flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md ${
                    isUser 
                      ? 'bg-gradient-to-tr from-primary to-indigo-600 text-white' 
                      : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                  }`}>
                    {isUser ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  {/* Message Bubble Card */}
                  <div className={`p-3 sm:p-4 rounded-2xl shadow-sm text-left leading-relaxed relative group ${
                    isUser 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white/80 dark:bg-gray-900/60 backdrop-blur-md text-gray-900 dark:text-gray-150 rounded-tl-none border border-gray-150 dark:border-gray-800'
                  }`}>
                    
                    {/* Dedicated Copy Button for AI/Bot responses */}
                    {!isUser && (
                      <button 
                        onClick={() => handleCopy(displayText, msg.id)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-primary dark:hover:text-primary-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Copy to clipboard"
                        aria-label="Copy response text"
                      >
                        {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    )}

                    {/* Edit button for user messages */}
                    {isUser && editingId !== msg.id && (
                      <button
                        onClick={() => { setEditingId(msg.id); setEditText(msg.text); }}
                        className="absolute top-2 left-2 p-1 text-blue-200 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit message"
                      >
                        <Pencil size={13} />
                      </button>
                    )}

                    {/* Inline edit textarea */}
                    {isUser && editingId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full p-2 rounded-lg text-sm text-gray-900 bg-white/90 border border-white/60 resize-none focus:outline-none"
                          rows={3}
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="text-xs text-blue-200 hover:text-white">Cancel</button>
                          <button onClick={() => handleEditSubmit(msg.id)} className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg font-semibold">Send</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm font-medium whitespace-pre-wrap pr-4 markdown-body">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]} 
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            table: ({node, ...props}) => <table className="border-collapse table-auto w-full text-sm my-2 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden" {...props} />,
                            th: ({node, ...props}) => <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-left font-bold" {...props} />,
                            td: ({node, ...props}) => <td className="border border-gray-300 dark:border-gray-600 px-4 py-2" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-500 pl-4 italic text-gray-600 dark:text-gray-400 my-2" {...props} />,
                            a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />
                          }}
                        >
                          {displayText}
                        </ReactMarkdown>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className={`text-[9px] font-semibold ${isUser ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {msg.time}
                      </p>
                      {/* Branch navigator shown on user messages that have been edited */}
                      {isUser && messageBranches[msg.id] && messageBranches[msg.id].length > 1 && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleBranchNav(msg.id, -1)} disabled={(branchIdx[msg.id] ?? 0) === 0} className="text-blue-200 disabled:opacity-30 hover:text-white">
                            <ChevronLeft size={12} />
                          </button>
                          <span className="text-[9px] text-blue-200 font-bold">
                            {(branchIdx[msg.id] ?? 0) + 1} / {messageBranches[msg.id].length}
                          </span>
                          <button onClick={() => handleBranchNav(msg.id, 1)} disabled={(branchIdx[msg.id] ?? 0) >= messageBranches[msg.id].length - 1} className="text-blue-200 disabled:opacity-30 hover:text-white">
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Citation panel for bot messages */}
                    {!isUser && messageCitations[msg.id] && messageCitations[msg.id].length > 0 && (
                      <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                        <button
                          onClick={() => setOpenCitationId(openCitationId === msg.id ? null : msg.id)}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                          <BookOpen size={11} />
                          {messageCitations[msg.id].length} Source{messageCitations[msg.id].length > 1 ? 's' : ''}
                          <ChevronDown size={11} className={`transition-transform ${openCitationId === msg.id ? 'rotate-180' : ''}`} />
                        </button>
                        {openCitationId === msg.id && (
                          <div className="mt-2 space-y-2">
                            {messageCitations[msg.id].map((c, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <p className="text-[9px] font-bold text-primary mb-1 flex items-center gap-1">
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[8px] font-black">{idx + 1}</span>
                                  {c.source} — chunk {c.chunk_index + 1}
                                </p>
                                <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}

          {/* Typing Loading Indicator */}
          {isTyping && (
            <div className="flex justify-start animate-pulse">
              <div className="flex items-start max-w-[80%] gap-3">
                <div className="flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
                  <Bot size={16} />
                </div>
                <div className="p-4 rounded-2xl bg-white/80 dark:bg-gray-900/60 backdrop-blur-md text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-150 dark:border-gray-800">
                  <div className="flex gap-1.5 items-center py-1">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce delay-150"></span>
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce delay-300"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Screen reader live region — announces both AI typing state and
          PII redaction toggle changes (aria-atomic ensures the full message
          is read rather than just the changed portion). */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {redactionAnnouncement || (isTyping ? 'LegalEase AI is writing an answer...' : '')}
      </div>

      <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        {/* PII Redaction active indicator */}
        {isRedactionEnabled && (
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={12} />
            <span>PII Redaction active — sensitive data masked in AI responses</span>
          </div>
        )}
        {isUploading && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-primary">Processing document...</span>
              <span className="text-xs font-bold text-primary">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${uploadProgress || 10}%` }}
              />
            </div>
          </div>
        )}
        {uploadedDoc && (
          <div className="mb-3 flex items-center justify-between bg-primary/5 dark:bg-primary/10 p-2 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText size={16} className="text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{uploadedDoc.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSummarize}
                className="text-xs flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors"
              >
                <Sparkles size={12} />
                Summarize
              </button>
              <button onClick={() => setUploadedDoc(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Multi-document comparison context banner */}
        {multiDocContext && multiDocContext.length >= 2 && (
          <div className="mb-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GitCompare size={14} className="text-indigo-500 flex-shrink-0" />
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Comparison Mode — {multiDocContext.length} documents
                </span>
              </div>
              <button
                onClick={() => setMultiDocContext(null)}
                className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                aria-label="Exit comparison mode"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {multiDocContext.map(doc => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium
                             bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300
                             border border-indigo-200 dark:border-indigo-700/50 max-w-[200px]"
                >
                  <Layers size={9} />
                  <span className="truncate">{doc.name}</span>
                </span>
              ))}
            </div>
            <p className="text-[10px] text-indigo-500/70 dark:text-indigo-400/60 mt-2">
              Ask questions like "Compare termination clauses" or "Find conflicting obligations"
            </p>
          </div>
        )}

        <LegalMapping description={input} onSelect={(s) => setInput(prev => (prev ? prev + '\n\n' + `${s.section} — ${s.title}: ${s.summary}` : `${s.section} — ${s.title}: ${s.summary}`))} />

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.docx,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hover:scale-105 hover:-translate-y-0.5 transition-all duration-200 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Attach Document"
          >
            {isUploading ? <RefreshCcw size={20} className="animate-spin" /> : <Paperclip size={20} />}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="p-2 text-gray-400 hover:text-primary dark:hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Export to PDF"
          >
            {isExporting ? <RefreshCcw size={20} className="animate-spin" /> : <Download size={20} />}
          </button>

          <button
            onClick={() => setShowSessions(prev => !prev)}
            className={`p-2 transition-colors ${showSessions ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            title="Conversation history"
          >
            <History size={20} />
          </button>

          <button
            onClick={handleNewConversation}
            className="p-2 text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            title="New conversation"
          >
            <PlusCircle size={20} />
          </button>

          <button
            onClick={handleClearConversation}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors hidden sm:block"
            title="Clear conversation"
          >
            <Trash2 size={20} />
          </button>

          <div className="flex-1 relative min-w-0">
            {/* Dynamic Context Badge Indicator */}
            {uploadedDoc && (
              <span 
                className="absolute right-3 top-2.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-green-200 dark:border-green-800/50 animate-pulse z-10"
                role="status"
              >
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Active Document Context
              </span>
            )}

            {/* Accessible Multi-line Text Area for Enter / Shift+Enter management WITH COUNTER LIMIT */}
            <textarea
              className="w-full pl-4 pr-16 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none max-h-32 min-h-[40px] block align-bottom leading-normal"
              placeholder={multiDocContext ? "Compare clauses, find conflicts, ask about all documents..." : uploadedDoc ? "Ask about this document..." : "Ask a legal question..."}
              rows={1}
              maxLength={MAX_INPUT_CHARS}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isTyping) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            {/* Dynamic Character Counter */}
            <div 
              className={`absolute bottom-2 right-3 text-[10px] font-medium transition-colors duration-300 pointer-events-none ${
                input.length >= MAX_INPUT_CHARS ? 'text-red-500 animate-pulse' :
                input.length >= MAX_INPUT_CHARS * 0.9 ? 'text-orange-500' :
                'text-gray-400 dark:text-gray-500'
              }`}
            >
              {input.length} / {MAX_INPUT_CHARS}
            </div>
          </div>
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || input.length > MAX_INPUT_CHARS}
            className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}