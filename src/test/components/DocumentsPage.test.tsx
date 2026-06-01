import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { StorageService } from '../../services/storage';
import { api } from '../../services/api';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock ToastContext
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock StorageService
vi.mock('../../services/storage', () => ({
  StorageService: {
    getDocuments: vi.fn(),
    saveDocument: vi.fn(),
  },
}));

// Mock api
vi.mock('../../services/api', () => ({
  api: {
    upload: vi.fn(),
  },
}));

const mockDocs = [
  {
    id: 'doc_1',
    name: 'Lease Agreement.pdf',
    type: 'pdf',
    size: 2048,
    uploadDate: '2026-05-31T12:00:00Z',
    status: 'processed' as const,
    extractedText: 'Tenant agrees to pay landlord rent.',
  },
  {
    id: 'doc_2',
    name: 'Work NDA.docx',
    type: 'docx',
    size: 4096,
    uploadDate: '2026-05-30T10:00:00Z',
    status: 'processing' as const,
  },
];

describe('DocumentsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(StorageService.getDocuments).mockReturnValue(mockDocs);
    localStorage.clear();
  });

  it('renders title, upload area, search bar, and documents list', () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /document vault/i })).toBeInTheDocument();
    expect(screen.getByText(/click to upload or drag & drop/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search documents/i)).toBeInTheDocument();

    // Check document titles
    expect(screen.getByText('Lease Agreement.pdf')).toBeInTheDocument();
    expect(screen.getByText('Work NDA.docx')).toBeInTheDocument();
  });

  it('renders empty state when there are no documents', () => {
    vi.mocked(StorageService.getDocuments).mockReturnValue([]);
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('No Documents Found')).toBeInTheDocument();
    expect(screen.getByText(/there are no documents matching your filters/i)).toBeInTheDocument();
  });

  it('handles search query input and filters document list', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/search documents/i);
    
    // Type search query that matches only 'Lease'
    await act(async () => {
      await user.type(searchInput, 'Lease');
    });

    expect(screen.getByText('Lease Agreement.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Work NDA.docx')).not.toBeInTheDocument();
  });

  it('filters document list by file type tabs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    // Click 'DOCX' type filter
    const docxFilterBtn = screen.getByRole('button', { name: 'DOCX' });
    await act(async () => {
      await user.click(docxFilterBtn);
    });

    expect(screen.queryByText('Lease Agreement.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Work NDA.docx')).toBeInTheDocument();
  });

  it('toggles list and grid views', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    // Switch to List View
    const listViewBtn = screen.getByLabelText(/list view/i);
    await act(async () => {
      await user.click(listViewBtn);
    });

    // Check table headers present in list view
    expect(screen.getByText('Document Name')).toBeInTheDocument();
    expect(screen.getByText('AI Audit Status')).toBeInTheDocument();

    // Switch back to Grid View
    const gridViewBtn = screen.getByLabelText(/grid view/i);
    await act(async () => {
      await user.click(gridViewBtn);
    });

    expect(screen.queryByText('Document Name')).not.toBeInTheDocument();
  });

  it('triggers delete document and updates state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    // Get the delete button for Lease Agreement.pdf
    const deleteBtn = screen.getByLabelText('Delete Lease Agreement.pdf');
    
    await act(async () => {
      await user.click(deleteBtn);
    });

    // Verifies notification toast
    expect(mockShowToast).toHaveBeenCalledWith('"Lease Agreement.pdf" deleted successfully.', 'info');
    // Verifies it is removed from view
    expect(screen.queryByText('Lease Agreement.pdf')).not.toBeInTheDocument();
  });

  it('processes file upload successfully via file input trigger', async () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    vi.mocked(api.upload).mockResolvedValue({ filename: 'test.txt', text: 'analyzed content' });
    
    // Use getDocuments return update inside upload process
    let updateDocsCallCount = 0;
    vi.mocked(StorageService.getDocuments).mockImplementation(() => {
      if (updateDocsCallCount > 0) {
        return [...mockDocs, {
          id: 'test_doc_id',
          name: 'test.txt',
          type: 'txt',
          size: 11,
          uploadDate: new Date().toISOString(),
          status: 'processed' as const,
        }];
      }
      updateDocsCallCount++;
      return mockDocs;
    });

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/upload documents/i).querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    await act(async () => {
      fireEvent.change(input!, { target: { files: [file] } });
    });

    expect(mockShowToast).toHaveBeenCalledWith('Initializing processing pipeline for "test.txt"...', 'info');
    expect(StorageService.saveDocument).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/processing', { state: { docId: expect.any(String), file } });
  });

  it('handles drag over, drag leave, and drop events on the upload area', async () => {
    const file = new File(['sample contract'], 'agreement.pdf', { type: 'application/pdf' });
    vi.mocked(api.upload).mockResolvedValue({ filename: 'agreement.pdf', text: 'extracted pdf' });
    
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    const dropzone = screen.getByLabelText(/upload documents/i);

    // Drag Over
    await act(async () => {
      fireEvent.dragOver(dropzone);
    });
    expect(dropzone).toHaveClass('border-primary-600');

    // Drag Leave
    await act(async () => {
      fireEvent.dragLeave(dropzone);
    });
    expect(dropzone).not.toHaveClass('border-primary-600');

    // Drop file
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });
    });

    expect(mockShowToast).toHaveBeenCalledWith('Initializing processing pipeline for "agreement.pdf"...', 'info');
  });

  it('navigates to dashboard or processing on document review click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    // Clicking processed document "Lease Agreement.pdf" opens audit report (no navigate)
    const leaseTitle = screen.getByText('Lease Agreement.pdf');
    await act(async () => {
      await user.click(leaseTitle);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Opening cognitive audit report for "Lease Agreement.pdf"', 'success');

    // Clicking processing document "Work NDA.docx" navigates to processing page
    const ndaTitle = screen.getByText('Work NDA.docx');
    await act(async () => {
      await user.click(ndaTitle);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/processing', { state: { docId: 'doc_2' } });
    expect(mockShowToast).toHaveBeenCalledWith('Document analysis is in progress. Please wait...', 'warning');
  });
});
