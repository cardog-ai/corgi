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
      // VIS patterns use fullInput: VDS(5) + check(1) + year(1) + plant(1) + serial(6) = 14 chars
      // Layout: [0-4]=VDS, [5]=check, [6]=year, [7]=plant, [8-13]=serial
      // Pattern *****|*U = any VDS, any year, plant must be U
      expect(matchesPattern('ABCDE00U000000', '*****|*U')).toBe(true);
      expect(matchesPattern('ABCDE00A000000', '*****|*U')).toBe(false);
      expect(matchesPattern('ABCDE00X000000', '*****|**')).toBe(true); // wildcard plant

      // Pattern BFGFF|*A = VDS must be BFGFF, any year, plant must be A
      expect(matchesPattern('BFGFF00A000000', 'BFGFF|*A')).toBe(true);
      expect(matchesPattern('BFGFF0NA000000', 'BFGFF|*A')).toBe(true); // any year
      expect(matchesPattern('BFGFF00U000000', 'BFGFF|*A')).toBe(false); // wrong plant
      expect(matchesPattern('XXXXX00A000000', 'BFGFF|*A')).toBe(false); // wrong VDS
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
      // VIS patterns use fullInput (14 chars): [0-4]=VDS, [5]=check, [6]=year, [7]=plant
      expect(calculateConfidence('ABCDE00U000000', '*****|*U')).toBe(1.0);
      expect(calculateConfidence('ABCDE00X000000', '*****|**')).toBe(0.8); // wildcard plant

      // VDS must also match for non-wildcard VDS patterns
      expect(calculateConfidence('BFGFF00A000000', 'BFGFF|*A')).toBe(1.0);
      expect(calculateConfidence('XXXXX00A000000', 'BFGFF|*A')).toBe(0); // VDS mismatch
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
