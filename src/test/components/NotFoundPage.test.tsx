import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NotFoundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 404 heading', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders "Page Not Found" message', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('renders a descriptive message', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText(/doesn\u2019t exist/i)).toBeInTheDocument();
  });

  it('renders "Back to Home" button', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
  });

  it('navigates to / when "Back to Home" is clicked', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /back to home/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders LegalEase branding', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('LegalEase')).toBeInTheDocument();
  });
});
