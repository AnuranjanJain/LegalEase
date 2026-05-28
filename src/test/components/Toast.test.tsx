import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from '../../components/Toast';
import type { Toast as ToastType } from '../../contexts/ToastContext';

const onRemove = vi.fn();

function createToast(overrides: Partial<ToastType> = {}): ToastType {
  return {
    id: 'test-1',
    message: 'Test notification message',
    type: 'success',
    duration: 3000,
    ...overrides,
  };
}

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toast message', () => {
    render(<Toast toast={createToast()} onRemove={onRemove} />);
    expect(screen.getByText('Test notification message')).toBeInTheDocument();
  });

  it('renders a close button', () => {
    render(<Toast toast={createToast()} onRemove={onRemove} />);
    expect(screen.getByRole('button', { name: /close notification/i })).toBeInTheDocument();
  });

  it('calls onRemove when close button is clicked', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Toast toast={createToast()} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: /close notification/i }));
    vi.advanceTimersByTime(300);
    expect(onRemove).toHaveBeenCalledWith('test-1');
    vi.useRealTimers();
  });

  it('renders success toast', () => {
    const { container } = render(<Toast toast={createToast({ type: 'success' })} onRemove={onRemove} />);
    expect(container.innerHTML).toContain('check');
  });

  it('renders error toast', () => {
    const { container } = render(<Toast toast={createToast({ type: 'error' })} onRemove={onRemove} />);
    expect(container.innerHTML).toContain('xcircle');
  });

  it('renders warning toast', () => {
    const { container } = render(<Toast toast={createToast({ type: 'warning' })} onRemove={onRemove} />);
    expect(container.innerHTML).toContain('alert');
  });

  it('renders info toast', () => {
    const { container } = render(<Toast toast={createToast({ type: 'info' })} onRemove={onRemove} />);
    expect(container.innerHTML).toContain('info');
  });
});
