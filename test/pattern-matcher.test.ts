/**
 * Corgi v3 - Pattern Matcher Tests
 */

import { describe, it, expect } from 'vitest';
import {
  matchesPattern,
  calculateConfidence,
  matchPatterns,
  deduplicateMatches,
} from '../src/pattern-matcher';
import type { Lookup, PatternMatch } from '../src/types';

describe('Pattern Matching', () => {
  describe('matchesPattern', () => {
    it('should match exact patterns', () => {
      expect(matchesPattern('ABC', 'ABC')).toBe(true);
      expect(matchesPattern('ABC', 'ABD')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(matchesPattern('ABC', 'A*C')).toBe(true);
      expect(matchesPattern('ABC', '***')).toBe(true);
      expect(matchesPattern('ABC', 'A**')).toBe(true);
    });

    it('should match character range patterns', () => {
      expect(matchesPattern('ABC', 'A[A-Z]C')).toBe(true);
      expect(matchesPattern('A5C', 'A[1-9]C')).toBe(true);
      expect(matchesPattern('A0C', 'A[1-9]C')).toBe(false);
    });

    it('should match character class patterns', () => {
      expect(matchesPattern('ABC', 'A[BC]C')).toBe(true);
      expect(matchesPattern('ACC', 'A[BC]C')).toBe(true);
      expect(matchesPattern('ADC', 'A[BC]C')).toBe(false);
    });

    it('should handle VIS patterns with pipe separator', () => {
      expect(matchesPattern('U', '*****|*U')).toBe(true);
      expect(matchesPattern('A', '*****|*U')).toBe(false);
      expect(matchesPattern('X', '*****|**')).toBe(true); // wildcard
    });
  });

  describe('calculateConfidence', () => {
    it('should return 1.0 for exact match', () => {
      expect(calculateConfidence('ABC', 'ABC')).toBe(1.0);
    });

    it('should return lower confidence for wildcard patterns', () => {
      const exact = calculateConfidence('ABC', 'ABC');
      const wildcard = calculateConfidence('ABC', 'A**');
      expect(wildcard).toBeLessThan(exact);
    });

    it('should return 0 for non-matching patterns', () => {
      expect(calculateConfidence('ABC', 'XYZ')).toBe(0);
    });

    it('should handle VIS patterns', () => {
      expect(calculateConfidence('U', '*****|*U')).toBe(1.0);
      expect(calculateConfidence('X', '*****|**')).toBe(0.8); // wildcard
    });
  });

  describe('matchPatterns', () => {
    const lookups: Lookup[] = [
      { pattern: 'AB*', elementCode: 'Model', resolved: 'Camry', weight: 99 },
      { pattern: 'ABC', elementCode: 'Model', resolved: 'Camry LE', weight: 99 },
      { pattern: 'A**', elementCode: 'Series', resolved: 'Base', weight: 50 },
      { pattern: 'XYZ', elementCode: 'Model', resolved: 'Other', weight: 99 },
    ];

    it('should match patterns and return sorted results', () => {
      const matches = matchPatterns(lookups, 'ABC123', '45678901');

      expect(matches.length).toBeGreaterThan(0);
      // Exact match should have higher confidence
      const camryLE = matches.find(m => m.value === 'Camry LE');
      const camry = matches.find(m => m.value === 'Camry');
      expect(camryLE?.confidence).toBeGreaterThan(camry?.confidence || 0);
    });

    it('should filter by confidence threshold', () => {
      const matches = matchPatterns(lookups, 'ABC123', '45678901', 0.9);

      // Only exact or near-exact matches should pass high threshold
      expect(matches.every(m => m.confidence >= 0.9)).toBe(true);
    });

    it('should not include non-matching patterns', () => {
      const matches = matchPatterns(lookups, 'ABC123', '45678901');

      const other = matches.find(m => m.value === 'Other');
      expect(other).toBeUndefined();
    });
  });

  describe('deduplicateMatches', () => {
    it('should keep highest weighted match per element', () => {
      const matches: PatternMatch[] = [
        { pattern: 'A', elementCode: 'Model', value: 'Low', confidence: 0.9, weight: 50, positions: [] },
        { pattern: 'B', elementCode: 'Model', value: 'High', confidence: 0.8, weight: 99, positions: [] },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('High');
    });

    it('should prefer higher confidence when weights are equal', () => {
      const matches: PatternMatch[] = [
        { pattern: 'A', elementCode: 'Model', value: 'LowConf', confidence: 0.7, weight: 99, positions: [] },
        { pattern: 'B', elementCode: 'Model', value: 'HighConf', confidence: 0.9, weight: 99, positions: [] },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('HighConf');
    });

    it('should keep one match per element code', () => {
      const matches: PatternMatch[] = [
        { pattern: 'A', elementCode: 'Model', value: 'Model1', confidence: 0.9, weight: 99, positions: [] },
        { pattern: 'B', elementCode: 'Series', value: 'Series1', confidence: 0.9, weight: 50, positions: [] },
        { pattern: 'C', elementCode: 'Trim', value: 'Trim1', confidence: 0.9, weight: 50, positions: [] },
      ];

      const result = deduplicateMatches(matches);

      expect(result).toHaveLength(3);
    });
  });
});
