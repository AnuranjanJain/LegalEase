import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';

describe('NotFoundPage Component', () => {
  const originalHistoryBack = window.history.back;

  beforeAll(() => {
    // Mock window.history.back
    Object.defineProperty(window.history, 'back', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window.history, 'back', {
      value: originalHistoryBack,
      configurable: true,
      writable: true,
    });
  });

  it('renders 404 header and Case File Not Found text', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /404/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /case file not found/i })).toBeInTheDocument();
    expect(
      screen.getByText(/the legal document, dashboard path, or page you are looking for does not exist/i)
    ).toBeInTheDocument();
  });

  it('renders Return Home link with correct target path', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const returnHomeLink = screen.getByRole('link', { name: /return home/i });
    expect(returnHomeLink).toBeInTheDocument();
    expect(returnHomeLink).toHaveAttribute('href', '/');
  });

  it('calls window.history.back when clicking "Go Back" button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const goBackBtn = screen.getByRole('button', { name: /go back/i });
    await act(async () => {
      await user.click(goBackBtn);
    });

    expect(window.history.back).toHaveBeenCalledTimes(1);
  });
});
