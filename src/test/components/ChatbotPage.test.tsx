import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatbotPage } from '../../pages/ChatbotPage';
import { ChatStorageService } from '../../services/storage';
import { api } from '../../services/api';

// Mock ToastContext
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock ChatStorageService
const mockSessionList = [
  {
    id: 'session_1',
    title: 'First Chat',
    createdAt: '2026-05-31T10:00:00Z',
    updatedAt: '2026-05-31T10:05:00Z',
    messageCount: 3,
  },
];
const mockSessionData = {
  id: 'session_1',
  title: 'First Chat',
  messages: [
    { id: '1', text: 'Hello bot', sender: 'user' as const, time: '10:00 AM', timestamp: '2026-05-31T10:00:00Z' },
    { id: '2', text: 'Hi human', sender: 'bot' as const, time: '10:01 AM', timestamp: '2026-05-31T10:01:00Z' },
  ],
  documentContext: {
    name: 'test.pdf',
    text: 'contract details info',
  },
};

vi.mock('../../services/storage', () => ({
  ChatStorageService: {
    migrateOldChatHistory: vi.fn(),
    getActiveSessionId: vi.fn(),
    setActiveSessionId: vi.fn(),
    getSessions: vi.fn(),
    getSession: vi.fn(),
    createSession: vi.fn(),
    saveSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

// Mock API
vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
    upload: vi.fn(),
  },
}));

// Mock Clipboard and scrollIntoView
const mockWriteText = vi.fn();
let originalClipboard: any;

describe('ChatbotPage Component', () => {
  beforeAll(() => {
    // Mock scrollIntoView which is missing in jsdom
    Element.prototype.scrollIntoView = vi.fn();
    originalClipboard = navigator.clipboard;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ChatStorageService.getSessions).mockReturnValue(mockSessionList);
    vi.mocked(ChatStorageService.getActiveSessionId).mockReturnValue('session_1');
    vi.mocked(ChatStorageService.getSession).mockReturnValue(mockSessionData);
    
    // Mock navigator.clipboard using defineProperty since clipboard is a read-only getter
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it('renders chat interface with default welcome and loaded messages', () => {
    render(<ChatbotPage />);

    // Since mockSessionData has documentContext loaded, the placeholder is "Ask about this document..."
    expect(screen.getByPlaceholderText(/ask about this document/i)).toBeInTheDocument();
    
    // Check loaded messages
    expect(screen.getByText('Hello bot')).toBeInTheDocument();
    expect(screen.getByText('Hi human')).toBeInTheDocument();
  });

  it('handles sending a message successfully and displays AI response', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ response: 'This is the AI response.' });

    render(<ChatbotPage />);

    const input = screen.getByPlaceholderText(/ask about this document/i);
    const buttons = screen.getAllByRole('button');
    const sendBtn = buttons.find(b => b.classList.contains('bg-primary'));
    expect(sendBtn).toBeDefined();

    // Type a message
    await act(async () => {
      await user.type(input, 'Can you explain termination?');
    });

    // Send the message
    await act(async () => {
      await user.click(sendBtn);
    });

    // Check user message is displayed immediately
    expect(screen.getByText('Can you explain termination?')).toBeInTheDocument();
    
    // Verify API call
    expect(api.post).toHaveBeenCalledWith(
      '/chat',
      expect.objectContaining({ message: 'Can you explain termination?' }),
      expect.any(Array)
    );

    // Verify AI response renders
    expect(screen.getByText('This is the AI response.')).toBeInTheDocument();
  });

  it('copies bot response to clipboard on copy click', async () => {
    render(<ChatbotPage />);

    // Get the copy button (only bot messages have copy icon button)
    const copyBtn = screen.getByLabelText(/copy response text/i);
    
    // Use fireEvent click to reliably click absolute elements with opacity-0 class in jsdom
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(mockWriteText).toHaveBeenCalledWith('Hi human');
    expect(mockShowToast).toHaveBeenCalledWith('Copied to clipboard!', 'success');
  });

  it('processes file upload and sets active document context', async () => {
    const file = new File(['document text content'], 'NDA.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    vi.mocked(api.upload).mockResolvedValue({ filename: 'NDA.docx', text: 'analyzed NDA content' });

    render(<ChatbotPage />);

    // Query hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(mockShowToast).toHaveBeenCalledWith('Uploading "NDA.docx" to AI sandbox...', 'info');
    expect(api.upload).toHaveBeenCalled();
  });

  it('manages conversation session CRUD (switch, new, delete)', async () => {
    const user = userEvent.setup();
    const mockNewSession = { id: 'session_2', title: 'New Conversation', messages: [] };
    vi.mocked(ChatStorageService.createSession).mockReturnValue(mockNewSession);
    
    render(<ChatbotPage />);

    // Toggle history sidebar list
    const historyBtn = screen.getByTitle('Conversation history');
    await act(async () => {
      await user.click(historyBtn);
    });

    // Sessions title should be visible in dropdown
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('First Chat')).toBeInTheDocument();

    // Click "New conversation" button
    const newSessionBtn = screen.getByTitle('New conversation');
    await act(async () => {
      await user.click(newSessionBtn);
    });

    expect(ChatStorageService.createSession).toHaveBeenCalled();

    // Delete session
    // Re-open sessions pane
    await act(async () => {
      await user.click(historyBtn);
    });
    const deleteBtn = screen.getByTitle('Delete conversation');
    await act(async () => {
      await user.click(deleteBtn);
    });

    expect(ChatStorageService.deleteSession).toHaveBeenCalledWith('session_1');
  });
});
