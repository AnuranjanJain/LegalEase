import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { ToastProvider } from '../../contexts/ToastContext';
import { ToastContainer } from '../../components/ToastContainer';
import { api } from '../../services/api';
import { StorageService } from '../../services/storage';
import { MemoryRouter } from 'react-router-dom';
import { RedactionProvider } from '../../contexts/RedactionContext';

// Mock URL API methods
const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob-url');
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(window.URL, 'createObjectURL', { value: mockCreateObjectURL });
Object.defineProperty(window.URL, 'revokeObjectURL', { value: mockRevokeObjectURL });

describe('DocumentsPage Export PDF Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();

    // Mock storage return to provide a processed document
    vi.spyOn(StorageService, 'getDocuments').mockReturnValue([
      {
        id: 'doc_1',
        name: 'Lease Agreement.pdf',
        type: 'pdf',
        size: 1024,
        uploadDate: new Date().toISOString(),
        status: 'processed',
        summary: 'Mocked lease agreement summary.'
      }
    ]);
  });

  it('renders Export PDF button in Audit details modal', async () => {
    render(
      <MemoryRouter>
        <RedactionProvider>
          <ToastProvider>
            <ToastContainer />
            <DocumentsPage />
          </ToastProvider>
        </RedactionProvider>
      </MemoryRouter>
    );

    // Open audit modal
    const auditBtn = screen.getByRole('button', { name: /audit analysis/i });
    fireEvent.click(auditBtn);

    // Assert Export PDF button renders
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
  });

  it('triggers API call and initiates download on Export PDF click', async () => {
    const apiSpy = vi.spyOn(api, 'postBlob').mockResolvedValue(new Blob(['mock pdf'], { type: 'application/pdf' }));
    
    // Stub anchor link behaviors using a real anchor element to prevent mounting issues
    const originalCreateElement = document.createElement;
    const mockAnchor = originalCreateElement.call(document, 'a');
    mockAnchor.click = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') return mockAnchor as any;
      return originalCreateElement.call(document, tagName);
    });

    render(
      <MemoryRouter>
        <RedactionProvider>
          <ToastProvider>
            <ToastContainer />
            <DocumentsPage />
          </ToastProvider>
        </RedactionProvider>
      </MemoryRouter>
    );

    // Open modal and click Export PDF
    fireEvent.click(screen.getByRole('button', { name: /audit analysis/i }));
    const exportBtn = screen.getByRole('button', { name: /export pdf/i });
    fireEvent.click(exportBtn);

    // Button should be disabled during download
    expect(exportBtn).toBeDisabled();

    await waitFor(() => {
      // Assert API endpoint is invoked with correct payload
      expect(apiSpy).toHaveBeenCalledWith('/api/export/pdf', {
        title: 'AI Document Summary: Lease Agreement.pdf',
        summary: 'Mocked lease agreement summary.'
      });
      // Assert auto-download link click gets triggered
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    createElementSpy.mockRestore();
  });

  it('displays error toast message if API call fails', async () => {
    vi.spyOn(api, 'postBlob').mockRejectedValue(new Error('Backend PDF generation failed'));

    render(
      <MemoryRouter>
        <RedactionProvider>
          <ToastProvider>
            <ToastContainer />
            <DocumentsPage />
          </ToastProvider>
        </RedactionProvider>
      </MemoryRouter>
    );

    // Open modal and click Export PDF
    fireEvent.click(screen.getByRole('button', { name: /audit analysis/i }));
    const exportBtn = screen.getByRole('button', { name: /export pdf/i });
    fireEvent.click(exportBtn);

    // Assert error toast with backend error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Backend PDF generation failed')).toBeInTheDocument();
    });
  });
});
