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

  it('renders the social links as disabled buttons with correct labels', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // X logo button should be present with label "X"
    const xButton = screen.getByRole('button', { name: 'X' });
    expect(xButton).toBeInTheDocument();
    expect(xButton).toBeDisabled();

    // LinkedIn button should be present with label "LinkedIn"
    const linkedInButton = screen.getByRole('button', { name: 'LinkedIn' });
    expect(linkedInButton).toBeInTheDocument();
    expect(linkedInButton).toBeDisabled();
  });

  it('uses Link components with correct paths for navigation', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // Verify all footer links point to correct routes
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');

    const documentsLink = screen.getByText('Documents').closest('a');
    expect(documentsLink).toHaveAttribute('href', '/documents');

    const privacyLink = screen.getByText('Privacy Policy').closest('a');
    expect(privacyLink).toHaveAttribute('href', '/privacy');

    const termsLink = screen.getByText('Terms of Service').closest('a');
    expect(termsLink).toHaveAttribute('href', '/terms');

    const securityLink = screen.getByText('Security').closest('a');
    expect(securityLink).toHaveAttribute('href', '/security');
  });
});
