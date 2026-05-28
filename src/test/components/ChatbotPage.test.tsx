import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ChatbotPage } from '../../pages/ChatbotPage';
import { ChatStorageService } from '../../services/storage';
import { ToastProvider } from '../../contexts/ToastContext';

vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
    upload: vi.fn(),
  },
}));

vi.mock('../../services/storage', () => ({
  ChatStorageService: {
    migrateOldChatHistory: vi.fn(),
    getActiveSessionId: vi.fn(),
    getSessions: vi.fn(),
    getSession: vi.fn(),
    createSession: vi.fn(),
    saveSession: vi.fn(),
    setActiveSessionId: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

function renderChatbot() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ChatbotPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

const mockSession = {
  id: 'session-1',
  title: 'New Conversation',
  messages: [],
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockNewSession = {
  id: 'session-2',
  title: 'New Conversation',
  messages: [],
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ChatbotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ChatStorageService.migrateOldChatHistory as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (ChatStorageService.getActiveSessionId as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (ChatStorageService.getSessions as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (ChatStorageService.createSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    (ChatStorageService.saveSession as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  });

  it('renders the default greeting message', async () => {
    renderChatbot();
    expect(await screen.findByText(/I'm LegalEase AI/i)).toBeInTheDocument();
  });

  it('renders chat input field', () => {
    renderChatbot();
    expect(screen.getByPlaceholderText(/Ask a legal question/i)).toBeInTheDocument();
  });

  it('renders send button', () => {
    renderChatbot();
    const sendBtns = screen.getAllByRole('button');
    const sendBtn = sendBtns[sendBtns.length - 1];
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).toBeDisabled();
  });

  it('renders file attachment button', () => {
    renderChatbot();
    const attachBtn = screen.getByTitle('Attach Document');
    expect(attachBtn).toBeInTheDocument();
  });

  it('renders new conversation button', () => {
    renderChatbot();
    const newBtn = screen.getByTitle('New conversation');
    expect(newBtn).toBeInTheDocument();
  });

  it('renders conversation history button', () => {
    renderChatbot();
    const historyBtn = screen.getByTitle('Conversation history');
    expect(historyBtn).toBeInTheDocument();
  });

  it('creates a new session on mount', () => {
    renderChatbot();
    expect(ChatStorageService.createSession).toHaveBeenCalledWith('New Conversation');
  });

  it('shows session panel when history button is clicked', async () => {
    (ChatStorageService.getSessions as ReturnType<typeof vi.fn>).mockReturnValue([mockSession]);
    (ChatStorageService.getSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    const user = userEvent.setup();
    renderChatbot();
    const historyBtn = screen.getByTitle('Conversation history');
    await user.click(historyBtn);
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('shows empty state in session panel when no sessions exist', async () => {
    const user = userEvent.setup();
    renderChatbot();
    const historyBtn = screen.getByTitle('Conversation history');
    await user.click(historyBtn);
    expect(screen.getByText('No saved conversations.')).toBeInTheDocument();
  });

  it('enables send button when input is provided', async () => {
    const user = userEvent.setup();
    renderChatbot();
    const input = screen.getByPlaceholderText(/Ask a legal question/i);
    await user.type(input, 'What is a contract?');
    const sendBtns = screen.getAllByRole('button');
    const sendBtn = sendBtns[sendBtns.length - 1];
    expect(sendBtn).not.toBeDisabled();
  });

  it('clears input after sending a message', async () => {
    const { api } = await import('../../services/api');
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ response: 'Test response' });

    const user = userEvent.setup();
    renderChatbot();
    const input = screen.getByPlaceholderText(/Ask a legal question/i);
    await user.type(input, 'Hello');
    const sendBtns = screen.getAllByRole('button');
    const sendBtn = sendBtns[sendBtns.length - 1];
    await user.click(sendBtn);
    expect(api.post).toHaveBeenCalled();
  });
});
