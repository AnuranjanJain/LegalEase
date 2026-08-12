import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CircularProgressRing } from '../../components/CircularProgressRing';
import { useFormProgress, FieldDefinition } from '../../hooks/useFormProgress';
import { renderHook } from '@testing-library/react';

describe('useFormProgress Hook', () => {
  it('calculates completion percentage correctly', () => {
    const fields: FieldDefinition[] = [
      { key: 'name', label: 'Name', value: 'John Doe', required: true },
      { key: 'email', label: 'Email', value: '', required: true },
      { key: 'phone', label: 'Phone', value: '1234567890', required: true },
      { key: 'notes', label: 'Notes', value: '', required: false },
    ];

    const { result } = renderHook(() => useFormProgress(fields));

    expect(result.current.totalRequired).toBe(3);
    expect(result.current.filledRequired).toBe(2);
    expect(result.current.percentage).toBe(67);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.missingRequiredKeys).toEqual(['email']);
  });

  it('handles zero total required fields gracefully without NaN', () => {
    const fields: FieldDefinition[] = [
      { key: 'optional1', label: 'Opt 1', value: '', required: false },
    ];

    const { result } = renderHook(() => useFormProgress(fields));

    expect(result.current.totalRequired).toBe(0);
    expect(result.current.filledRequired).toBe(0);
    expect(result.current.percentage).toBe(0);
    expect(result.current.isComplete).toBe(false);
  });

  it('reports 100% complete when all required fields are filled', () => {
    const fields: FieldDefinition[] = [
      { key: 'field1', label: 'Field 1', value: 'value1', required: true },
      { key: 'field2', label: 'Field 2', value: true, required: true },
    ];

    const { result } = renderHook(() => useFormProgress(fields));

    expect(result.current.totalRequired).toBe(2);
    expect(result.current.filledRequired).toBe(2);
    expect(result.current.percentage).toBe(100);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.missingRequiredKeys).toEqual([]);
  });
});

describe('CircularProgressRing Component', () => {
  it('renders progressbar role with correct ARIA attributes', () => {
    render(
      <CircularProgressRing
        filledRequired={2}
        totalRequired={4}
        label="Test Form Progress"
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('turns reassuring green and displays 100% checkmark when complete', () => {
    const { container } = render(
      <CircularProgressRing
        filledRequired={5}
        totalRequired={5}
        label="Intake Completion"
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Check SVG or class has green styling
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
    expect(circles[1].getAttribute('class')).toContain('stroke-emerald');
  });

  it('opens and closes details popover card when clicked', () => {
    render(
      <CircularProgressRing
        filledRequired={1}
        totalRequired={3}
        label="Intake Form"
        missingFieldLabels={['Email Address', 'Signer Title']}
      />
    );

    const button = screen.getByRole('progressbar');
    expect(screen.queryByTestId('progress-details-card')).not.toBeInTheDocument();

    // Click button to expand details
    fireEvent.click(button);
    expect(screen.getByTestId('progress-details-card')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Signer Title')).toBeInTheDocument();

    // Click close button inside popover card
    const closeBtn = screen.getByLabelText('Close details');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('progress-details-card')).not.toBeInTheDocument();
  });

  it('supports custom percentage override', () => {
    render(
      <CircularProgressRing
        filledRequired={0}
        totalRequired={10}
        percentage={75}
      />
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
