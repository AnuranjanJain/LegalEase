import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReadabilityScore } from '../../components/ReadabilityScore';

describe('ReadabilityScore Component', () => {
  it('renders "Readability metrics unavailable." when texts are empty', () => {
    render(<ReadabilityScore originalText="" summaryText="" />);
    expect(screen.getByText('Readability metrics unavailable.')).toBeInTheDocument();
  });

  it('renders fallback alert when calculation fails (e.g. no valid words)', () => {
    render(<ReadabilityScore originalText="123 456" summaryText="!!!" />);
    expect(screen.getByText('Readability metrics unavailable.')).toBeInTheDocument();
  });

  it('renders original vs. summary score details when valid text is provided', () => {
    const originalText = 'Notwithstanding anything contained herein to the contrary, the receiving party shall indemnify, defend, and hold harmless the disclosing party from and against any and all liabilities, obligations, losses, damages, penalties, claims, actions, suits, costs, expenses, and disbursements, including, without limitation, reasonable attorneys\' fees and court costs, of any kind or nature whatsoever, which may be imposed upon, incurred by, or asserted against the disclosing party as a result of or arising out of any breach or non-performance by the receiving party of any covenant, agreement, or obligation under this agreement.';
    const summaryText = 'The primary goal of this system is to make legal text easier to read. We want to help you understand your contracts. This makes the process simple and fast.';

    render(<ReadabilityScore originalText={originalText} summaryText={summaryText} />);

    // Titles
    expect(screen.getByText('Readability Analysis')).toBeInTheDocument();
    expect(screen.getByText('Original Document')).toBeInTheDocument();
    expect(screen.getByText('AI Summary')).toBeInTheDocument();

    // Verify progress bars exist for original and summary
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);

    // Verify progress bars have correct aria-valuenow attributes
    const originalProgress = progressBars[0];
    const summaryProgress = progressBars[1];

    const originalVal = Number(originalProgress.getAttribute('aria-valuenow'));
    const summaryVal = Number(summaryProgress.getAttribute('aria-valuenow'));

    // Original is difficult, so Reading Ease should be low
    expect(originalVal).toBeLessThan(40);
    // Summary is easy, so Reading Ease should be high
    expect(summaryVal).toBeGreaterThanOrEqual(70);

    // Verify improvement badges appear
    expect(screen.getByText(/Improved by \d+ Grade Levels?/)).toBeInTheDocument();
    expect(screen.getByText(/\d+% Easier to Read/)).toBeInTheDocument();
  });

  it('renders correct change details when no improvement is present', () => {
    // Both texts are exactly the same
    const text = 'The primary goal of this system is to make legal text easier to read.';
    render(<ReadabilityScore originalText={text} summaryText={text} />);

    expect(screen.getByText('No change in readability metrics.')).toBeInTheDocument();
  });
});
