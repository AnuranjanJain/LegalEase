import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { StorageService } from '../../services/storage';
import { ToastProvider } from '../../contexts/ToastContext';

vi.mock('../../services/storage', () => ({
  StorageService: {
    getDocuments: vi.fn(),
    saveDocument: vi.fn(),
    updateDocumentStatus: vi.fn(),
  },
}));

vi.mock('../../components/ShareButton', () => ({
  ShareButton: () => <div data-testid="share-button" />,
}));

vi.mock('../../components/WhatsAppShareModal', () => ({
  WhatsAppShareModal: () => <div data-testid="whatsapp-modal" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DocumentsPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

const mockDocs = [
  {
    id: 'doc-1',
    name: 'contract.pdf',
    type: 'pdf',
    size: 102400,
    uploadDate: '2025-05-01T12:00:00Z',
    status: 'processed' as const,
  },
  {
    id: 'doc-2',
    name: 'agreement.docx',
    type: 'docx',
    size: 204800,
    uploadDate: '2025-05-15T12:00:00Z',
    status: 'processing' as const,
  },
];

describe('DocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (StorageService.getDocuments as ReturnType<typeof vi.fn>).mockReturnValue(mockDocs);
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Document Vault')).toBeInTheDocument();
  });

  it('renders upload area', () => {
    renderPage();
    expect(screen.getByText(/Click to Upload or Drag & Drop/i)).toBeInTheDocument();
  });

  it('renders uploaded documents', () => {
    renderPage();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('agreement.docx')).toBeInTheDocument();
  });

  it('renders document status labels', () => {
    renderPage();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('AI Auditing')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument();
  });

  it('renders filter buttons', () => {
    renderPage();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('TXT')).toBeInTheDocument();
  });

  it('renders view mode toggle buttons', () => {
    renderPage();
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
  });

  it('filters documents by type when filter button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText('PDF'));
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.queryByText('agreement.docx')).not.toBeInTheDocument();
  });

  it('filters documents by search query', async () => {
    const user = userEvent.setup();
    renderPage();
    const searchInput = screen.getByPlaceholderText('Search documents...');
    await user.type(searchInput, 'agreement');
    expect(screen.getByText('agreement.docx')).toBeInTheDocument();
    expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument();
  });

  it('shows empty state when no documents match filters', () => {
    (StorageService.getDocuments as ReturnType<typeof vi.fn>).mockReturnValue([]);
    renderPage();
    expect(screen.getByText(/No Documents Found/i)).toBeInTheDocument();
  });

  it('switches to list view when list button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByLabelText('List view'));
    expect(screen.getByText('Document Name')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Date Uploaded')).toBeInTheDocument();
  });

  it('hides upload area content when dragging', async () => {
    const user = userEvent.setup();
    renderPage();
    const dropZone = screen.getByLabelText(/upload documents/i);
    // Simulate drag over
    const dragOverEvent = new Event('dragover', { bubbles: true });
    Object.defineProperty(dragOverEvent, 'preventDefault', { value: vi.fn() });
    await user.click(dropZone);
  });
});
