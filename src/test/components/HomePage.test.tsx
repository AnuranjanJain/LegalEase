import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '../../pages/HomePage';

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the hero heading', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/Simplify Complex/i)).toBeInTheDocument();
  });

  it('renders "Get Started Free" CTA link', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('Get Started Free')).toBeInTheDocument();
  });

  it('renders "Try Live Chatbot" CTA link', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('Try Live Chatbot')).toBeInTheDocument();
  });

  it('renders the demo clause tabs', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('Termination')).toBeInTheDocument();
    expect(screen.getByText('Indemnity')).toBeInTheDocument();
    expect(screen.getByText('IP Assignment')).toBeInTheDocument();
  });

  it('switches demo clause on tab click', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await user.click(screen.getByText('Indemnity'));
    expect(screen.getByText(/BROAD LIABILITY/i)).toBeInTheDocument();
  });

  it('renders FAQ section', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/simplify legal jargon/i)).toBeInTheDocument();
    expect(screen.getByText(/stored securely/i)).toBeInTheDocument();
    expect(screen.getByText(/document formats/i)).toBeInTheDocument();
    expect(screen.getByText(/risk audit parameters/i)).toBeInTheDocument();
  });

  it('expands FAQ item on click', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const faqButton = screen.getByText(/simplify legal jargon/i);
    await user.click(faqButton);
    expect(screen.getByText(/large language models/i)).toBeInTheDocument();
  });

  it('renders trust metrics section', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/AI Accuracy Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit Response Time/i)).toBeInTheDocument();
  });

  it('renders features section', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/Advanced Tools/i)).toBeInTheDocument();
  });

  it('renders the contract excerpt in the demo panel', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/This Agreement may be terminated/i)).toBeInTheDocument();
  });
});
