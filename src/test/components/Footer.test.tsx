import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Footer } from '../../components/Footer';

describe('Footer Component', () => {
  it('renders copyright and brand name', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText(/LegalEase\./i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`\\b${new Date().getFullYear()}\\b`))).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });

  it('renders the social links with the correct labels', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // X logo link should be present with label "X"
    const xLink = screen.getByLabelText('X');
    expect(xLink).toBeInTheDocument();
    expect(xLink).toHaveAttribute('href', '#');

    // LinkedIn link should be present with label "LinkedIn"
    const linkedInLink = screen.getByLabelText('LinkedIn');
    expect(linkedInLink).toBeInTheDocument();
    expect(linkedInLink).toHaveAttribute('href', '#');
  });
});
