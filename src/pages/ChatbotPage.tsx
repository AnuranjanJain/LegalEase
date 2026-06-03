import { Send, User, Bot, Paperclip, X, FileText, Sparkles, RefreshCcw, PlusCircle, Trash2, History, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ChatStorageService, ChatMessage, ChatSessionMetadata } from '../services/storage';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import LegalMapping from '../components/LegalMapping';

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

export function ChatbotPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([makeGreeting()]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionMetadata[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  
  // State to track which message ID was copied to show the checkmark temporarily
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clipboard handler
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000); // Revert back to copy icon after 2 seconds
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
        return;
      }
    }

    const newSession = ChatStorageService.createSession('New Conversation');
    setActiveSessionId(newSession.id);
    setSessions(ChatStorageService.getSessions());
    setMessages([makeGreeting()]);
  }, []);

  const persistSession = useCallback((msgs: ChatMessage[], docCtx: typeof uploadedDoc, sessionId: string | null) => {
    if (!sessionId) return;
    const firstUser = msgs.find(m => m.sender === 'user');
    const title = firstUser
      ? firstUser.text.substring(0, 50) + (firstUser.text.length > 50 ? '...' : '')
      : 'New Conversation';
    ChatStorageService.saveSession({
      id: sessionId,
      title,
      messages: msgs,
      documentContext: docCtx ?? undefined,
    });
    setSessions(ChatStorageService.getSessions());
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      persistSession(messages, uploadedDoc, activeSessionId);
    }
  }, [messages, uploadedDoc, activeSessionId, persistSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleNewConversation = () => {
    const newSession = ChatStorageService.createSession('New Conversation');
    setActiveSessionId(newSession.id);
    setMessages([makeGreeting()]);
    setUploadedDoc(null);
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

    if (activeSessionId) {
      ChatStorageService.saveSession({
        id: activeSessionId,
        title: 'New Conversation',
        messages: [freshGreeting],
        documentContext: undefined,
      });
      setSessions(ChatStorageService.getSessions());
    }
  };

  const handleSend = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }

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
      const data = await api.post<{ response: string }>(
        '/chat',
        { message: currentInput, context: uploadedDoc?.text },
        conversationHistory
      );

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        text: data.response || "I apologize, but I couldn't process that request.",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMessage]);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast(`Uploading "${file.name}" to AI sandbox...`, 'info');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await api.upload<{ filename: string; text: string }>('/upload', formData);
      setUploadedDoc({ name: data.filename, text: data.text });
      showToast(`Document "${data.filename}" context integrated successfully!`, 'success');

      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: `Successfully uploaded ${data.filename}. I now have context of this document.`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMsg]);
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('Failed to process document context.', 'error');
    } finally {
      setIsUploading(false);
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
    <div className="fixed bottom-6 right-6 z-50 w-[min(420px,95vw)] max-h-[90vh] rounded-[32px] border border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">LegalEase Chatbot</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ask legal questions anytime</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
          aria-label="Close chatbot"
        >
          <X size={16} />
        </button>
      </div>

      {/* Session panel */}
      {showSessions && (
        <div className="absolute top-16 left-0 right-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-md max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conversations</span>
            <button onClick={() => setShowSessions(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={16} />
            </button>
          </div>
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400 px-4 py-3">No saved conversations.</p>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${session.id === activeSessionId ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
              onClick={() => handleSwitchSession(session.id)}
            >
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{session.title}</p>
                <p className="text-xs text-gray-400">{session.messageCount} messages · {new Date(session.updatedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteSession(session.id); }}
                className="ml-2 flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 relative z-10">
        {messages.map((msg: ChatMessage) => {
          const isUser = msg.sender === 'user';
          
          return (
            <div 
              key={msg.id} 
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              <div className={`flex items-start max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Glowing Avatar Circles */}
                <div className={`flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center shadow-md ${
                  isUser 
                    ? 'bg-gradient-to-tr from-primary to-indigo-600 text-white' 
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                }`}>
                  {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* Message Bubble Card */}
                <div className={`p-4 rounded-2xl shadow-sm text-left leading-relaxed relative group ${
                  isUser 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white/80 dark:bg-gray-900/60 backdrop-blur-md text-gray-900 dark:text-gray-150 rounded-tl-none border border-gray-150 dark:border-gray-800'
                }`}>
                  
                  {/* Dedicated Copy Button for AI/Bot responses */}
                  {!isUser && (
                    <button 
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-primary dark:hover:text-primary-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Copy to clipboard"
                      aria-label="Copy response text"
                    >
                      {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  )}

                  <p className="text-sm font-medium whitespace-pre-wrap pr-4">{msg.text}</p>
                  <p className={`text-[9px] font-semibold mt-2 ${isUser ? 'text-blue-100 text-right' : 'text-gray-400 dark:text-gray-500'}`}>
                    {msg.time}
                  </p>
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

      {/* Screen reader live region for accessibility */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isTyping ? "LegalEase AI is writing an answer..." : ""}
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 sticky bottom-0 z-10">
        {uploadedDoc && (
          <div className="mb-3 flex items-center justify-between bg-primary/5 dark:bg-primary/10 p-2 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileText size={16} className="text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{uploadedDoc.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSummarize}
                className="text-xs flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors"
              >
                <Sparkles size={12} />
                Summarize
              </button>
              <button type="button" onClick={() => setUploadedDoc(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <LegalMapping description={input} onSelect={(s) => setInput(prev => (prev ? prev + '\n\n' + `${s.section} — ${s.title}: ${s.summary}` : `${s.section} — ${s.title}: ${s.summary}`))} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.docx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Attach Document"
            >
              {isUploading ? <RefreshCcw size={20} className="animate-spin" /> : <Paperclip size={20} />}
            </button>

            <button
              type="button"
              onClick={() => setShowSessions(prev => !prev)}
              className={`p-2 transition-colors ${showSessions ? 'text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title="Conversation history"
            >
              <History size={20} />
            </button>

            <button
              type="button"
              onClick={handleNewConversation}
              className="p-2 text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              title="New conversation"
            >
              <PlusCircle size={20} />
            </button>

            <button
              type="button"
              onClick={handleClearConversation}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors hidden sm:block"
              title="Clear conversation"
            >
              <Trash2 size={20} />
            </button>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 relative">
              {uploadedDoc && (
                <span 
                  className="absolute right-3 top-2.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-green-200 dark:border-green-800/50 animate-pulse z-10"
                  role="status"
                >
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Active Document Context
                </span>
              )}

              <textarea
                className="w-full pl-4 pr-36 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none max-h-40 min-h-[72px] block align-bottom leading-relaxed"
                placeholder={uploadedDoc ? "Ask about this document..." : "Ask a legal question..."}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isTyping) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </div>
            <button
              type="submit"
              aria-label="Send message"
              disabled={!input.trim() || isTyping}
              className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}