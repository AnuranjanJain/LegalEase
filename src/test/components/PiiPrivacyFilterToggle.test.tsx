import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RedactionProvider } from '../../contexts/RedactionContext';
import { PiiPrivacyFilterToggle } from '../../components/PiiPrivacyFilterToggle';

function renderWithProvider(ui: React.ReactElement) {
  return render(<RedactionProvider>{ui}</RedactionProvider>);
}

describe('PiiPrivacyFilterToggle Component', () => {
  it('renders switch toggle with label "Auto-Redact Sensitive Info"', () => {
    renderWithProvider(<PiiPrivacyFilterToggle />);
    const toggle = screen.getByRole('switch', { name: /Auto-Redact Sensitive Info/i });
    expect(toggle).toBeInTheDocument();
  });

  it('toggles active state when clicked', () => {
    renderWithProvider(<PiiPrivacyFilterToggle />);
    const toggle = screen.getByRole('switch', { name: /Auto-Redact Sensitive Info/i });

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('displays client-side protection details when enabled', () => {
    renderWithProvider(<PiiPrivacyFilterToggle showDetails={true} />);
    const toggle = screen.getByRole('switch', { name: /Auto-Redact Sensitive Info/i });

    fireEvent.click(toggle);
    expect(screen.getByText(/Client-side redaction ensures PII never hits the backend server/i)).toBeInTheDocument();
  });
});
