import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatbotPage } from '../../pages/ChatbotPage';
import { ToastProvider } from '../../contexts/ToastContext';
import { RedactionProvider } from '../../contexts/RedactionContext';

// Mock api client to prevent hitting real network
vi.mock('../../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(() => Promise.resolve([])),
    stream: vi.fn(),
  },
}));

// Mock html2pdf to prevent any issues with loading it
vi.mock('html2pdf.js', () => ({
  default: () => ({
    set: () => ({
      from: () => ({
        save: vi.fn()
      })
    })
  })
}));

const renderChatbot = () => {
  return render(
    <ToastProvider>
      <RedactionProvider>
        <ChatbotPage />
      </RedactionProvider>
    </ToastProvider>
  );
};

describe('Jurisdiction Selector Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders dropdown trigger and initial selected jurisdiction', () => {
    renderChatbot();
    // Default is General / Not Specified
    expect(screen.getByRole('combobox', { name: /Choose Legal Jurisdiction/i })).toBeInTheDocument();
    expect(screen.getByText('General / Not Specified')).toBeInTheDocument();
  });

  it('renders warning badge by default', () => {
    renderChatbot();
    expect(
      screen.getByText('Responses may not reflect jurisdiction-specific legal requirements.')
    ).toBeInTheDocument();
  });

  it('opens dropdown and displays options list on click', () => {
    renderChatbot();
    const trigger = screen.getByRole('combobox', { name: /Choose Legal Jurisdiction/i });
    fireEvent.click(trigger);
    
    // Check search input is rendered
    expect(screen.getByPlaceholderText('Search jurisdiction...')).toBeInTheDocument();
    
    // Check some of the jurisdictions are rendered
    expect(screen.getByText('California Law')).toBeInTheDocument();
    expect(screen.getByText('New York Law')).toBeInTheDocument();
    expect(screen.getByText('Indian Contract Act')).toBeInTheDocument();
  });

  it('filters options list based on search query', () => {
    renderChatbot();
    const trigger = screen.getByRole('combobox', { name: /Choose Legal Jurisdiction/i });
    fireEvent.click(trigger);
    
    const searchInput = screen.getByPlaceholderText('Search jurisdiction...');
    fireEvent.change(searchInput, { target: { value: 'Delaware' } });
    
    expect(screen.getByText('Delaware Corporate Law')).toBeInTheDocument();
    expect(screen.queryByText('California Law')).not.toBeInTheDocument();
  });

  it('selects option, updates state, persists in localStorage, and hides warning badge', async () => {
    renderChatbot();
    const trigger = screen.getByRole('combobox', { name: /Choose Legal Jurisdiction/i });
    fireEvent.click(trigger);
    
    const caliOption = screen.getByText('California Law');
    fireEvent.click(caliOption);
    
    // Dropdown should be closed (search input gone)
    expect(screen.queryByPlaceholderText('Search jurisdiction...')).not.toBeInTheDocument();
    
    // Trigger button should display California Law
    expect(screen.getByText('California Law')).toBeInTheDocument();
    
    // Warning badge should be removed
    expect(
      screen.queryByText('Responses may not reflect jurisdiction-specific legal requirements.')
    ).not.toBeInTheDocument();
    
    // Check localStorage persistence
    expect(localStorage.getItem('le_selected_jurisdiction')).toBe('California Law');
  });

  it('restores selected jurisdiction from localStorage on initial render', () => {
    localStorage.setItem('le_selected_jurisdiction', 'European Union Law');
    renderChatbot();
    
    expect(screen.getByText('European Union Law')).toBeInTheDocument();
    expect(
      screen.queryByText('Responses may not reflect jurisdiction-specific legal requirements.')
    ).not.toBeInTheDocument();
  });
});
