import type { DatabaseAdapter } from './db/adapter';
import { VPICDatabase } from './db';
import { PatternMatch } from './types';
import { createLogger } from './logger';

const logger = createLogger('PatternMatcher');

/** Valid lookup tables in the VPIC database */
const LOOKUP_TABLES = [
  'DriveType',
  'EngineModel',
  'EngineConfiguration',
  'FuelType',
  'Transmission',
  'BodyStyle',
  'GrossVehicleWeightRating',
  'GrossVehicleWeightRatingTo',
  'GrossVehicleWeightRatingFrom',
  'ChargerLevel',
  'ElectrificationLevel',
  'EVDriveUnit',
  'BatteryType',
  'Make',
  'Model',
  'Series',
  'Trim',
  'Turbo',
  'DaytimeRunningLight',
  'Plant',
  'Country',
  'DaytimeRunningLight',
  'DestinationMarket',
  'Conversion',
] as const;

/**
 * Pattern position information
 */
interface Position {
  /** Start position of the pattern (0-indexed) */
  start: number;
  /** Length of the pattern (number of characters) */
  length: number;
  /** Value of the pattern (characters) */
  value: string;
}

/**
 * Raw pattern match from database
 */
interface RawPatternMatch {
  /** Pattern string (e.g. "****|*U") */
  pattern: string;
  /** Element ID */
  elementId: number;
  /** Element name (e.g. "Model") */
  elementName: string;
  /** Element (e.g. "Model") */
  element: string;
  /** Element code (e.g. "123") */
  elementCode: string;
  /** Group name (e.g. "Model") */
  groupName?: string;
  /** Description (e.g. "Model") */
  description?: string;
  /** Lookup table (e.g. "Model") */
  lookupTable?: string;
  /** Attribute ID (e.g. "123") */
  attributeId: string | number | null;
  /** Value (e.g. "123") */
  value: string | null;
  /** Schema name (e.g. "Model") */
  schemaName: string;
  /** Year from (e.g. 2020) */
  yearFrom: number;
  /** Year to (e.g. 2020) */
  yearTo?: number;
  /** Confidence (e.g. 0.5) */
  confidence: number;
  /** Keys (e.g. "123") */
  keys: string;
  /** Element weight (e.g. 0.5) */
  elementWeight?: number;
  /** Pattern type (e.g. "VDS" | "VIS") */
  patternType?: 'VDS' | 'VIS';
  /** Positions (e.g. [0, 1, 2, 3]) */
  positions: number[];
}

/**
 * Pattern matching utility class for VIN decoding
 */
export class PatternMatcher {
  private db: VPICDatabase;

  /**
   * Create a new pattern matcher
   *
   * @param adapter - Database adapter for SQL queries
   */
  constructor(adapter: DatabaseAdapter) {
    this.db = new VPICDatabase(adapter);
  }

  /**
   * Extract the positions covered by a pattern
   *
   * @param pattern - Pattern string to analyze
   * @returns Array of position objects
   */
  parsePositions(pattern: string): Position[] {
    const positions: Position[] = [];
    let currentPos = 0;

    while (currentPos < pattern.length) {
      const value = pattern[currentPos];
      let length = 1;

      // Count consecutive occurrences of the same character
      while (currentPos + length < pattern.length && pattern[currentPos + length] === value) {
        length++;
      }

      positions.push({
        start: currentPos,
        length,
        value,
      });

      currentPos += length;
    }

    return positions;
  }

  /**
   * Check if a character matches a pattern
   *
   * @param char - Character to check
   * @param pattern - Pattern to match against
   * @returns Whether the character matches the pattern
   */
  private isCharInRange(char: string, pattern: string): boolean {
    // Handle character class patterns like [A-E], [1-46], [ABCE]
    if (!pattern.startsWith('[') || !pattern.endsWith(']')) {
      return char === pattern || pattern === '*';
    }

    const content = pattern.slice(1, -1);
    let i = 0;

    while (i < content.length) {
      // Handle ranges like A-E
      if (i + 2 < content.length && content[i + 1] === '-') {
        const start = content[i].charCodeAt(0);
        const end = content[i + 2].charCodeAt(0);
        const charCode = char.charCodeAt(0);

        if (charCode >= start && charCode <= end) {
          return true;
        }

        i += 3;
      } else {
        // Handle individual characters like [ABC]
        if (char === content[i]) {
          return true;
        }

        i++;
      }
    }

    return false;
  }

  /**
   * Check if an input string matches a pattern
   *
   * @param input - Input string to check
   * @param pattern - Pattern to match against
   * @returns Whether the input matches the pattern
   */
  private matchesPattern(input: string, pattern: string): boolean {
    if (!input || !pattern) {
      return false;
    }

    // Split pattern into parts
    const [actualPattern, ...metadataParts] = pattern.split('|');

    // Special handling for VIS patterns with pipe separator (e.g. *****|*U)
    if (metadataParts.length > 0 && actualPattern.length === 5) {
      // This is a VIS pattern for plant code
      const visPattern = metadataParts[0];
      // For plant codes, we need to match the second character of the VIS pattern
      // against the first character of the VIS portion (position 10 in the full VIN)
      const plantCodeChar = input[0]; // First char of input (which should be VIS portion)
      const expectedPlantCode = visPattern[1]; // Second char after *

      return expectedPlantCode === '*' || plantCodeChar === expectedPlantCode;
    }

    return this.matchesSimplePattern(input, actualPattern);
  }

  /**
   * Check if an input string matches a simple pattern without metadata
   *
   * @param input - Input string to check
   * @param pattern - Pattern to match against
   * @returns Whether the input matches the pattern
   */
  private matchesSimplePattern(input: string, pattern: string): boolean {
    let patternIndex = 0;
    let inputIndex = 0;

    while (patternIndex < pattern.length && inputIndex < input.length) {
      const patternChar = pattern[patternIndex];
      const inputChar = input[inputIndex];

      // Handle character class patterns
      if (patternChar === '[') {
        const closeBracket = pattern.indexOf(']', patternIndex);
        if (closeBracket === -1) {
          return false;
        }

        const charClass = pattern.substring(patternIndex, closeBracket + 1);
        if (!this.isCharInRange(inputChar, charClass)) {
          return false;
        }

        patternIndex = closeBracket + 1;
        inputIndex++;
        continue;
      }

      // Handle wildcards - they can match any character
      if (patternChar === '*') {
        // If this is the last character in the pattern, consume all remaining input
        if (patternIndex === pattern.length - 1) {
          return true;
        }
        // Otherwise, try to match the rest of the pattern
        patternIndex++;
        inputIndex++;
        continue;
      }

      // Exact character match
      if (inputChar !== patternChar) {
        return false;
      }

      patternIndex++;
      inputIndex++;
    }

    // Pattern matched if we consumed all pattern characters
    // or if the only remaining pattern character is a wildcard
    return (
      patternIndex >= pattern.length ||
      (patternIndex === pattern.length - 1 && pattern[patternIndex] === '*')
    );
  }

  /**
   * Calculate the confidence score for a pattern match
   *
   * @param pattern - Pattern string
   * @param input - Input string
   * @returns Confidence score (0-1)
   */
  calculateConfidence(pattern: string, input: string): number {
    if (!pattern || !input) return 0;

    // Split pattern into parts
    const [actualPattern, ...metadataParts] = pattern.split('|');

    // Special handling for VIS patterns
    if (metadataParts.length > 0 && actualPattern.length === 5) {
      const plantCodeChar = input; // Input is already the correct character
      const visPattern = metadataParts[0];
      const expectedPlantCode = visPattern[1];

      // For plant codes, we want to be more lenient
      if (expectedPlantCode === '*') {
        return 0.8; // Higher confidence for wildcard matches
      }

      if (expectedPlantCode === plantCodeChar) {
        return 1.0; // Full confidence for exact matches
      }

      return 0;
    }

    // Try matching against the input
    if (!this.matchesPattern(input, actualPattern)) {
      return 0;
    }

    // Calculate confidence based on pattern specificity
    let exactMatches = 0;
    let classMatches = 0;
    let wildcardMatches = 0;
    let totalLength = 0;

    let patternIndex = 0;
    let inputIndex = 0;

    while (patternIndex < actualPattern.length && inputIndex < input.length) {
      const patternChar = actualPattern[patternIndex];
      const inputChar = input[inputIndex];

      if (patternChar === '[') {
        const closeBracket = actualPattern.indexOf(']', patternIndex);
        if (closeBracket === -1) break;

        const charClass = actualPattern.substring(patternIndex, closeBracket + 1);
        const content = charClass.slice(1, -1);

        // More specific character classes get higher confidence
        if (content.includes('-')) {
          // Range like [1-5] is less specific
          classMatches += 0.7;
        } else {
          // Explicit list like [123] is more specific
          classMatches += 0.8;
        }

        totalLength++;
        patternIndex = closeBracket + 1;
        inputIndex++;
      } else if (patternChar === '*') {
        wildcardMatches++;
        totalLength++;
        patternIndex++;
        inputIndex++;
      } else {
        if (patternChar === inputChar) {
          exactMatches++;
        }

        totalLength++;
        patternIndex++;
        inputIndex++;
      }
    }

    // Weight the different types of matches
    const score = (exactMatches * 1.0 + classMatches + wildcardMatches * 0.5) / totalLength;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Transform a raw pattern match to the cleaned output format
   *
   * @param pattern - Raw pattern match
   * @returns Cleaned pattern match
   */
  private transformPatternMatch(pattern: RawPatternMatch): PatternMatch {
    // Calculate positions from pattern
    const positions: number[] = pattern.positions || [];

    return {
      element: pattern.elementName,
      code: pattern.elementCode,
      attributeId: pattern.attributeId,
      value: pattern.value,
      confidence: pattern.confidence,
      positions,
      schema: pattern.schemaName,
      metadata: {
        lookupTable: pattern.lookupTable,
        groupName: pattern.groupName,
        elementWeight: pattern.elementWeight,
        patternType: pattern.patternType,
        rawPattern: pattern.pattern,
      },
    };
  }

  /**
   * Get matching patterns for a VIN
   *
   * @param wmi - World Manufacturer Identifier
   * @param modelYear - Vehicle model year
   * @param vds - Vehicle Descriptor Section
   * @param vis - Vehicle Identifier Section
   * @returns Array of pattern matches
   */
  async getPatternMatches(
    wmi: string,
    modelYear: number,
    vds: string,
    vis: string,
  ): Promise<PatternMatch[]> {
    // Get raw pattern matches first
    const rawMatches = await this.getRawPatternMatches(wmi, modelYear, vds, vis);

    // Transform matches into the cleaner format and filter by confidence
    const transformedMatches = rawMatches
      .filter(m => {
        // More lenient confidence threshold for plant codes
        if (m.elementName.toLowerCase().includes('plant')) {
          return m.confidence > 0.3;
        }
        return m.confidence > 0.5;
      })
      .map(match => this.transformPatternMatch(match));

    // Group matches by element type
    const matchesByElement: Record<string, PatternMatch[]> = {};

    transformedMatches.forEach(match => {
      const element = match.element;
      if (!matchesByElement[element]) {
        matchesByElement[element] = [];
      }
      matchesByElement[element].push(match);
    });

    // Count patterns per schema (excluding Model patterns) for VIN coherence scoring
    // A schema with more non-model patterns matching suggests better overall VIN coherence
    const schemaPatternCount: Record<string, number> = {};
    transformedMatches.forEach(match => {
      if (match.element !== 'Model') {
        const schema = match.schema;
        schemaPatternCount[schema] = (schemaPatternCount[schema] || 0) + 1;
      }
    });

    // For each element type, sort by weight and then filter duplicates
    let result: PatternMatch[] = [];

    for (const [element, matches] of Object.entries(matchesByElement)) {
      // Three-tier sorting:
      // 1. Primary: elementWeight (higher first)
      // 2. Secondary: schema pattern count (higher first) - VIN coherence
      // 3. Tertiary: model-specific confidence (higher first)
      const sortedMatches = matches.sort((a, b) => {
        const weightA = a.metadata?.elementWeight ?? 0;
        const weightB = b.metadata?.elementWeight ?? 0;

        // Primary: elementWeight
        if (weightA !== weightB) {
          return weightB - weightA;
        }

        // Secondary: schema pattern count (VIN coherence)
        // More patterns from the same schema = better overall match
        const schemaCountA = schemaPatternCount[a.schema] || 0;
        const schemaCountB = schemaPatternCount[b.schema] || 0;
        if (schemaCountA !== schemaCountB) {
          return schemaCountB - schemaCountA;
        }

        // Tertiary: confidence score
        return b.confidence - a.confidence;
      });

      // Filter out duplicates based on value and positions
      const seen = new Set<string>();
      const uniqueMatches = sortedMatches.filter(match => {
        const key = JSON.stringify({
          value: match.value,
          positions: match.positions.join(','),
          schema: match.schema,
        });

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

      result = result.concat(uniqueMatches);
    }

    return result;
  }

  /**
   * Get raw pattern matches from the database
   *
   * @param wmi - World Manufacturer Identifier
   * @param modelYear - Vehicle model year
   * @param vds - Vehicle Descriptor Section
   * @param vis - Vehicle Identifier Section
   * @returns Array of raw pattern matches
   */
  async getRawPatternMatches(
    wmi: string,
    modelYear: number,
    vds: string,
    vis: string,
  ): Promise<RawPatternMatch[]> {
    try {
      // 1. Find valid schemas
      const validSchemas = await this.db.getValidSchemas(wmi, modelYear);

      if (validSchemas.length === 0) {
        logger.debug({ wmi, modelYear }, 'No valid schemas found');
        return [];
      }

      const schemaIds = validSchemas.map(s => s.SchemaId);

      // 2. Get all patterns for these schemas
      const allPatterns = await this.db.getPatterns(schemaIds);
      // 3. Filter patterns using valid lookup tables

      const filteredPatterns = allPatterns.filter(p => {
        if (p.LookupTable) {
          if (!LOOKUP_TABLES.includes(p.LookupTable) || p.LookupTable.includes('vNCSA')) {
            return false;
          }
        }
        return true;
      });

      // 4. Group patterns by lookup table for batch resolution
      interface PatternWithTable {
        LookupTable?: string;
        AttributeId: string | number;
        ResolvedValue?: string | number;
        SchemaName: string;
        Pattern: string;
        ElementName: string;
        ElementWeight: number;
        [key: string]: any;
      }

      const patternsByLookupTable: Record<string, PatternWithTable[]> = {};
      const patternsWithoutLookup: PatternWithTable[] = [];

      for (const pattern of filteredPatterns) {
        if (pattern.LookupTable) {
          if (!patternsByLookupTable[pattern.LookupTable]) {
            patternsByLookupTable[pattern.LookupTable] = [];
          }
          patternsByLookupTable[pattern.LookupTable].push(pattern);
        } else {
          pattern.ResolvedValue = pattern.AttributeId;
          patternsWithoutLookup.push(pattern);
        }
      }

      // 5. Resolve lookup values in batch by table
      for (const [tableName, tablePatterns] of Object.entries(patternsByLookupTable)) {
        // Extract unique attribute IDs
        const attributeIds = [...new Set(tablePatterns.map(p => String(p.AttributeId)))];

        if (attributeIds.length === 0) continue;

        try {
          // Get all values in one batch query
          const lookupMap = await this.db.lookupValues(tableName, attributeIds);

          // Apply resolved values to patterns
          for (const pattern of tablePatterns) {
            const attributeId = String(pattern.AttributeId);
            pattern.ResolvedValue = lookupMap.get(attributeId) || pattern.AttributeId;
          }
        } catch (error) {
          logger.warn({ error, tableName }, 'Lookup table resolution failed');

          // If table doesn't exist or other error, use AttributeId as fallback
          for (const pattern of tablePatterns) {
            pattern.ResolvedValue = pattern.AttributeId;
          }
        }
      }

      // 6. Combine patterns after lookup resolution
      const resolvedPatterns = [
        ...patternsWithoutLookup,
        ...Object.values(patternsByLookupTable).flat(),
      ];

      // 7. Sort patterns by weight
      resolvedPatterns.sort((a, b) => {
        if (a.ElementWeight !== b.ElementWeight) {
          return b.ElementWeight - a.ElementWeight; // DESC
        }
        return a.Pattern.localeCompare(b.Pattern); // ASC
      });

      // 8. Find the most specific schema by looking at model patterns
      const modelPatterns = resolvedPatterns
        .filter(row => row.ElementName === 'Model')
        .map(row => ({
          ...row,
          confidence: this.calculateConfidence(row.Pattern, vds + vis),
        }))
        .sort((a, b) => b.confidence - a.confidence);

      // Get the most relevant schema name
      const primarySchema = modelPatterns.length > 0 ? modelPatterns[0].SchemaName : null;

      // 9. Calculate confidence and format results
      return resolvedPatterns.map(row => {
        const pattern = row.Pattern;
        const isVISPattern = pattern.includes('|');

        // Calculate base confidence
        const baseConfidence = isVISPattern
          ? this.calculateConfidence(pattern, vis[1])
          : this.calculateConfidence(pattern, vds + vis);

        // Adjust confidence based on schema match for plant codes
        let confidence = baseConfidence;
        if (row.ElementName.toLowerCase().includes('plant')) {
          if (primarySchema) {
            confidence = row.SchemaName === primarySchema ? baseConfidence : 0;
          } else {
            confidence = baseConfidence * 0.5;
          }
        }

        // Calculate correct positions based on pattern type
        const positions: number[] = [];
        const actualPattern = pattern.split('|')[0];
        const startPos = isVISPattern ? 9 : 3;

        for (let i = 0; i < actualPattern.length; i++) {
          if (actualPattern[i] !== '|') {
            positions.push(startPos + i);
          }
        }

        return {
          pattern: row.Pattern,
          elementId: row.ElementId,
          elementName: row.ElementName,
          element: row.ElementName,
          elementCode: row.ElementCode,
          groupName: row.GroupName,
          description: row.Description?.toString() ?? null,
          lookupTable: row.LookupTable,
          attributeId: row.ResolvedValue ? String(row.ResolvedValue) : null,
          value: row.ResolvedValue ? String(row.ResolvedValue) : null,
          schemaName: row.SchemaName,
          yearFrom: row.YearFrom,
          yearTo: row.YearTo,
          confidence,
          keys: row.Pattern,
          elementWeight: row.ElementWeight,
          patternType: isVISPattern ? 'VIS' : 'VDS',
          positions,
        } as RawPatternMatch;
      });
    } catch (error) {
      logger.error({ error, wmi, modelYear }, 'Error getting pattern matches');
      throw error;
    }
  }
}
