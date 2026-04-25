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

import type { Lookup, PatternMatch } from './types.js';

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
 * For VIS patterns (e.g., "BFGFF|*A"), input is fullInput (VDS+VIS = 14 chars)
 * Layout: [0-4]=VDS, [5]=check, [6]=year, [7]=plant, [8-13]=serial
 */
export function matchesPattern(input: string, pattern: string): boolean {
  // Handle VIS patterns with pipe separator (e.g., "BFGFF|*A")
  const [vdsPattern, visPattern] = pattern.split('|');

  if (visPattern) {
    // VIS pattern - must verify BOTH VDS and plant code
    // input layout: VDS(5) + check(1) + year(1) + plant(1) + serial(6) = 14 chars

    // First verify VDS portion (first 5 chars)
    if (vdsPattern !== '*****') {
      const vdsSegments = parsePattern(vdsPattern);
      for (let i = 0; i < vdsSegments.length && i < 5; i++) {
        if (!charMatches(input[i], vdsSegments[i])) {
          return false;
        }
      }
    }

    // Then check plant code (position 7 in fullInput = position 11 in VIN)
    const plantCodePattern = visPattern[1];
    const plantCode = input[7];
    return plantCodePattern === '*' || plantCode === plantCodePattern;
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
 * For VIS patterns, input is fullInput (VDS+VIS = 14 chars)
 */
export function calculateConfidence(input: string, pattern: string): number {
  const [vdsPattern, visPattern] = pattern.split('|');

  // VIS patterns (plant codes) - must verify VDS matches first
  if (visPattern) {
    // Verify VDS portion matches (first 5 chars)
    if (vdsPattern !== '*****') {
      const vdsSegments = parsePattern(vdsPattern);
      for (let i = 0; i < vdsSegments.length && i < 5; i++) {
        if (!charMatches(input[i], vdsSegments[i])) {
          return 0;
        }
      }
    }

    // Then check plant code (position 7 = VIN position 11)
    const plantCodePattern = visPattern[1];
    const plantCode = input[7];
    if (plantCodePattern === '*') return 0.8;
    if (plantCode === plantCodePattern) return 1.0;
    return 0;
  }

  // Standard pattern
  if (!matchesPattern(input, vdsPattern)) {
    return 0;
  }

  const segments = parsePattern(vdsPattern);
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
  confidenceThreshold = 0.5,
  schemaId?: string
): PatternMatch[] {
  const fullInput = vds + vis;
  const matches: PatternMatch[] = [];

  for (const lookup of lookups) {
    // Calculate confidence - always use fullInput for both VDS and VIS patterns
    // VIS patterns need full context to verify VDS portion before checking plant code
    const confidence = calculateConfidence(fullInput, lookup.pattern);

    // Apply threshold (lower for plant codes)
    const threshold = lookup.elementCode.toLowerCase().includes('plant')
      ? 0.3
      : confidenceThreshold;

    if (confidence < threshold) continue;

    // Calculate positions
    const positions: number[] = [];
    const [actualPattern, hasVisPattern] = lookup.pattern.split('|');
    const startPos = hasVisPattern !== undefined ? 9 : 3;

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
      schemaId,
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
 * Uses three-tier scoring:
 * 1. Weight (higher first)
 * 2. Schema coherence - count of non-Model patterns from same schema (higher first)
 * 3. Confidence (higher first)
 */
export function deduplicateMatches(matches: PatternMatch[]): PatternMatch[] {
  // Count non-Model patterns per schema for coherence scoring
  // A schema with more matching patterns suggests better overall VIN coherence
  const schemaPatternCount = new Map<string, number>();
  for (const match of matches) {
    if (match.schemaId && match.elementCode !== 'Model') {
      schemaPatternCount.set(
        match.schemaId,
        (schemaPatternCount.get(match.schemaId) || 0) + 1
      );
    }
  }

  const seen = new Map<string, PatternMatch>();

  for (const match of matches) {
    const existing = seen.get(match.elementCode);
    if (!existing) {
      seen.set(match.elementCode, match);
      continue;
    }

    // Compare: weight > schema coherence > confidence
    const matchSchemaCount = match.schemaId ? (schemaPatternCount.get(match.schemaId) || 0) : 0;
    const existingSchemaCount = existing.schemaId ? (schemaPatternCount.get(existing.schemaId) || 0) : 0;

    const shouldReplace =
      match.weight > existing.weight ||
      (match.weight === existing.weight && matchSchemaCount > existingSchemaCount) ||
      (match.weight === existing.weight && matchSchemaCount === existingSchemaCount && match.confidence > existing.confidence);

    if (shouldReplace) {
      seen.set(match.elementCode, match);
    }
  }

  return Array.from(seen.values());
}
