import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChatbotPage } from '../../pages/ChatbotPage';
import { ToastProvider } from '../../contexts/ToastContext';
import { RedactionProvider } from '../../contexts/RedactionContext';
import { ChatStorageService } from '../../services/storage';
import { api } from '../../services/api';

describe('ConflictChecker integration in ChatbotPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderWithProviders = () => {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <RedactionProvider>
            <ChatbotPage />
          </RedactionProvider>
        </ToastProvider>
      </MemoryRouter>
    );
  };

  it('renders tab selector and handles switching to Conflict Checker view', async () => {
    // Setup a comparison session in Storage
    const session = ChatStorageService.createSession('Compare Session');
    session.multiDocContext = [
      { id: 'doc_1', name: 'Contract A.pdf', text: 'Termination within 30 days.' },
      { id: 'doc_2', name: 'Contract B.docx', text: 'Termination requires 60 days notice.' }
    ];
    ChatStorageService.saveSession(session);
    ChatStorageService.setActiveSessionId(session.id);

    renderWithProviders();

    // Verify "Conflict Checker" tab is rendered
    const conflictTab = await screen.findByTestId('conflict-checker-tab');
    expect(conflictTab).toBeInTheDocument();
    expect(screen.getByText('Chat Assistant')).toBeInTheDocument();

    // Switch to Conflict Checker tab
    fireEvent.click(conflictTab);

    // Verify selectors and button are visible
    expect(screen.getByText('Primary Document:')).toBeInTheDocument();
    expect(screen.getByText('Secondary Document:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run conflict check/i })).toBeInTheDocument();
  });

  it('successfully calls comparison conflicts API and displays contradictions', async () => {
    // Setup comparison session
    const session = ChatStorageService.createSession('Compare Session 2');
    session.multiDocContext = [
      { id: 'doc_1', name: 'Contract A.pdf', text: 'Text A' },
      { id: 'doc_2', name: 'Contract B.docx', text: 'Text B' }
    ];
    ChatStorageService.saveSession(session);
    ChatStorageService.setActiveSessionId(session.id);

    // Mock API post call
    const mockConflictsResponse = {
      conflicts: [
        {
          primary_clause: 'Termination requires 30 days notice.',
          secondary_clause: 'Termination requires 60 days notice.',
          explanation: 'Conflicting notice periods for termination.',
          severity: 'High'
        }
      ]
    };
    const apiSpy = vi.spyOn(api, 'post').mockResolvedValue(mockConflictsResponse);

    renderWithProviders();

    // Switch to Conflict Checker
    const conflictTab = await screen.findByTestId('conflict-checker-tab');
    fireEvent.click(conflictTab);

    // Run conflict check
    const checkBtn = screen.getByRole('button', { name: /run conflict check/i });
    fireEvent.click(checkBtn);

    // Verify API is called with correct arguments
    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/compare/conflicts', expect.objectContaining({
        primary_document: expect.objectContaining({ id: 'doc_1', name: 'Contract A.pdf' }),
        secondary_document: expect.objectContaining({ id: 'doc_2', name: 'Contract B.docx' }),
        jurisdiction: 'General / Not Specified'
      }));
    });

    // Check that contradiction is displayed
    const conflictCard = await screen.findByTestId('conflict-card');
    expect(conflictCard).toBeInTheDocument();
    expect(screen.getByText('High Severity')).toBeInTheDocument();
    expect(screen.getByText('Conflicting notice periods for termination.')).toBeInTheDocument();
    expect(screen.getByText('"Termination requires 30 days notice."')).toBeInTheDocument();
    expect(screen.getByText('"Termination requires 60 days notice."')).toBeInTheDocument();
  });
});
