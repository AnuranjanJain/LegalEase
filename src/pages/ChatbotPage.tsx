import { Send, User, Bot, Paperclip, X, FileText, Sparkles, RefreshCcw, PlusCircle, Trash2, History, Copy, Check, ShieldCheck, Download, GitCompare, Layers, MessageSquare, Search, Pencil, ChevronLeft, ChevronRight, BookOpen, ChevronDown } from 'lucide-react';
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      text: input,
      sender: 'user' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
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
          { message: currentInput, context: uploadedDoc?.text },
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
      const errorMessage = {
        id: messages.length + 2,
        text: error instanceof Error ? error.message : "Sorry, I'm having trouble connecting to the server. Please ensure the backend is running.",
        sender: 'bot' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await api.upload<{ filename: string; text: string }>('/upload', formData);
      setUploadedDoc({ name: data.filename, text: data.text });

      const systemMsg: Message = {
        id: Date.now(),
        text: `Successfully uploaded ${data.filename}. I now have context of this document.`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSummarize = async () => {
    if (!uploadedDoc) return;

    setIsTyping(true);
    try {
      const data = await api.post<{ summary: string }>('/summarize', { text: uploadedDoc.text });
      const summaryMsg: Message = {
        id: Date.now(),
        text: `Summary of ${uploadedDoc.name}:\n\n${data.summary}`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, summaryMsg]);
    } catch (error) {
      console.error('Summarization failed:', error);
    } finally {
      setIsTyping(false);
    }
  };
  const handleCopy = async (text: string, id: number) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);

    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  } catch (error) {
    console.error('Copy failed:', error);
  }
};

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: Message) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.sender === 'user' ? 'bg-primary text-white ml-2' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mr-2'}`}>
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`relative p-3 rounded-lg shadow-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700'}`}>

  {msg.sender === 'bot' && (
    <button
      onClick={() => handleCopy(msg.text, msg.id)}
      className="absolute top-2 right-2 p-1 rounded-md bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all duration-200"
      title="Copy text"
    >
      {copiedId === msg.id ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <Copy size={14} />
      )}
    </button>
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

      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800">
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
              <button
                onClick={() => setUploadedDoc(null)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Ask a legal question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
