import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from '../../components/Footer';

describe('Footer', () => {
  it('renders LegalEase branding', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText('LegalEase.')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText(/intelligence layer/i)).toBeInTheDocument();
  });

  it('renders Platform section links', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('AI Chatbot')).toBeInTheDocument();
  });

  it('renders Legal section links', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders copyright with current year', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(year.toString()))).toBeInTheDocument();
  });

  it('renders social media links', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const twitterLink = screen.getByLabelText('X');
    const linkedinLink = screen.getByLabelText('LinkedIn');
    expect(twitterLink).toBeInTheDocument();
    expect(linkedinLink).toBeInTheDocument();
    expect(twitterLink).toHaveAttribute('href', '#');
    expect(linkedinLink).toHaveAttribute('href', '#');
  });
});
