/**
 * Calculates Flesch Reading Ease and Flesch-Kincaid Grade Level for a given text.
 */

export interface ReadabilityMetrics {
  readingEase: number;
  gradeLevel: number;
  difficulty: string;
}

/**
 * Counts the number of syllables in a single word using heuristic rules.
 * @param word Cleaned lowercase alphabetical word
 */
export function countSyllables(word: string): number {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanWord.length === 0) return 0;
  if (cleanWord.length <= 3) return 1;

  // Treat y as a consonant when followed by a vowel or y (e.g., beyond, employee, yellow)
  const tempWord = cleanWord.replace(/y([aeiouy])/g, '_$1');

  // Count vowel groups (a, e, i, o, u, y)
  const vowelMatches = tempWord.match(/[aeiouy]+/g);
  let count = vowelMatches ? vowelMatches.length : 0;

  // Heuristic adjustments for silent or additional endings

  // 1. Silent 'e' at the end of word (unless ends with 'le' or 'ee')
  if (cleanWord.endsWith('e') && !cleanWord.endsWith('le') && !cleanWord.endsWith('ee')) {
    count--;
  }

  // 2. Ending with 'ed' where the 'd' is silent (e.g. 'asked', 'passed' vs 'wanted', 'needed')
  if (cleanWord.endsWith('ed') && !cleanWord.endsWith('ted') && !cleanWord.endsWith('ded')) {
    if (count > 1) count--;
  }

  // 3. Ending with 'es' where it doesn't form a new syllable (e.g. 'rules', 'makes' vs 'classes', 'dishes')
  if (cleanWord.endsWith('es') && 
      !cleanWord.endsWith('ses') && 
      !cleanWord.endsWith('xes') && 
      !cleanWord.endsWith('zes') && 
      !cleanWord.endsWith('ches') && 
      !cleanWord.endsWith('shes') &&
      !cleanWord.endsWith('ies') &&
      !cleanWord.endsWith('ees')) {
    if (count > 1) count--;
  }

  return Math.max(1, count);
}

/**
 * Computes readability scores for the provided text.
 * @throws Error if text contains no readable words or sentences.
 */
export function calculateReadability(text: string): ReadabilityMetrics {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Text is empty');
  }

  // Segment sentences using typical legal and grammatical ends (. ! ?) followed by whitespace or string end.
  // We ignore abbreviations followed by dot like "vs.", "corp.", "co.", "inc.", "ltd." to minimize false sentence splitting.
  // Note: we can replace them temporarily or use a regex negative lookbehind if supported.
  // To be safe and simple across environments:
  const processedText = trimmed
    .replace(/\b(vs|corp|co|inc|ltd|e\.g|i\.e|dr|mr|ms|mrs|vol|no|art|sec|p)\./gi, '$1')
    .replace(/\.{2,}/g, '.'); // collapse multiple dots like ellipses

  const sentences = processedText.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;

  // Extract all alphabetical word tokens (ignoring numbers, pure symbols/punctuation)
  const words = processedText.match(/[a-zA-Z'\u00C0-\u00FF]+/g) || [];
  const wordCount = words.length;

  if (wordCount === 0 || sentenceCount === 0) {
    throw new Error('Readability metrics unavailable due to lack of word/sentence structure');
  }

  // Count total syllables in all word tokens
  let syllableCount = 0;
  for (const word of words) {
    syllableCount += countSyllables(word);
  }

  // Flesch Reading Ease Formula:
  // 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  const readingEaseRaw = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  // Clamp to standard [0, 100] range
  const readingEase = Math.round(Math.max(0, Math.min(100, readingEaseRaw)));

  // Flesch-Kincaid Grade Level Formula:
  // 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
  const gradeLevelRaw = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  // Clamp lower bound to 0
  const gradeLevel = Math.round(Math.max(0, gradeLevelRaw));

  // Difficulty Mapping:
  // Reading Ease >= 90 -> Very Easy
  // 80-89 -> Easy
  // 70-79 -> Fairly Easy
  // 60-69 -> Standard
  // 50-59 -> Fairly Difficult
  // 30-49 -> Difficult
  // 0-29 -> Very Difficult
  let difficulty = 'Very Difficult';
  if (readingEase >= 90) {
    difficulty = 'Very Easy';
  } else if (readingEase >= 80) {
    difficulty = 'Easy';
  } else if (readingEase >= 70) {
    difficulty = 'Fairly Easy';
  } else if (readingEase >= 60) {
    difficulty = 'Standard';
  } else if (readingEase >= 50) {
    difficulty = 'Fairly Difficult';
  } else if (readingEase >= 30) {
    difficulty = 'Difficult';
  }

  return {
    readingEase,
    gradeLevel,
    difficulty,
  };
}
