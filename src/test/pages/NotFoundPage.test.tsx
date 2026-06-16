import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { NotFoundPage } from '../../pages/NotFoundPage';

describe('NotFoundPage Component', () => {
  it('renders 404 heading and descriptive text', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Case File Not Found')).toBeInTheDocument();
    expect(
      screen.getByText(/The legal document, dashboard path, or page you are looking for does not exist/i)
    ).toBeInTheDocument();
  });

  it('renders "Return Home" link pointing to the root path', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole('link', { name: /return home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('navigates back on "Go Back" button click', async () => {
    const user = userEvent.setup();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    const backButton = screen.getByRole('button', { name: /go back/i });
    await user.click(backButton);

    expect(backSpy).toHaveBeenCalled();
    backSpy.mockRestore();
  });
});
