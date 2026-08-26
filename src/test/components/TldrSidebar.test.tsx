import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TldrSidebar } from '../../components/TldrSidebar';

describe('TldrSidebar Component', () => {
  it('renders TL;DR title and default fallback badges when no tldr data is passed', () => {
    render(<TldrSidebar />);
    expect(screen.getByTestId('tldr-sidebar')).toBeInTheDocument();
    expect(screen.getByText(/TL;DR Quick Facts/i)).toBeInTheDocument();
    
    // Check that "Not specified" fallback badges exist
    const fallbacks = screen.getAllByText(/Not specified/i);
    expect(fallbacks.length).toBeGreaterThan(0);
  });

  it('renders extracted TL;DR data points correctly when provided', () => {
    const mockTldr = {
      parties: 'Acme Corp vs John Doe',
      deadlines: 'Net 30 days',
      financials: '$50,000 upfront',
      penalties: '1.5% late fee per month',
      key_takeaways: [
        'Contract terminates on December 31, 2026',
        'Confidentiality applies for 3 years',
      ],
    };

    render(<TldrSidebar tldr={mockTldr} />);

    expect(screen.getByText('Acme Corp vs John Doe')).toBeInTheDocument();
    expect(screen.getByText('Net 30 days')).toBeInTheDocument();
    expect(screen.getByText('$50,000 upfront')).toBeInTheDocument();
    expect(screen.getByText('1.5% late fee per month')).toBeInTheDocument();
    expect(screen.getByText('Contract terminates on December 31, 2026')).toBeInTheDocument();
    expect(screen.getByText('Confidentiality applies for 3 years')).toBeInTheDocument();
  });

  it('renders loading indicator when isLoading is true', () => {
    render(<TldrSidebar isLoading={true} />);
    expect(screen.getByText(/Extracting key legal data points/i)).toBeInTheDocument();
  });
});
