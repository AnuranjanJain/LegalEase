import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import LegaleseSimplifier from '../../components/LegaleseSimplifier';

describe('LegaleseSimplifier', () => {
  const sampleText =
    'The party must comply with the Subpoena issued under Force Majeure conditions. An Affidavit was submitted.';

  it('renders normal text without modifying string structure', () => {
    render(<LegaleseSimplifier text="This is standard plain text with no legal terms." />);
    expect(screen.getByText('This is standard plain text with no legal terms.')).toBeInTheDocument();
  });

  it('identifies legal terms and applies dashed underline button formatting', () => {
    render(<LegaleseSimplifier text={sampleText} />);

    const subpoenaBtn = screen.getByRole('button', { name: 'Subpoena' });
    const forceMajeureBtn = screen.getByRole('button', { name: 'Force Majeure' });
    const affidavitBtn = screen.getByRole('button', { name: 'Affidavit' });

    expect(subpoenaBtn).toBeInTheDocument();
    expect(forceMajeureBtn).toBeInTheDocument();
    expect(affidavitBtn).toBeInTheDocument();

    expect(subpoenaBtn).toHaveClass('underline', 'decoration-dashed');
  });

  it('shows tooltip on mouse hover and hides on mouse leave', async () => {
    render(<LegaleseSimplifier text="A Subpoena was issued." />);

    const termBtn = screen.getByRole('button', { name: 'Subpoena' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Hover over term
    fireEvent.mouseEnter(termBtn.parentElement || termBtn);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/formal written order issued by a court/i)).toBeInTheDocument();

    // Leave mouse
    fireEvent.mouseLeave(termBtn.parentElement || termBtn);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on click/tap and closes on click outside', async () => {
    render(
      <div>
        <LegaleseSimplifier text="A Subpoena was issued." />
        <div data-testid="outside">Outside area</div>
      </div>
    );

    const termBtn = screen.getByRole('button', { name: 'Subpoena' });

    // Click term
    fireEvent.click(termBtn);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(termBtn).toHaveAttribute('aria-expanded', 'true');

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(termBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports keyboard navigation (Enter/Space to toggle, Escape to close)', async () => {
    render(<LegaleseSimplifier text="Subject to Force Majeure." />);

    const termBtn = screen.getByRole('button', { name: 'Force Majeure' });

    // Focus and press Enter
    termBtn.focus();
    expect(termBtn).toHaveFocus();
    fireEvent.keyDown(termBtn, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('respects word boundaries so substrings are not wrongly matched', () => {
    // "tort" should not match inside "distortion"
    render(<LegaleseSimplifier text="The distortion of facts is unacceptable." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('The distortion of facts is unacceptable.')).toBeInTheDocument();
  });

  it('handles custom dictionary passed via props', () => {
    const customDict = {
      CustomTerm: 'A custom test definition for a legal term.',
    };

    render(
      <LegaleseSimplifier
        text="This contains a CustomTerm inside."
        dictionary={customDict}
      />
    );

    const customBtn = screen.getByRole('button', { name: 'CustomTerm' });
    expect(customBtn).toBeInTheDocument();

    fireEvent.click(customBtn);
    expect(screen.getByText('A custom test definition for a legal term.')).toBeInTheDocument();
  });

  it('handles null/empty text gracefully', () => {
    const { container } = render(<LegaleseSimplifier text="" />);
    expect(container.firstChild).toBeNull();
  });
});
