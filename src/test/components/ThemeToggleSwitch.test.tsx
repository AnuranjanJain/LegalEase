import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ThemeToggleSwitch } from '../../components/ThemeToggleSwitch';

const mockToggleDarkMode = vi.fn();
const mockState = { isDarkMode: false };

vi.mock('../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({
    isDarkMode: mockState.isDarkMode,
    toggleDarkMode: mockToggleDarkMode,
  }),
}));

describe('ThemeToggleSwitch Component', () => {
  beforeEach(() => {
    mockToggleDarkMode.mockClear();
    mockState.isDarkMode = false;
  });

  it('renders a switch with role="switch"', () => {
    render(<ThemeToggleSwitch />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('has aria-checked set to false when light mode', () => {
    render(<ThemeToggleSwitch />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('has aria-checked set to true when dark mode', () => {
    mockState.isDarkMode = true;
    render(<ThemeToggleSwitch />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('has correct aria-label for light mode', () => {
    render(<ThemeToggleSwitch />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  it('has correct aria-label for dark mode', () => {
    mockState.isDarkMode = true;
    render(<ThemeToggleSwitch />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  it('calls toggleDarkMode on click', async () => {
    const user = userEvent.setup();
    render(<ThemeToggleSwitch />);
    await user.click(screen.getByRole('switch'));
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('renders Sun icon', () => {
    render(<ThemeToggleSwitch />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.innerHTML).toContain('lucide-sun');
  });

  it('renders Moon icon', () => {
    render(<ThemeToggleSwitch />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl.innerHTML).toContain('lucide-moon');
  });
});
