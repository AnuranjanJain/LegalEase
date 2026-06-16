import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimplifyModal } from '../../components/SimplifyModal';
import { ToastProvider } from '../../contexts/ToastContext';
import { api } from '../../services/api';

// Mock clipboard API
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
  configurable: true,
});

describe('SimplifyModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWriteText.mockClear();
  });

  it('renders nothing when clauseText is null', () => {
    const { container } = render(
      <ToastProvider>
        <SimplifyModal clauseText={null} onClose={vi.fn()} />
      </ToastProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls API on mount and shows loading state, then simplified text', async () => {
    const onClose = vi.fn();
    const mockSimplifyPromise = new Promise<{ simplifiedText: string }>((resolve) => {
      setTimeout(() => resolve({ simplifiedText: 'This is the plain English version.' }), 50);
    });
    const apiSpy = vi.spyOn(api, 'post').mockImplementation(() => mockSimplifyPromise);

    render(
      <ToastProvider>
        <SimplifyModal clauseText="Complex legalese clause text" onClose={onClose} />
      </ToastProvider>
    );

    // Verify loading indicator/label is in document
    expect(screen.getByLabelText(/loading simplified text/i)).toBeInTheDocument();
    expect(screen.getByText('Complex legalese clause text')).toBeInTheDocument();

    // Wait for simplification to resolve
    await waitFor(() => {
      expect(screen.getByText('This is the plain English version.')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/loading simplified text/i)).not.toBeInTheDocument();
    expect(apiSpy).toHaveBeenCalledWith('/api/simplify', { text: 'Complex legalese clause text' });
  });

  it('shows error state when API fails', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Rate limit exceeded'));

    render(
      <ToastProvider>
        <SimplifyModal clauseText="Complex legalese clause text" onClose={vi.fn()} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
      expect(screen.getByText('Simplification Failed')).toBeInTheDocument();
    });
  });

  it('allows copying to clipboard when simplification succeeds', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ simplifiedText: 'Simplified text' });

    render(
      <ToastProvider>
        <SimplifyModal clauseText="Complex legalese clause text" onClose={vi.fn()} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Simplified text')).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /copy explanation/i });
    fireEvent.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith('Simplified text');
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles closing the modal via Close button', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ simplifiedText: 'Simplified text' });
    const onClose = vi.fn();

    render(
      <ToastProvider>
        <SimplifyModal clauseText="Complex legalese clause text" onClose={onClose} />
      </ToastProvider>
    );

    const closeBtn = screen.getByRole('button', { name: /close simplification modal/i });
    fireEvent.click(closeBtn);

    // Modal has a fade-out timeout of 250ms
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('closes modal on Escape key press', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ simplifiedText: 'Simplified text' });
    const onClose = vi.fn();

    render(
      <ToastProvider>
        <SimplifyModal clauseText="Complex legalese clause text" onClose={onClose} />
      </ToastProvider>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
