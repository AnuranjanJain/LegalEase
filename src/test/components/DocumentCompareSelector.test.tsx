/**
 * Unit + integration tests for DocumentCompareSelector.
 *
 * Covers:
 *  - Renders nothing when no documents are selected
 *  - Shows selection count badge
 *  - Shows document name chips for each selected doc
 *  - Minimum-2 hint shown when only 1 doc is selected
 *  - Compare button disabled when fewer than 2 docs selected
 *  - Compare button enabled when 2+ docs selected
 *  - Clicking a chip's X button fires onToggle with the correct id
 *  - Clicking "Clear all" fires onClear
 *  - Clicking "Compare Documents" fires onCompare with selected ids
 *  - Accessibility: region label, aria-disabled, aria-label on chips
 *  - Gracefully skips unknown IDs (not found in allDocuments)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocumentCompareSelector } from '../../components/DocumentCompareSelector';
import { Document } from '../../services/storage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDoc = (id: string, name: string, status: Document['status'] = 'processed'): Document => ({
  id,
  name,
  type: 'pdf',
  size: 1000,
  uploadDate: new Date().toISOString(),
  status,
});

const DOC_A = makeDoc('doc_a', 'NDA.pdf');
const DOC_B = makeDoc('doc_b', 'Employment Agreement.docx');
const DOC_C = makeDoc('doc_c', 'Service Contract.pdf');
const ALL_DOCS = [DOC_A, DOC_B, DOC_C];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Props {
  selectedIds?: string[];
  allDocuments?: Document[];
  onToggle?: (id: string) => void;
  onClear?: () => void;
  onCompare?: (ids: string[]) => void;
}

function renderSelector(overrides: Props = {}) {
  const props = {
    allDocuments: ALL_DOCS,
    selectedIds: [],
    onToggle: vi.fn(),
    onClear: vi.fn(),
    onCompare: vi.fn(),
    ...overrides,
  };
  return { ...render(<DocumentCompareSelector {...props} />), props };
}

// ---------------------------------------------------------------------------
// Visibility — renders nothing when selection is empty
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — empty state', () => {
  it('renders nothing when no documents are selected', () => {
    const { container } = renderSelector({ selectedIds: [] });
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selection count
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — selection count', () => {
  it('shows "1 selected" with one document selected', () => {
    renderSelector({ selectedIds: ['doc_a'] });
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  it('shows "2 selected" with two documents selected', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b'] });
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });

  it('shows "3 selected" with three documents selected', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b', 'doc_c'] });
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Document name chips
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — document chips', () => {
  it('renders a chip for each selected document', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b'] });
    expect(screen.getByText('NDA.pdf')).toBeInTheDocument();
    expect(screen.getByText('Employment Agreement.docx')).toBeInTheDocument();
  });

  it('does NOT render chips for unselected documents', () => {
    renderSelector({ selectedIds: ['doc_a'] });
    expect(screen.queryByText('Employment Agreement.docx')).not.toBeInTheDocument();
  });

  it('gracefully skips IDs not found in allDocuments', () => {
    // Should render without crashing, showing only valid docs
    renderSelector({ selectedIds: ['doc_a', 'unknown_id_xyz'] });
    expect(screen.getByText('NDA.pdf')).toBeInTheDocument();
    // No chip for the unknown ID
    expect(screen.queryByText('unknown_id_xyz')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Minimum-2 hint
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — minimum selection hint', () => {
  it('shows "Select at least 2" hint when only 1 doc is selected', () => {
    renderSelector({ selectedIds: ['doc_a'] });
    expect(screen.getByText(/select at least 2/i)).toBeInTheDocument();
  });

  it('does NOT show the hint when 2+ docs are selected', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b'] });
    expect(screen.queryByText(/select at least 2/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Compare button state
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — Compare button', () => {
  it('is disabled (aria-disabled=true) when only 1 doc is selected', () => {
    renderSelector({ selectedIds: ['doc_a'] });
    // When disabled the button aria-label describes what the user needs to do
    const btn = screen.getByRole('button', { name: /select at least 2 documents to compare/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toBeDisabled();
  });

  it('is enabled when exactly 2 docs are selected', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b'] });
    const btn = screen.getByRole('button', { name: /compare 2 selected documents/i });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'false');
  });

  it('is enabled when 3 docs are selected', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b', 'doc_c'] });
    const btn = screen.getByRole('button', { name: /compare 3 selected documents/i });
    expect(btn).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Interaction — chip removal
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — chip removal', () => {
  it('calls onToggle with the correct id when a chip X is clicked', () => {
    const onToggle = vi.fn();
    renderSelector({ selectedIds: ['doc_a', 'doc_b'], onToggle });

    const removeBtn = screen.getByRole('button', { name: /remove nda\.pdf from selection/i });
    fireEvent.click(removeBtn);

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith('doc_a');
  });

  it('calls onToggle for the correct doc when multiple chips are present', () => {
    const onToggle = vi.fn();
    renderSelector({ selectedIds: ['doc_a', 'doc_b', 'doc_c'], onToggle });

    fireEvent.click(screen.getByRole('button', { name: /remove service contract\.pdf from selection/i }));
    expect(onToggle).toHaveBeenCalledWith('doc_c');
  });
});

// ---------------------------------------------------------------------------
// Interaction — clear all
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — clear all', () => {
  it('calls onClear when "Clear all" is clicked', () => {
    const onClear = vi.fn();
    renderSelector({ selectedIds: ['doc_a', 'doc_b'], onClear });

    fireEvent.click(screen.getByRole('button', { name: /clear all document selections/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Interaction — compare trigger
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — compare trigger', () => {
  it('calls onCompare with the selected IDs when Compare is clicked', () => {
    const onCompare = vi.fn();
    renderSelector({ selectedIds: ['doc_a', 'doc_b'], onCompare });

    fireEvent.click(screen.getByRole('button', { name: /compare 2 selected documents/i }));
    expect(onCompare).toHaveBeenCalledOnce();
    expect(onCompare).toHaveBeenCalledWith(['doc_a', 'doc_b']);
  });

  it('passes all selected IDs in order to onCompare', () => {
    const onCompare = vi.fn();
    renderSelector({ selectedIds: ['doc_c', 'doc_a', 'doc_b'], onCompare });

    fireEvent.click(screen.getByRole('button', { name: /compare 3 selected documents/i }));
    expect(onCompare).toHaveBeenCalledWith(['doc_c', 'doc_a', 'doc_b']);
  });

  it('does NOT call onCompare when button is disabled', () => {
    const onCompare = vi.fn();
    renderSelector({ selectedIds: ['doc_a'], onCompare });

    // When disabled the button's aria-label says "Select at least 2 documents to compare"
    fireEvent.click(screen.getByRole('button', { name: /select at least 2 documents to compare/i }));
    expect(onCompare).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('DocumentCompareSelector — accessibility', () => {
  it('renders with a region role and descriptive aria-label', () => {
    renderSelector({ selectedIds: ['doc_a', 'doc_b'] });
    expect(
      screen.getByRole('region', { name: /document comparison selection bar/i })
    ).toBeInTheDocument();
  });

  it('chip remove buttons have descriptive aria-labels', () => {
    renderSelector({ selectedIds: ['doc_a'] });
    expect(
      screen.getByRole('button', { name: /remove nda\.pdf from selection/i })
    ).toBeInTheDocument();
  });
});
