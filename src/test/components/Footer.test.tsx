import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Footer } from '../../components/Footer';

describe('Footer Component', () => {
  it('renders LegalEase branding and tagline', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('LegalEase.')).toBeInTheDocument();
    expect(screen.getByText(/intelligence layer/i)).toBeInTheDocument();
  });

  it('renders platform navigation links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Legal Resources')).toBeInTheDocument();
  });

  it('renders legal navigation links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders copyright with current year', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(new RegExp(`\\b${new Date().getFullYear()}\\b`))).toBeInTheDocument();
  });

  it('renders disabled social placeholders', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const xLink = screen.getByLabelText('X');
    const linkedInLink = screen.getByLabelText('LinkedIn');

    expect(xLink).toBeInTheDocument();
    expect(xLink).toHaveAttribute('href', '#');
    expect(linkedInLink).toBeInTheDocument();
    expect(linkedInLink).toHaveAttribute('href', '#');
  });
});
