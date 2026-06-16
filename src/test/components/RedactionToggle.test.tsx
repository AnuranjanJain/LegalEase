/**
 * UI tests for the RedactionToggle component.
 *
 * Covers:
 *  - Default OFF state
 *  - Toggling ON / OFF
 *  - Style selector visibility when enabled
 *  - Style selection changes reflected in context
 *  - Compact mode rendering
 *  - Accessibility (role="switch", aria-checked)
 *  - localStorage persistence (context initializes from storage)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { RedactionToggle } from '../../components/RedactionToggle';
import { RedactionProvider } from '../../contexts/RedactionContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProvider(ui: React.ReactElement) {
  return render(<RedactionProvider>{ui}</RedactionProvider>);
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe('RedactionToggle — default state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the toggle in OFF state by default', () => {
    renderWithProvider(<RedactionToggle />);
    const toggle = screen.getByRole('switch', { name: /toggle pii redaction/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('does not show the "Active" badge when disabled', () => {
    renderWithProvider(<RedactionToggle />);
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument();
  });

  it('does not show style selector when disabled', () => {
    renderWithProvider(<RedactionToggle />);
    expect(screen.queryByText(/redaction token style/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Toggle behaviour
// ---------------------------------------------------------------------------

describe('RedactionToggle — toggle behaviour', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('switches to ON when clicked', () => {
    renderWithProvider(<RedactionToggle />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('shows "Active" badge after enabling', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows style selector section after enabling', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText(/redaction token style/i)).toBeInTheDocument();
  });

  it('toggles back to OFF on second click', () => {
    renderWithProvider(<RedactionToggle />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle); // ON
    fireEvent.click(toggle); // OFF
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('persists enabled state in localStorage', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));
    expect(localStorage.getItem('le_pii_redaction_enabled')).toBe('true');
  });

  it('persists disabled state in localStorage', () => {
    renderWithProvider(<RedactionToggle />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle); // ON
    fireEvent.click(toggle); // OFF
    expect(localStorage.getItem('le_pii_redaction_enabled')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// Style selector
// ---------------------------------------------------------------------------

describe('RedactionToggle — style selector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows both Bracket and Block style buttons when enabled', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));

    expect(screen.getByText('Bracket')).toBeInTheDocument();
    expect(screen.getByText('Block')).toBeInTheDocument();
  });

  it('selects bracket style by default', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));

    const bracketBtn = screen.getByRole('button', { name: /bracket/i });
    expect(bracketBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to block style on click', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));

    const blockBtn = screen.getByRole('button', { name: /block/i });
    fireEvent.click(blockBtn);
    expect(blockBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('persists style selection in localStorage', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));

    fireEvent.click(screen.getByRole('button', { name: /block/i }));
    expect(localStorage.getItem('le_pii_redaction_style')).toBe('block');
  });

  it('shows Preview section with sample redacted text', () => {
    renderWithProvider(<RedactionToggle />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText(/preview/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Compact mode
// ---------------------------------------------------------------------------

describe('RedactionToggle — compact mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders in compact mode without the full card description', () => {
    renderWithProvider(<RedactionToggle compact />);
    expect(screen.getByText(/pii redaction/i)).toBeInTheDocument();
    // Full description should not be present in compact mode
    expect(
      screen.queryByText(/automatically detects and masks/i)
    ).not.toBeInTheDocument();
  });

  it('compact toggle starts as OFF', () => {
    renderWithProvider(<RedactionToggle compact />);
    const toggle = screen.getByRole('switch', { name: /toggle pii redaction/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('compact toggle can be turned ON', () => {
    renderWithProvider(<RedactionToggle compact />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows "ON" badge in compact mode when enabled', () => {
    renderWithProvider(<RedactionToggle compact />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText('ON')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// localStorage initialisation
// ---------------------------------------------------------------------------

describe('RedactionToggle — localStorage initialisation', () => {
  it('reads initial enabled state from localStorage', () => {
    localStorage.setItem('le_pii_redaction_enabled', 'true');

    renderWithProvider(<RedactionToggle />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('reads initial style from localStorage', () => {
    localStorage.setItem('le_pii_redaction_enabled', 'true');
    localStorage.setItem('le_pii_redaction_style', 'block');

    renderWithProvider(<RedactionToggle />);
    // Style selector is visible because redaction is enabled
    const blockBtn = screen.getByRole('button', { name: /block/i });
    expect(blockBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------------------------------------------------------------------------
// Detected PII types list
// ---------------------------------------------------------------------------

describe('RedactionToggle — PII types list', () => {
  it('shows the list of detected PII categories', () => {
    renderWithProvider(<RedactionToggle />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText('SSN (US)')).toBeInTheDocument();
    expect(screen.getByText('PAN')).toBeInTheDocument();
  });
});
