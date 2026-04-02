/**
 * Corgi v3 - Pattern Matcher
 *
 * Implements VIN pattern matching as defined in the Vehicle Identity Standard
 * @see https://github.com/cardog-ai/vis-a-vin
 * @see spec/03-ENCODING.md - Pattern syntax (wildcards, ranges, character classes)
 * @see spec/04-ARCHITECTURE.md - Pattern matching algorithm
 *
 * Pattern syntax:
 *   - '*' matches any single character
 *   - '[A-Z]' matches character range
 *   - '[ABC]' matches character set
 *   - '|' separates VDS pattern from VIS pattern (e.g., "*****|*U")
 */

import type { Lookup, PatternMatch } from './types';

/**
 * Check if a character matches a pattern character
 */
function charMatches(char: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === char) return true;

  // Handle character class [A-Z] or [ABC]
  if (pattern.startsWith('[') && pattern.endsWith(']')) {
    const content = pattern.slice(1, -1);
    let i = 0;

    while (i < content.length) {
      // Check for range like A-Z
      if (i + 2 < content.length && content[i + 1] === '-') {
        const start = content.charCodeAt(i);
        const end = content.charCodeAt(i + 2);
        const charCode = char.charCodeAt(0);

        if (charCode >= start && charCode <= end) {
          return true;
        }
        i += 3;
      } else {
        // Individual character
        if (char === content[i]) {
          return true;
        }
        i++;
      }
    }
    return false;
  }

  return false;
}

/**
 * Parse pattern into segments, handling character classes
 */
function parsePattern(pattern: string): string[] {
  const segments: string[] = [];
  let i = 0;

  while (i < pattern.length) {
    if (pattern[i] === '[') {
      const end = pattern.indexOf(']', i);
      if (end > i) {
        segments.push(pattern.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    segments.push(pattern[i]);
    i++;
  }

  return segments;
}

/**
 * Check if input matches pattern
 */
export function matchesPattern(input: string, pattern: string): boolean {
  // Handle VIS patterns with pipe separator (e.g., "*****|*U")
  const [vdsPattern, visPattern] = pattern.split('|');

  if (visPattern) {
    // VIS pattern - match against input which should be plant code char
    const plantCodePattern = visPattern[1]; // Second char after *
    return plantCodePattern === '*' || input[0] === plantCodePattern;
  }

  // Standard VDS pattern
  const segments = parsePattern(vdsPattern);

  if (segments.length > input.length) {
    return false;
  }

  for (let i = 0; i < segments.length && i < input.length; i++) {
    if (!charMatches(input[i], segments[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate confidence score for a pattern match
 * Higher score = more specific pattern
 */
export function calculateConfidence(input: string, pattern: string): number {
  const [actualPattern, visPattern] = pattern.split('|');

  // VIS patterns (plant codes)
  if (visPattern) {
    const plantCodePattern = visPattern[1];
    if (plantCodePattern === '*') return 0.8;
    if (input[0] === plantCodePattern) return 1.0;
    return 0;
  }

  // Standard pattern
  if (!matchesPattern(input, actualPattern)) {
    return 0;
  }

  const segments = parsePattern(actualPattern);
  let exactMatches = 0;
  let classMatches = 0;
  let wildcardMatches = 0;
  let total = 0;

  for (let i = 0; i < segments.length && i < input.length; i++) {
    const segment = segments[i];
    total++;

    if (segment === '*') {
      wildcardMatches++;
    } else if (segment.startsWith('[')) {
      // Character class - more specific than wildcard
      const content = segment.slice(1, -1);
      if (content.includes('-')) {
        classMatches += 0.7; // Range like [1-5]
      } else {
        classMatches += 0.8; // Explicit list like [ABC]
      }
    } else {
      // Exact match
      if (input[i] === segment) {
        exactMatches++;
      }
    }
  }

  if (total === 0) return 0;

  const score = (exactMatches * 1.0 + classMatches + wildcardMatches * 0.5) / total;
  return Math.min(1, Math.max(0, score));
}

/**
 * Match lookups against VDS+VIS and return scored matches
 */
export function matchPatterns(
  lookups: Lookup[],
  vds: string,
  vis: string,
  confidenceThreshold = 0.5
): PatternMatch[] {
  const fullInput = vds + vis;
  const matches: PatternMatch[] = [];

  for (const lookup of lookups) {
    const isVISPattern = lookup.pattern.includes('|');

    // Calculate confidence
    const patternInput = isVISPattern ? vis : fullInput;
    const confidence = calculateConfidence(patternInput, lookup.pattern);

    // Apply threshold (lower for plant codes)
    const threshold = lookup.elementCode.toLowerCase().includes('plant')
      ? 0.3
      : confidenceThreshold;

    if (confidence < threshold) continue;

    // Calculate positions
    const positions: number[] = [];
    const [actualPattern] = lookup.pattern.split('|');
    const startPos = isVISPattern ? 9 : 3;

    for (let i = 0; i < actualPattern.length; i++) {
      if (actualPattern[i] !== '|') {
        positions.push(startPos + i);
      }
    }

    matches.push({
      pattern: lookup.pattern,
      elementCode: lookup.elementCode,
      value: lookup.resolved,
      confidence,
      weight: lookup.weight || 0,
      positions,
    });
  }

  // Sort by weight (desc), then confidence (desc)
  matches.sort((a, b) => {
    if (a.weight !== b.weight) return b.weight - a.weight;
    return b.confidence - a.confidence;
  });

  return matches;
}

/**
 * Deduplicate matches by element code, keeping highest scored
 */
export function deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
  const seen = new Map<string, PatternMatch>();

  for (const match of matches) {
    const existing = seen.get(match.elementCode);
    if (!existing || match.weight > existing.weight ||
        (match.weight === existing.weight && match.confidence > existing.confidence)) {
      seen.set(match.elementCode, match);
    }
  }

  return Array.from(seen.values());
}
