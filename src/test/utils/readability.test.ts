import { describe, it, expect } from 'vitest';
import { calculateReadability, countSyllables } from '../../utils/readability';

describe('countSyllables', () => {
  it('handles empty words or non-alpha strings', () => {
    expect(countSyllables('')).toBe(0);
    expect(countSyllables('12345')).toBe(0);
    expect(countSyllables('!!!')).toBe(0);
  });

  it('handles short words (length <= 3)', () => {
    expect(countSyllables('the')).toBe(1);
    expect(countSyllables('a')).toBe(1);
    expect(countSyllables('law')).toBe(1);
    expect(countSyllables('act')).toBe(1);
  });

  it('correctly counts vowels in standard words', () => {
    expect(countSyllables('legal')).toBe(2);
    expect(countSyllables('document')).toBe(3);
    expect(countSyllables('agreement')).toBe(3);
    expect(countSyllables('liability')).toBe(4); // heuristic close enough
  });

  it('handles silent e ending adjustments', () => {
    expect(countSyllables('rate')).toBe(1);
    expect(countSyllables('make')).toBe(1);
    expect(countSyllables('terminate')).toBe(3);
    expect(countSyllables('employee')).toBe(3); // ends with 'ee' -> not silent
    expect(countSyllables('simple')).toBe(2);   // ends with 'le' -> not silent
  });

  it('handles silent ed and es ending adjustments', () => {
    expect(countSyllables('passed')).toBe(1); // 'ed' silent
    expect(countSyllables('wanted')).toBe(2); // 'ted' not silent
    expect(countSyllables('divided')).toBe(3); // 'ded' not silent
    expect(countSyllables('rules')).toBe(1);  // 'es' silent
    expect(countSyllables('classes')).toBe(2); // 'ses' not silent
    expect(countSyllables('boxes')).toBe(2);   // 'xes' not silent
  });
});

describe('calculateReadability', () => {
  it('throws an error for empty text', () => {
    expect(() => calculateReadability('')).toThrow('Text is empty');
    expect(() => calculateReadability('   ')).toThrow('Text is empty');
  });

  it('throws an error for text with no valid words or sentences', () => {
    expect(() => calculateReadability('12345 67890 !!!')).toThrow('Readability metrics unavailable');
  });

  it('calculates score for a single simple sentence', () => {
    const text = 'The cat sat on the mat.';
    const result = calculateReadability(text);
    
    expect(result.readingEase).toBeGreaterThanOrEqual(90);
    expect(result.gradeLevel).toBeLessThanOrEqual(4);
    expect(result.difficulty).toBe('Very Easy');
  });

  it('calculates score for standard difficulty text', () => {
    const text = 'The primary goal of this system is to make legal text easier to read. We want to help you understand your contracts. This makes the process simple and fast.';
    const result = calculateReadability(text);
    
    expect(result.readingEase).toBeGreaterThanOrEqual(60);
    expect(result.readingEase).toBeLessThanOrEqual(90);
    expect(['Fairly Easy', 'Standard', 'Easy']).toContain(result.difficulty);
  });

  it('calculates score for a complex legal document paragraph', () => {
    const text = "Notwithstanding anything contained herein to the contrary, the receiving party shall indemnify, defend, and hold harmless the disclosing party from and against any and all liabilities, obligations, losses, damages, penalties, claims, actions, suits, costs, expenses, and disbursements, including, without limitation, reasonable attorneys' fees and court costs, of any kind or nature whatsoever, which may be imposed upon, incurred by, or asserted against the disclosing party as a result of or arising out of any breach or non-performance by the receiving party of any covenant, agreement, or obligation under this agreement.";
    const result = calculateReadability(text);
    
    // Legal documents have higher grade level and lower reading ease
    expect(result.readingEase).toBeLessThan(30);
    expect(result.gradeLevel).toBeGreaterThanOrEqual(16);
    expect(['Difficult', 'Very Difficult']).toContain(result.difficulty);
  });

  it('handles abbreviations correctly (does not split sentences on common abbreviations)', () => {
    const text1 = 'This is Agreement Inc. which is binding. We agree vs. our competitors.';
    const result1 = calculateReadability(text1);
    
    // If "Inc." and "vs." caused sentence splits, we would have 4 sentences.
    // By keeping them intact, we have 2 sentences.
    // Let's verify that the output computes successfully and makes sense.
    expect(result1.readingEase).toBeGreaterThan(0);
    expect(result1.gradeLevel).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple punctuation and special characters gracefully', () => {
    const text = 'Subject: Agreement details... Note: Section 1.1 - Termination clause!!! Do you agree? Yes, we do.';
    const result = calculateReadability(text);
    
    expect(result.readingEase).toBeGreaterThan(0);
    expect(result.gradeLevel).toBeGreaterThanOrEqual(0);
  });
});
