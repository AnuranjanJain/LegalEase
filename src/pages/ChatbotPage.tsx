import { Send, User, Bot, History, Paperclip, X, FileText, Sparkles, RefreshCcw, ShieldCheck, Info } from 'lucide-react';
import { api } from '../services/api';
import { useRef, useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  time: string;
}

const defaultMessages: Message[] = [
  {
    id: 1,
    text: "Hello! I'm LegalEase AI. How can I help you audit, simplify, or review your legal agreements today? Upload a contract to give me deep contextual alignment.",
    sender: 'bot',
    time: '10:00 AM'
  }
];

export function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const savedMessages = localStorage.getItem('chatHistory');
    return savedMessages ? JSON.parse(savedMessages) : defaultMessages;
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const now = Date.now();
    const userMessage: Message = {
      id: now,
      text: input,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const data = await api.post<{ response: string }>('/chat', {
        message: currentInput,
        context: uploadedDoc?.text
      });

      const botMessage: Message = {
        id: now + 1,
        text: data.response || "I apologize, but I couldn't process that request.",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message. Please check backend connection.', 'error');
      
      const errorMessage: Message = {
        id: now + 1,
        text: "I'm having trouble connecting to my local cognitive servers. Please ensure the backend server is running in the background.",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
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

      const systemMsg: Message = {
        id: Date.now(),
        text: `I have successfully parsed and mapped "${data.filename}". You can now ask me to extract clauses, review liabilities, or summarize details based specifically on this document.`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
      const summaryMsg: Message = {
        id: Date.now(),
        text: `### AI Summary of ${uploadedDoc.name}\n\n${data.summary}`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear chat history?")) {
      setMessages(defaultMessages);
      showToast('Chat history cleared.', 'info');
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background-light dark:bg-background-dark overflow-hidden text-gray-800 dark:text-gray-200">
      
      {/* --- SIDEBAR: CHAT HISTORY & CONTEXT CONTROL PANEL --- */}
      <aside className="w-80 bg-white/70 dark:bg-[#080808]/40 border-r border-gray-200 dark:border-gray-850 p-6 hidden lg:flex flex-col justify-between backdrop-blur-md relative z-10">
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-primary-600" />
              Cognitive History
            </h2>
            <button
              onClick={clearHistory}
              className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Active Context Card */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              Secure Sandbox
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
              Your conversations are fully sandboxed. No data leaves your local session to train models.
            </p>
          </div>

          {/* Simulated History items */}
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            <button className="w-full text-left p-3 text-xs font-semibold rounded-xl bg-primary-600/10 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 border border-primary-600/20 dark:border-primary-500/20 flex gap-2 items-center">
              <Sparkles size={12} />
              Current Audit Session
            </button>
            <button className="w-full text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-900/40 border border-transparent rounded-xl transition-all flex gap-2 items-center">
              <FileText size={12} />
              Termination Audit Review
            </button>
            <button className="w-full text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-900/40 border border-transparent rounded-xl transition-all flex gap-2 items-center">
              <FileText size={12} />
              Commercial Lease Analysis
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-primary flex gap-2 items-start leading-normal">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>Type questions about clauses to instantly view remediation actions.</span>
        </div>
      </aside>

      {/* --- MAIN CHAT AREA --- */}
      <main className="flex-1 flex flex-col justify-between relative overflow-hidden bg-background-light dark:bg-background-dark">
        
        {/* Ambient mesh background glows */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute top-20 right-10 w-96 h-96 bg-primary-600/10 dark:bg-primary-600/5 rounded-full filter blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-emerald-700/10 dark:bg-emerald-700/5 rounded-full filter blur-[90px] animate-pulse" style={{ animationDelay: '3s' }}></div>
        </div>

        {/* Workspace Active Header */}
        <header className="relative z-10 px-6 py-4 bg-white/70 dark:bg-gray-950/20 border-b border-gray-200 dark:border-gray-850 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 absolute"></div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">LegalEase AI Engine</h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Active Sandbox · LLM Extractive Analysis</p>
            </div>
          </div>
        </header>

        {/* Message Feed Container */}
        <div className="flex-grow overflow-y-auto px-6 py-8 space-y-6 relative z-10">
          {messages.map((msg: Message) => {
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
                      ? 'bg-gradient-to-tr from-primary-600 to-indigo-600 text-white' 
                      : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                  }`}>
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                  </div>

                  {/* Message Bubble Card */}
                  <div className={`p-4 rounded-2xl shadow-sm text-left leading-relaxed ${
                    isUser 
                      ? 'bg-primary-600 text-white rounded-tr-none shadow-primary-500/10' 
                      : 'bg-white/80 dark:bg-gray-900/60 backdrop-blur-md text-gray-900 dark:text-gray-150 rounded-tl-none border border-gray-150 dark:border-gray-800'
                  }`}>
                    <p className="text-sm font-medium whitespace-pre-line">{msg.text}</p>
                    <p className={`text-[9px] font-semibold mt-2 ${isUser ? 'text-blue-200 text-right' : 'text-gray-400 dark:text-gray-500'}`}>
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

          <div ref={chatEndRef} />
        </div>

        {/* --- BOTTOM INTERACTIVE PANEL --- */}
        <div className="relative z-10 p-6 bg-white/70 dark:bg-gray-950/20 border-t border-gray-200 dark:border-gray-850 backdrop-blur-md space-y-4">
          
          {/* uploaded Document Context badge */}
          {uploadedDoc && (
            <div className="flex items-center justify-between bg-primary-600/5 dark:bg-primary-500/10 px-4 py-2.5 rounded-xl border border-primary-600/20 dark:border-primary-500/20 animate-fade-in">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={16} className="text-primary flex-shrink-0" />
                <span className="text-xs font-semibold text-primary truncate max-w-md">
                  Active Context: {uploadedDoc.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSummarize}
                  className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg border border-primary/20 transition-colors"
                >
                  <Sparkles size={11} />
                  Summarize
                </button>
                <button
                  onClick={() => setUploadedDoc(null)}
                  className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  aria-label="Remove active context"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Chat text box input */}
          <div className="flex items-center gap-3">
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
              className="p-3 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all flex items-center justify-center"
              title="Attach Legal Document"
            >
              {isUploading ? (
                <RefreshCcw size={20} className="animate-spin text-primary" />
              ) : (
                <Paperclip size={20} />
              )}
            </button>

            <div className="flex-1 relative flex items-center bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 overflow-hidden transition-all duration-300">
              <input
                type="text"
                className="w-full pl-4 pr-12 py-3.5 bg-transparent border-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                placeholder={uploadedDoc ? "Ask me details about the attached document..." : "Type your legal audit query here..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 p-2 rounded-lg bg-primary-650 hover:bg-primary text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
