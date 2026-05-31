import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NotFoundPage Component', () => {
  it('renders 404 header and Page Not Found text', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /404/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /page not found/i })).toBeInTheDocument();
    expect(
      screen.getByText(/the page you are looking for doesn’t exist or may have been moved/i)
    ).toBeInTheDocument();
  });

  it('updates the document title on mount', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(document.title).toBe('404 - Page Not Found');
  });

  it('navigates to "/" when clicking "Back to Home" button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const backToHomeBtn = screen.getByRole('button', { name: /back to home/i });
    await user.click(backToHomeBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to -1 when clicking "Go Back" button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const goBackBtn = screen.getByRole('button', { name: /go back/i });
    await user.click(goBackBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
