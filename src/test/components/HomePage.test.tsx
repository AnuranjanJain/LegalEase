import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '../../pages/HomePage';

describe('HomePage Component', () => {
  it('renders hero section, badge, and trust metrics', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Hero section title
    expect(screen.getByRole('heading', { level: 1, name: /simplify complex/i })).toBeInTheDocument();
    
    // Feature Badge
    expect(screen.getByText('Next-Gen Legal AI Assistant')).toBeInTheDocument();

    // Trust metrics
    expect(screen.getByText('99.4%')).toBeInTheDocument();
    expect(screen.getByText('AI Accuracy Rate')).toBeInTheDocument();
    expect(screen.getByText('50k+')).toBeInTheDocument();
  });

  it('renders CTA buttons with correct navigation paths', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const getStartedLink = screen.getByRole('link', { name: /get started free/i });
    expect(getStartedLink).toHaveAttribute('href', '/documents');

    const tryChatbotLink = screen.getByRole('link', { name: /try live chatbot/i });
    expect(tryChatbotLink).toHaveAttribute('href', '/chatbot');
  });

  it('toggles interactive AI demo clause tabs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Default active tab should be Termination
    expect(screen.getByText(/This Agreement may be terminated by either party/i)).toBeInTheDocument();

    // Switch to Indemnity tab
    const indemnityTab = screen.getByRole('button', { name: /indemnity/i });
    await act(async () => {
      await user.click(indemnityTab);
    });

    expect(screen.getByText(/Contractor agrees to defend, indemnify, and hold harmless/i)).toBeInTheDocument();
    expect(screen.getByText(/BROAD LIABILITY/i)).toBeInTheDocument();

    // Switch to IP Assignment tab
    const ipTab = screen.getByRole('button', { name: /ip assignment/i });
    await act(async () => {
      await user.click(ipTab);
    });

    expect(screen.getByText(/All deliverables, materials, inventions, and work product/i)).toBeInTheDocument();
    expect(screen.getByText(/FULL TRANSFER/i)).toBeInTheDocument();
  });

  it('toggles FAQ accordion items to expand/collapse', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Get an FAQ question button
    const faqQuestion = screen.getByRole('button', { name: /how does legalease simplify legal jargon/i });
    
    // Initially, the answer should be collapsed (the container has max-h-0 class)
    const faqAnswer = screen.getByText(/uses state-of-the-art NLP and large language models/i);
    const parentContainer = faqAnswer.closest('div');
    expect(parentContainer).toHaveClass('max-h-0');

    // Click to expand
    await act(async () => {
      await user.click(faqQuestion);
    });
    
    expect(parentContainer).toHaveClass('max-h-40');

    // Click again to collapse
    await act(async () => {
      await user.click(faqQuestion);
    });

    expect(parentContainer).toHaveClass('max-h-0');
  });
});
