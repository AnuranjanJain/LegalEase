import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from '../../components/Toast';
import { ToastContainer } from '../../components/ToastContainer';
import { ToastProvider, useToast } from '../../contexts/ToastContext';

describe('Toast Component', () => {
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    mockOnRemove.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleToasts = {
    success: { id: '1', message: 'Success message', type: 'success' as const, duration: 3000 },
    error: { id: '2', message: 'Error message', type: 'error' as const, duration: 3000 },
    warning: { id: '3', message: 'Warning message', type: 'warning' as const, duration: 3000 },
    info: { id: '4', message: 'Info message', type: 'info' as const, duration: 3000 },
  };

  it('renders success toast type with correct message and layout', () => {
    render(<Toast toast={sampleToasts.success} onRemove={mockOnRemove} />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close notification/i })).toBeInTheDocument();
  });

  it('renders error toast type with correct message', () => {
    render(<Toast toast={sampleToasts.error} onRemove={mockOnRemove} />);
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('renders warning toast type with correct message', () => {
    render(<Toast toast={sampleToasts.warning} onRemove={mockOnRemove} />);
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('renders info toast type with correct message', () => {
    render(<Toast toast={sampleToasts.info} onRemove={mockOnRemove} />);
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('triggers onRemove after close button click + 300ms transition delay', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Toast toast={sampleToasts.success} onRemove={mockOnRemove} />);

    const closeBtn = screen.getByRole('button', { name: /close notification/i });
    
    // Simulate user click inside act
    await act(async () => {
      await user.click(closeBtn);
    });

    // Should not be called immediately
    expect(mockOnRemove).not.toHaveBeenCalled();

    // Advance time by 300ms for exit timeout
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnRemove).toHaveBeenCalledWith('1');
  });

  it('starts exit animation slightly before duration limits (duration - 300)', () => {
    render(<Toast toast={sampleToasts.success} onRemove={mockOnRemove} />);

    // Advance timer to 2690ms (just before exit animation start at 2700ms)
    act(() => {
      vi.advanceTimersByTime(2690);
    });

    const toastDiv = screen.getByText('Success message').closest('div');
    expect(toastDiv).not.toHaveClass('opacity-0');

    // Advance to 2700ms (duration - 300)
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(toastDiv).toHaveClass('opacity-0');
  });
});

// Helper component for testing ToastContainer integrated with ToastContext
function TestToastTrigger() {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast('Triggered toast message', 'success', 2000)}>
      Show Toast
    </button>
  );
}

describe('ToastContainer integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders and manages toasts in stack via ToastContext', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ToastProvider>
        <ToastContainer />
        <TestToastTrigger />
      </ToastProvider>
    );

    // Click trigger to create toast inside act
    const triggerBtn = screen.getByRole('button', { name: /show toast/i });
    await act(async () => {
      await user.click(triggerBtn);
    });

    // Toast should appear on screen
    expect(screen.getByText('Triggered toast message')).toBeInTheDocument();

    // Advance timers by 2000ms to auto-remove toast
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Toast should be removed from DOM
    expect(screen.queryByText('Triggered toast message')).not.toBeInTheDocument();
  });
});
