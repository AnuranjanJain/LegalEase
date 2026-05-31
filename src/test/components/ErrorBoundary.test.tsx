import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Helper component that throws an error when a prop trigger is set
function ProblematicComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test crash error');
  }
  return <div>Safe child content</div>;
}

describe('ErrorBoundary Component', () => {
  const originalConsoleError = console.error;
  const originalLocation = window.location;

  beforeAll(() => {
    // Suppress console.error in tests to avoid stack trace clutter
    console.error = vi.fn();

    // Mock window.location.reload
    // @ts-ignore
    delete window.location;
    window.location = {
      ...originalLocation,
      reload: vi.fn(),
    } as any;
  });

  afterAll(() => {
    console.error = originalConsoleError;
    window.location = originalLocation;
  });

  it('renders children normally when there is no error', () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe child content')).toBeInTheDocument();
    expect(screen.queryByText('Oops, something went wrong.')).not.toBeInTheDocument();
  });

  it('renders fallback UI when a child component throws an error', () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops, something went wrong.')).toBeInTheDocument();
    expect(
      screen.getByText(/we encountered an unexpected error/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
  });

  it('calls window.location.reload when the Refresh Page button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const refreshBtn = screen.getByRole('button', { name: /refresh page/i });
    await user.click(refreshBtn);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
