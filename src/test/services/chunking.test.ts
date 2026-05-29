import { describe, it, expect } from 'vitest';
import { chunkText } from '../../contexts/DocumentProcessingContext';

describe('Sliding-window Text Chunking Algorithm', () => {
  it('should return empty list for undefined or empty string inputs', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('should return the original text as a single chunk if word count is less than chunkSize', () => {
    const text = 'This is a short legal document.';
    const result = chunkText(text, 10, 2);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it('should accurately split text into multiple chunks with no overlap', () => {
    // 6 words
    const text = 'one two three four five six';
    const result = chunkText(text, 2, 0); // chunk size 2, overlap 0
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('one two');
    expect(result[1]).toBe('three four');
    expect(result[2]).toBe('five six');
  });

  it('should accurately split text into multiple chunks with sliding-window overlap', () => {
    // 5 words
    const text = 'one two three four five';
    // chunk size 3, overlap 1 -> advance by 2
    // Chunk 1: index 0 to 3 -> 'one two three'
    // Next index: 3 - 1 = 2
    // Chunk 2: index 2 to 5 -> 'three four five'
    const result = chunkText(text, 3, 1);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('one two three');
    expect(result[1]).toBe('three four five');
  });

  it('should gracefully handle edge case where overlap is greater than or equal to chunkSize', () => {
    const text = 'one two three four five';
    // Overlap should be adjusted internally to chunkSize - 1
    // Chunk size 3, overlap 4 -> adjusted to 2. Advance by 1.
    const result = chunkText(text, 3, 4);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toBe('one two three');
  });

  it('should handle large texts with structural syntax spacing correctly', () => {
    const text = Array(100).fill('clause').join(' \n ');
    const result = chunkText(text, 40, 5);
    expect(result.length).toBe(3); // 100 words -> advance by 35: 0-40, 35-75, 70-100
    expect(result[0].split(' ')).toHaveLength(40);
  });
});
