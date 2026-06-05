import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClauseAnalysisSection } from '../../components/ClauseAnalysisSection';
import { ClauseAnalysis } from '../../services/storage';

describe('ClauseAnalysisSection Component', () => {
  it('renders nothing when clauses list is empty or undefined', () => {
    const { container } = render(<ClauseAnalysisSection clauses={[]} />);
    expect(container.firstChild).toBeNull();

    const { container: containerUndefined } = render(<ClauseAnalysisSection clauses={undefined} />);
    expect(containerUndefined.firstChild).toBeNull();
  });

  it('renders clauses with risk badges and explanations correctly', () => {
    const sampleClauses: ClauseAnalysis[] = [
      {
        clause: 'The company may terminate this agreement at any time without notice.',
        riskLevel: 'High',
        riskReason: 'Allows one party to terminate the agreement without notice.'
      },
      {
        clause: 'This agreement is governed by the laws of Delaware.',
        riskLevel: 'Low',
        riskReason: 'Standard boilerplate governing law clause.'
      }
    ];

    render(<ClauseAnalysisSection clauses={sampleClauses} />);

    // Header exists
    expect(screen.getByText('Clause-Level Risk Assessment')).toBeInTheDocument();

    // Badges exist
    expect(screen.getByText('[HIGH RISK]')).toBeInTheDocument();
    expect(screen.getByText('[LOW RISK]')).toBeInTheDocument();

    // Explanations exist
    expect(screen.getByText('Allows one party to terminate the agreement without notice.')).toBeInTheDocument();
    expect(screen.getByText('Standard boilerplate governing law clause.')).toBeInTheDocument();

    // Clauses exist
    expect(screen.getByText(/The company may terminate this agreement/i)).toBeInTheDocument();
    expect(screen.getByText(/This agreement is governed by the laws of Delaware/i)).toBeInTheDocument();
  });
});
