import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 1000));
    expect(result.current).toBe('hello');
  });

  it('does not update before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 1000 } }
    );

    rerender({ value: 'world', delay: 1000 });
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe('hello');
  });

  it('updates after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 1000 } }
    );

    rerender({ value: 'world', delay: 1000 });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(result.current).toBe('world');
  });

  it('resets the timer when value changes rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 1000 } }
    );

    rerender({ value: 'b', delay: 1000 });
    act(() => { vi.advanceTimersByTime(500); });

    rerender({ value: 'c', delay: 1000 });
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('c');
  });

  it('works with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 500 } }
    );

    rerender({ value: 42, delay: 500 });
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe(42);
  });

  it('updates asynchronously when delay is 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 0 } }
    );

    rerender({ value: 'second', delay: 0 });

    act(() => { vi.advanceTimersByTime(0); });

    expect(result.current).toBe('second');
  });
});
