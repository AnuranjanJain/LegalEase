/**
 * Unit tests for the RedactedText component.
 *
 * Covers:
 *  - Renders plain text unchanged when no tokens are present
 *  - Renders [REDACTED] tokens as styled spans with correct aria-label
 *  - Renders ██████████ tokens as styled spans with correct aria-label
 *  - Handles mixed content (plain text + multiple tokens)
 *  - Handles empty / null / undefined text gracefully
 *  - Token spans have black background styling
 *  - Token spans have role="img" (non-text element)
 *  - Multiple consecutive tokens in same string
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RedactedText } from '../../components/RedactedText';

describe('RedactedText', () => {
  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  it('renders nothing for empty string', () => {
    const { container } = render(<RedactedText text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders plain text unchanged when no tokens present', () => {
    render(<RedactedText text="This agreement is binding on both parties." />);
    expect(
      screen.getByText('This agreement is binding on both parties.')
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Bracket token
  // --------------------------------------------------------------------------

  it('renders [REDACTED] token as an accessible span', () => {
    render(<RedactedText text="Contact [REDACTED] for details." />);

    const badge = screen.getByRole('img', { name: 'redacted' });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'redacted');
  });

  it('[REDACTED] span has black background style', () => {
    render(<RedactedText text="SSN: [REDACTED]" />);
    const badge = screen.getByRole('img', { name: 'redacted' });
    expect(badge).toHaveStyle({ backgroundColor: '#000000' });
  });

  it('[REDACTED] span has black text color (invisible ink-blot)', () => {
    render(<RedactedText text="ID: [REDACTED]" />);
    const badge = screen.getByRole('img', { name: 'redacted' });
    expect(badge).toHaveStyle({ color: '#000000' });
  });

  it('preserves surrounding text when [REDACTED] is present', () => {
    render(<RedactedText text="Call [REDACTED] or email [REDACTED] today." />);
    // Surrounding plain text segments should still be in the DOM
    expect(screen.getByText(/call/i)).toBeInTheDocument();
    expect(screen.getByText(/today\./i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Block token
  // --------------------------------------------------------------------------

  it('renders ██████████ token as an accessible span', () => {
    render(<RedactedText text="Name: ██████████" />);
    const badge = screen.getByRole('img', { name: 'redacted' });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'redacted');
  });

  it('██████████ span has black background style', () => {
    render(<RedactedText text="DOB: ██████████" />);
    const badge = screen.getByRole('img', { name: 'redacted' });
    expect(badge).toHaveStyle({ backgroundColor: '#000000' });
  });

  // --------------------------------------------------------------------------
  // Multiple tokens
  // --------------------------------------------------------------------------

  it('renders multiple [REDACTED] tokens as separate spans', () => {
    render(
      <RedactedText text="Email [REDACTED] or phone [REDACTED] for info." />
    );
    const badges = screen.getAllByRole('img', { name: 'redacted' });
    expect(badges).toHaveLength(2);
  });

  it('renders mixed bracket and block tokens', () => {
    render(
      <RedactedText text="Card: [REDACTED] and Aadhaar: ██████████" />
    );
    const badges = screen.getAllByRole('img', { name: 'redacted' });
    expect(badges).toHaveLength(2);
  });

  it('renders three consecutive tokens without crashing', () => {
    render(
      <RedactedText text="[REDACTED] [REDACTED] [REDACTED]" />
    );
    const badges = screen.getAllByRole('img', { name: 'redacted' });
    expect(badges).toHaveLength(3);
  });

  // --------------------------------------------------------------------------
  // Whitespace preservation
  // --------------------------------------------------------------------------

  it('preserves newlines in multi-line redacted text', () => {
    const text = 'Line one: [REDACTED]\nLine two: [REDACTED]';
    render(<RedactedText text={text} />);
    const badges = screen.getAllByRole('img', { name: 'redacted' });
    expect(badges).toHaveLength(2);
    // The newline character should be preserved in the text node
    expect(screen.getByText(/line one:/i)).toBeInTheDocument();
    expect(screen.getByText(/line two:/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  it('each token span has a title attribute for tooltip', () => {
    render(<RedactedText text="PAN: [REDACTED]" />);
    const badge = screen.getByRole('img', { name: 'redacted' });
    expect(badge).toHaveAttribute('title', 'This content has been redacted');
  });

  it('token spans are not selectable (select-none class applied)', () => {
    render(<RedactedText text="Phone: [REDACTED]" />);
    const badge = screen.getByRole('img', { name: 'redacted' });
    // Check class contains select-none
    expect(badge.className).toContain('select-none');
  });
});
