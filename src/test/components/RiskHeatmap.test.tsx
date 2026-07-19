import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { ToastProvider } from '../../contexts/ToastContext';
import { RedactionProvider } from '../../contexts/RedactionContext';
import { StorageService, Document } from '../../services/storage';

describe('RiskHeatmap integration in DocumentsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderWithProviders = () => {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <RedactionProvider>
            <DocumentsPage />
          </RedactionProvider>
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('renders overview and allows switching to Risk Heatmap tab inside modal', async () => {
    const mockDoc: Document = {
      id: 'doc_1',
      name: 'Lease Agreement - Apartment 4B.pdf',
      type: 'pdf',
      size: 2400000,
      uploadDate: new Date().toISOString(),
      status: 'processed',
      text: "The company may terminate this agreement at any time without notice. Subscriber shall indemnify and hold harmless Provider.",
      summary: "Overview summary text",
      clauses: [
        {
          clause: "The company may terminate this agreement at any time without notice.",
          riskLevel: "High",
          riskReason: "Allows one party to terminate the agreement without notice."
        },
        {
          clause: "Subscriber shall indemnify and hold harmless Provider.",
          riskLevel: "Medium",
          riskReason: "Broad indemnification clause."
        }
      ]
    };
    StorageService.saveDocument(mockDoc);

    renderWithProviders();

    // Open Modal
    const reviewBtn = await screen.findByRole('button', { name: /Audit Analysis/i });
    expect(reviewBtn).toBeInTheDocument();
    fireEvent.click(reviewBtn);

    // Verify modal elements
    expect(screen.getAllByText('Lease Agreement - Apartment 4B.pdf').length).toBe(2);
    
    const overviewTab = screen.getByTestId('audit-overview-tab');
    const heatmapTab = screen.getByTestId('audit-heatmap-tab');
    expect(overviewTab).toBeInTheDocument();
    expect(heatmapTab).toBeInTheDocument();

    // Verify Overview content is active by default
    expect(screen.getByText('AI Cognitive Audit Audit Ready')).toBeInTheDocument();

    // Switch to Heatmap
    fireEvent.click(heatmapTab);

    // Verify Heatmap view is rendered
    expect(screen.getByTestId('risk-heatmap-view')).toBeInTheDocument();

    // Check highlighted text segments
    const highlights = screen.getAllByTestId('heatmap-highlight');
    expect(highlights.length).toBe(2);

    expect(screen.getByText('The company may terminate this agreement at any time without notice.')).toBeInTheDocument();
    expect(screen.getByText('Subscriber shall indemnify and hold harmless Provider.')).toBeInTheDocument();

    // Check Legend
    const legendItems = screen.getAllByTestId('heatmap-legend-item');
    expect(legendItems.length).toBe(2);
    expect(screen.getAllByText('Allows one party to terminate the agreement without notice.').length).toBe(2);
    expect(screen.getAllByText('Broad indemnification clause.').length).toBe(2);
  });
});
