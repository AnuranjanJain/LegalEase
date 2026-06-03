import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastContainer } from '../../components/ToastContainer';
import { ToastProvider } from '../../contexts/ToastContext';

function renderWithProvider() {
  return render(
    <ToastProvider>
      <ToastContainer />
    </ToastProvider>
  );
}

describe('ToastContainer', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProvider();
    expect(container).toBeInTheDocument();
  });

  it('renders with aria-live region for accessibility', () => {
    renderWithProvider();
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
  });

  it('initially renders no toast elements', () => {
    renderWithProvider();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });
});
