import { Send, User, Bot, History, Paperclip, X, FileText, Sparkles, RefreshCcw } from 'lucide-react';
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
    text: "Hello! I'm LegalEase AI. How can I help you understand your legal documents today?",
    sender: 'bot',
    time: '10:00 AM'
  }
];

export function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const savedMessages = localStorage.getItem('chatHistory');

    return savedMessages
      ? JSON.parse(savedMessages)
      : defaultMessages;
  });


  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();
  useEffect(() => {
  const savedMessages = localStorage.getItem('chatHistory');

  if (savedMessages) {
    setMessages(JSON.parse(savedMessages));
  }
}, []);
useEffect(() => {
  if (messages.length > 0) {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
  }
}, [messages]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    const now = Date.now();
    const userMessage = {
      id: now,
      text: input,
      sender: 'user' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const data = await api.post<{ response: string }>('/chat', {
        message: currentInput,
        context: uploadedDoc?.text
      });

      const botMessage = {
        id: now + 1,
        text: data.response || "I apologize, but I couldn't process that request.",
        sender: 'bot' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev: Message[]) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message. Please try again.', 'error');
      const errorMessage = {
        id: now + 1,
        text: error instanceof Error ? error.message : "Sorry, I'm having trouble connecting to the server. Please ensure the backend is running.",
        sender: 'bot' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
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
      showToast(`Document "${data.filename}" uploaded successfully!`, 'success');

      const systemMsg: Message = {
        id: Date.now(),
        text: `Successfully uploaded ${data.filename}. I now have context of this document.`,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('Failed to upload document. Please try again.', 'error');
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
      showToast('Document summarized successfully!', 'success');
    } catch (error) {
      console.error('Summarization failed:', error);
      showToast('Failed to summarize document. Please try again.', 'error');
    } finally {
      setIsTyping(false);
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
              <div className={`p-3 rounded-lg shadow-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700'}`}>
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>{msg.time}</p>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start max-w-[80%] flex-row">
              <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mr-2">
                <Bot size={16} />
              </div>
              <div className="p-3 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                </div>
              </div>
            </div>
          </div>
        )}
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

          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hidden sm:block" title="History">
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
