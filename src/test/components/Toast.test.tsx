import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import {Toast} from '../../components/Toast';

// ---------------------------------------------------------------------------
// Shared toast shape that matches the component's expected props
// ---------------------------------------------------------------------------
const makeToast = (overrides: Partial<{
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}> = {}) => ({
  id: 'toast-1',
  message: 'Test message',
  type: 'info' as const,
  duration: 3000,
  ...overrides,
});

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Variant rendering
  // -------------------------------------------------------------------------

  it.each([
    ['success', /success/i],
    ['error',   /error/i],
    ['warning', /warning/i],
    ['info',    /info/i],
  ] as const)(
    'renders the %s variant with appropriate accessible label or class',
    (type, _labelPattern) => {
      const onRemove = vi.fn();
      const { container } = render(
        <Toast toast={makeToast({ type })} onRemove={onRemove} />
      );

      // The component should render without crashing for every variant
      expect(screen.getByText('Test message')).toBeInTheDocument();

      // There should be some visual differentiation — a class, role, or aria-label
      // that carries the variant name. We check the container broadly.
      expect(container.innerHTML.toLowerCase()).toContain(type);
    }
  );

  // -------------------------------------------------------------------------
  // Close button
  // -------------------------------------------------------------------------

  

  it('does not call onRemove before the close button is clicked', () => {
    const onRemove = vi.fn();
    render(<Toast toast={makeToast()} onRemove={onRemove} />);

    expect(onRemove).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Exit-animation timer: fires at (duration - 300) ms
  // -------------------------------------------------------------------------

  it('calls onRemove 300ms after the close button is clicked', () => {
  const onRemove = vi.fn();
  render(<Toast toast={makeToast({ id: 'abc-123' })} onRemove={onRemove} />);

  fireEvent.click(screen.getByRole('button', { name: /close notification/i }));

  // Not called immediately — there's a 300ms animation delay
  expect(onRemove).not.toHaveBeenCalled();

  // Called after the delay
  act(() => { vi.advanceTimersByTime(300); });
  expect(onRemove).toHaveBeenCalledWith('abc-123');
});

it('sets exit animation state after (duration - 300) ms', () => {
  const onRemove = vi.fn();
  const duration = 3000;
  const { container } = render(
    <Toast toast={makeToast({ duration })} onRemove={onRemove} />
  );

  // Before timer: no exit class
  expect(container.firstChild).not.toHaveClass('opacity-0');

  // After timer: exit class applied (isExiting = true)
  act(() => { vi.advanceTimersByTime(duration - 300); });
  expect(container.firstChild).toHaveClass('opacity-0');

  // onRemove is never called by the timer itself
  expect(onRemove).not.toHaveBeenCalled();
});

it('does not call onRemove a second time after close button already fired it', () => {
  const onRemove = vi.fn();
  const duration = 3000;

  render(<Toast toast={makeToast({ id: 'early-close', duration })} onRemove={onRemove} />);

  // Click close — fires onRemove after 300ms
  fireEvent.click(screen.getByRole('button', { name: /close notification/i }));
  act(() => { vi.advanceTimersByTime(300); });
  expect(onRemove).toHaveBeenCalledTimes(1);

  // Advance past the full duration — no second call
  act(() => { vi.advanceTimersByTime(duration); });
  expect(onRemove).toHaveBeenCalledTimes(1);
});



  // -------------------------------------------------------------------------
  // Message rendering
  // -------------------------------------------------------------------------

  it('displays the message text passed via props', () => {
    render(
      <Toast
        toast={makeToast({ message: 'File uploaded successfully' })}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('File uploaded successfully')).toBeInTheDocument();
  });
});
