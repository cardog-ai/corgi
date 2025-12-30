import { DatabaseAdapter } from './db/adapter';
import { VPICDatabase } from './db';
import { PatternMatcher } from './pattern';
import { createLogger } from './logger';
import { BODY_STYLE_MAP, BodyStyle } from './types';
import {
  WMIResult,
  ModelYearResult,
  CheckDigitResult,
  PatternMatch,
  DecodeError,
  DecodeResult,
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  ValidationError,
  StructureError,
  LookupError,
  PatternError,
  DatabaseError,
  VehicleInfo,
  PlantInfo,
  EngineInfo,
  DecodeOptions,
} from './types';

// Create logger for the decoder
const logger = createLogger('VINDecoder');

// Canonical VIN character sequence for a 30-year block (1980-2009 or 2010-2039)
const modelYearCodes = [
  'A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','V','W',
  'X','Y','1','2','3','4','5','6','7','8','9'
];

/**
 * Helper function to decode a VIN using a provided database adapter
 *
 * @param vin - The Vehicle Identification Number to decode
 * @param adapter - Database adapter for the current environment
 * @param options - Optional configuration for the decoding process
 * @returns Decoded VIN information
 */
export async function decodeVIN(
  vin: string,
  adapter: DatabaseAdapter,
  options: DecodeOptions = {},
): Promise<DecodeResult> {
  const decoder = new VINDecoder(adapter);
  return decoder.decode(vin, options);
}

/**
 * Main VIN decoder class implementing the NHTSA VPIC decoding logic
 */
export class VINDecoder {
  private db: VPICDatabase;
  private patternMatcher: PatternMatcher;

  /**
   * Create a new VIN decoder
   *
   * @param adapter - Database adapter for the current environment
   */
  constructor(adapter: DatabaseAdapter) {
    this.db = new VPICDatabase(adapter);
    this.patternMatcher = new PatternMatcher(adapter);
  }

  /**
   * Decode a VIN and return detailed vehicle information
   *
   * @param vin - The Vehicle Identification Number to decode
   * @param options - Optional configuration for the decoding process
   * @returns Decoded VIN information
   */
  async decode(vin: string, options: DecodeOptions = {}): Promise<DecodeResult> {
    // Record start time for processing
    const startTime = performance.now ? performance.now() : Date.now();
    const cleanVin = vin.toUpperCase().trim();

    // Initialize result object
    const result: DecodeResult = {
      vin: cleanVin,
      valid: false,
      components: {},
      errors: [],
      metadata: {
        processingTime: 0,
        confidence: 0,
        schemaVersion: '1.0',
      },
    };

    // Store query information if diagnostics requested
    if (options.includeDiagnostics) {
      result.metadata!.queries = [];
    }

    // Initialize rawRecords array if includeRawData option is set
    if (options.includeRawData) {
      result.metadata!.rawRecords = [];
    }

    try {
      // 1. Validate VIN structure and characters
      const structureErrors = this.validateStructure(cleanVin);
      if (structureErrors.length > 0) {
        result.errors = structureErrors;
        result.metadata!.processingTime = Date.now() - startTime;
        return result;
      }

      // 2. Validate check digit
      const checkDigit = this.validateCheckDigit(cleanVin);
      result.components.checkDigit = checkDigit;

      if (!checkDigit.isValid) {
        result.errors.push({
          code: ErrorCode.INVALID_CHECK_DIGIT,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.WARNING, // Downgrade to warning, common problem in real-world VINs
          message: 'Invalid check digit',
          positions: [8],
          expected: checkDigit.expected,
          actual: checkDigit.actual,
        } as ValidationError);
      }

      // 3. Determine model year
      const modelYear = options.modelYear
        ? {
            year: options.modelYear,
            source: 'override' as const,
            confidence: 1,
          }
        : this.determineModelYear(cleanVin);

      if (!modelYear) {
        result.errors.push({
          code: ErrorCode.INVALID_MODEL_YEAR,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.ERROR,
          message: 'Could not determine model year',
          positions: [9],
        } as ValidationError);

        result.metadata!.processingTime = Date.now() - startTime;
        return result;
      }

      // Handle VIN 10th digit '0' - some countries don't encode model year
      if (modelYear.year === 0) {
        result.errors.push({
          code: ErrorCode.INVALID_MODEL_YEAR,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: 'Model year position contains "0" - year information not encoded (common for non-US vehicles)',
          positions: [9],
          details: 'Some countries do not use position 10 for model year and set it to "0"',
        } as ValidationError);
      }

      result.components.modelYear = modelYear;

      // 4. Get WMI information
      const wmi = this.extractWMI(cleanVin);
      const wmiInfo = await this.db.getWMI(wmi);

      if (!wmiInfo) {
        result.errors.push({
          code: ErrorCode.WMI_NOT_FOUND,
          category: ErrorCategory.LOOKUP,
          severity: ErrorSeverity.ERROR,
          message: 'WMI not found in database',
          searchKey: wmi,
          searchType: 'WMI',
        } as LookupError);

        result.metadata!.processingTime = Date.now() - startTime;
        return result;
      }

      result.components.wmi = wmiInfo;

      // 5. Get pattern matches
      try {
        const vds = cleanVin.substring(3, 9);
        const vis = cleanVin.substring(9, 17);

        // Get pattern matches for this VIN
        const patterns = await this.patternMatcher.getPatternMatches(wmi, modelYear.year, vds, vis);

        if (patterns.length > 0) {
          // Split patterns into VDS and VIS components
          const vdsPatterns = patterns.filter(p => p.metadata?.patternType === 'VDS');
          const visPatterns = patterns.filter(p => p.metadata?.patternType === 'VIS');

          // Update components with VDS and VIS information
          if (vdsPatterns.length > 0) {
            result.components.vds = {
              raw: vds,
              patterns: vdsPatterns,
            };
          }

          if (visPatterns.length > 0) {
            result.components.vis = {
              raw: vis,
              patterns: visPatterns,
            };
          }

          // Extract core vehicle information
          result.components.vehicle = this.extractVehicleInfo(patterns, wmiInfo, modelYear);

          result.components.plant = this.extractPlantInfo(patterns, cleanVin);
          result.components.engine = this.extractEngineInfo(patterns);

          // Include full pattern array only if requested
          if (options.includePatternDetails) {
            result.patterns = patterns;
          }

          // Calculate overall confidence
          const avgConfidence =
            patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

          result.metadata!.confidence = avgConfidence;
          result.metadata!.matchedSchema = this.findPrimarySchema(patterns);
          result.metadata!.totalPatterns = patterns.length;

          if (avgConfidence < (options.confidenceThreshold || 0.5)) {
            result.errors.push({
              code: ErrorCode.LOW_CONFIDENCE_PATTERNS,
              category: ErrorCategory.PATTERN,
              severity: ErrorSeverity.WARNING,
              message: 'Low confidence in pattern matches',
              confidence: avgConfidence,
            } as PatternError);
          }
        } else {
          result.errors.push({
            code: ErrorCode.NO_PATTERNS_FOUND,
            category: ErrorCategory.PATTERN,
            severity: ErrorSeverity.ERROR,
            message: 'No matching patterns found',
          } as PatternError);

          result.metadata!.processingTime = Date.now() - startTime;
          return result;
        }
      } catch (error) {
        result.errors.push({
          code: ErrorCode.QUERY_ERROR,
          category: ErrorCategory.DATABASE,
          severity: ErrorSeverity.ERROR,
          message: 'Error matching patterns',
          details: error instanceof Error ? error.message : 'Unknown error',
        } as DatabaseError);

        result.metadata!.processingTime = Date.now() - startTime;
        return result;
      }

      // 6. Set final validation status
      // A VIN is considered valid if it has no errors or only warnings
      result.valid =
        result.errors.every(error => error.severity === ErrorSeverity.WARNING) ||
        result.errors.length === 0;
    } catch (error) {
      logger.error({ vin, error }, 'Decoder error');

      result.errors.push({
        code: ErrorCode.QUERY_ERROR,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.ERROR,
        message: 'Unexpected error during decoding',
        details: error instanceof Error ? error.message : 'Unknown error',
      } as DatabaseError);
    }

    // Set processing time - use performance.now() if available for higher precision
    result.metadata!.processingTime = performance.now
      ? performance.now() - startTime
      : Date.now() - startTime;

    return result;
  }

  /**
   * Find the primary schema from pattern matches
   *
   * @param patterns - Array of pattern matches
   * @returns Primary schema name or undefined
   */
  private findPrimarySchema(patterns: PatternMatch[]): string | undefined {
    const modelPatterns = patterns
      .filter(p => p.element === 'Model')
      .sort((a, b) => b.confidence - a.confidence);

    return modelPatterns[0]?.schema;
  }

  /**
   * Map raw body style to standardized body style
   *
   * @param bodyStyle - Raw body style from database
   * @returns Standardized body style
   */
  private coerceBodyStyle(bodyStyle: string): string {
    // If body style is in our map, use it
    if (bodyStyle in BODY_STYLE_MAP) {
      return BODY_STYLE_MAP[bodyStyle];
    }

    // Fuzzy match based on substring
    for (const [key, value] of Object.entries(BODY_STYLE_MAP)) {
      if (
        bodyStyle.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(bodyStyle.toLowerCase())
      ) {
        return value;
      }
    }

    // Handle common keywords
    const lowerBody = bodyStyle.toLowerCase();
    if (lowerBody.includes('pickup') || lowerBody.includes('truck')) {
      return BodyStyle.PICKUP;
    }

    // Default to OTHER if no match
    return BodyStyle.OTHER;
  }

  /**
   * Extract vehicle information from pattern matches
   *
   * @param patterns - Array of pattern matches
   * @param wmiInfo - WMI information
   * @param modelYear - Model year information
   * @returns Vehicle information
   */
  private extractVehicleInfo(
    patterns: PatternMatch[],
    wmiInfo: WMIResult,
    modelYear: ModelYearResult,
  ): VehicleInfo {
    const info: VehicleInfo = {
      make: wmiInfo.make || '',
      model: '',
      year: modelYear.year,
      manufacturer: wmiInfo.manufacturer,
      gvwr: '',
    };

    // First, sort model patterns by elementWeight (if available)
    const modelPatterns = patterns
      .filter(p => p.element === 'Model' && p.value)
      .sort((a, b) => {
        // Use elementWeight if available (higher weight first)
        const weightA = a.metadata?.elementWeight ?? 0;
        const weightB = b.metadata?.elementWeight ?? 0;
        if (weightA !== weightB) {
          return weightB - weightA;
        }
        // Fall back to confidence if weights are equal
        return b.confidence - a.confidence;
      });

    // Set model from highest weight pattern if available
    if (modelPatterns.length > 0) {
      info.model = modelPatterns[0].value!;
    }

    // Track fuel types to determine if vehicle is hybrid
    let primaryFuelType: string | undefined;
    let secondaryFuelType: string | undefined;

    // Extract other information from pattern matches
    for (const pattern of patterns) {
      if (!pattern.value) continue;

      switch (pattern.element) {
        case 'Make':
          info.make = pattern.value;
          break;
        // Skip "Model" as we've already handled it
        case 'Series':
          info.series = pattern.value;
          break;
        case 'Trim':
        case 'Trim Level':
          info.trim = pattern.value;
          break;
        case 'Body Class':
        case 'Body Style':
          info.bodyStyle = this.coerceBodyStyle(pattern.value);
          break;
        case 'Drive Type':
          info.driveType = pattern.value;
          break;
        case 'Fuel Type - Primary':
          primaryFuelType = pattern.value;
          info.fuelType = pattern.value;
          break;
        case 'Fuel Type - Secondary':
          secondaryFuelType = pattern.value;
          break;
        case 'Transmission':
          info.transmission = pattern.value;
          break;
        case 'Doors':
          info.doors = pattern.value;
          break;
        case 'Gross Vehicle Weight Rating From':
          info.gvwr = pattern.value;
      }
    }

    // Set fuelType to Hybrid only if both fuel types are present and one is electric
    if (primaryFuelType && secondaryFuelType) {
      const isElectricPresent =
        primaryFuelType.toLowerCase().includes('electric') ||
        secondaryFuelType.toLowerCase().includes('electric');

      if (isElectricPresent) {
        info.fuelType = 'Hybrid';
      }
    }

    return info;
  }

  /**
   * Extract plant information from pattern matches
   *
   * @param patterns - Array of pattern matches
   * @param vin - Complete VIN string
   * @returns Plant information or undefined
   */
  private extractPlantInfo(patterns: PatternMatch[], vin: string): PlantInfo | undefined {
    let country: string | undefined;
    let city: string | undefined;
    let manufacturer: string | undefined;

    // Look for explicit plant patterns
    for (const pattern of patterns) {
      if (!pattern.value) continue;

      // Normalize element name for comparison
      const elementName = pattern.element.toLowerCase();

      if (elementName === 'plant country') {
        country = pattern.value;
      } else if (elementName === 'plant city') {
        city = pattern.value;
      } else if (elementName === 'plant company name') {
        manufacturer = pattern.value;
      }
    }

    // Get the plant code directly from the VIN's 11th position
    const code = vin[10]; // 11th character (index 10)

    // Return plant info if we have at least a country
    if (country) {
      return {
        country,
        city,
        manufacturer,
        code,
      };
    }

    return undefined;
  }

  /**
   * Extract engine information from pattern matches
   *
   * @param patterns - Array of pattern matches
   * @returns Engine information or undefined
   */
  private extractEngineInfo(patterns: PatternMatch[]): EngineInfo | undefined {
    const info: EngineInfo = {};
    let hasEngineInfo = false;

    for (const pattern of patterns) {
      if (!pattern.value) continue;

      switch (pattern.element) {
        case 'Engine Model':
          info.model = pattern.value;
          hasEngineInfo = true;
          break;
        case 'Engine Number of Cylinders':
        case 'Cylinders':
          info.cylinders = pattern.value;
          hasEngineInfo = true;
          break;
        case 'Displacement (L)':
          info.displacement = pattern.value;
          hasEngineInfo = true;
          break;
        case 'Engine Brake (hp) From':
        case 'Engine Power (KW)':
          info.power = pattern.value;
          hasEngineInfo = true;
          break;
        case 'Fuel Type - Primary':
        case 'Fuel Type':
          info.fuel = pattern.value;
          hasEngineInfo = true;
          break;
      }
    }

    return hasEngineInfo ? info : undefined;
  }

  /**
   * Validate the structure of a VIN
   *
   * @param vin - VIN to validate
   * @returns Array of structure errors
   */
  private validateStructure(vin: string): DecodeError[] {
    const errors: DecodeError[] = [];

    // Check length
    if (vin.length !== 17) {
      errors.push({
        code: ErrorCode.INVALID_LENGTH,
        category: ErrorCategory.STRUCTURE,
        severity: ErrorSeverity.ERROR,
        message: 'Invalid VIN length',
      } as StructureError);
      return errors;
    }

    // Check characters
    const invalidChars = [...vin].reduce((acc, char, index) => {
      // Position 9 (check digit) can only be 0-9 or X
      if (index === 8) {
        if (!/[0-9X]/.test(char)) {
          acc.push({ char, pos: index + 1 });
        }
      }
      // Position 10 (year) must be 0-9 or A-Z (except I,O,Q)
      else if (index === 9) {
        if (!/[0-9A-HJ-NPR-Z]/.test(char)) {
          acc.push({ char, pos: index + 1 });
        }
      }
      // All other positions must be 0-9 or A-Z (except I,O,Q)
      else if (!/[0-9A-HJ-NPR-Z]/.test(char)) {
        acc.push({ char, pos: index + 1 });
      }
      return acc;
    }, [] as Array<{ char: string; pos: number }>);

    if (invalidChars.length > 0) {
      errors.push({
        code: ErrorCode.INVALID_CHARACTERS,
        category: ErrorCategory.STRUCTURE,
        severity: ErrorSeverity.ERROR,
        message: `Invalid characters: ${invalidChars
          .map(ic => `${ic.char} at position ${ic.pos}`)
          .join(', ')}`,
        positions: invalidChars.map(ic => ic.pos),
      } as StructureError);
    }

    return errors;
  }

  /**
   * Extract the World Manufacturer Identifier from a VIN
   *
   * @param vin - Complete VIN string
   * @returns WMI code
   */
  private extractWMI(vin: string): string {
    // Handle standard and extended WMI cases
    const baseWMI = vin.substring(0, 3);

    // If position 3 is '9', this is an extended WMI, and part is encoded elsewhere in the VIN
    if (baseWMI[2] === '9' && vin.length >= 14) {
      return baseWMI + vin.substring(11, 14);
    }

    return baseWMI;
  }

  /**
   * Determine model year from VIN
   *
   * @param vin - Complete VIN string
   * @returns Model year information or null
   */
  private determineModelYear(vin: string): ModelYearResult | null {
    const yearChar = vin[9].toUpperCase();
    const position7 = vin[6].charCodeAt(0); // don't need uppercase for digits check

    // Handle '0' - some countries don't encode model year
    if (yearChar === '0') {
      return {
        year: 0,
        source: 'position' as const,
        confidence: 0,
      };
    }

    const index = modelYearCodes.indexOf(yearChar);
    if (index === -1) {
      return null;
    }

    // Position 7 determines the decade block per 49 CFR 565.15
    const baseYear = position7 >= 48 && position7 <= 57 ? 1980 : 2010;

    // Adjust year for older vehicles
    let adjustedYear = baseYear + index;

    // If the year would be in the future, subtract 30 years
    // This handles older vehicles from previous cycles
    const nextYear = new Date().getFullYear() + 1;
    if (adjustedYear > nextYear) {
      adjustedYear -= 30;
    }

    return {
      year: adjustedYear,
      source: 'position',
      confidence: 1,
    };
  }

  /**
   * Validate the check digit in a VIN
   *
   * @param vin - Complete VIN string
   * @returns Check digit validation result
   */
  private validateCheckDigit(vin: string): CheckDigitResult {
    // Check digit weights according to CFR Title 49 § 565.15(c)
    const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

    // Transliterate characters to numerical values
    const transliterate = (c: string): number => {
      const char = c.toUpperCase();

      if (/[0-9]/.test(char)) return parseInt(char, 10);

      if (/[A-Z]/.test(char)) {
        // Values according to CFR Title 49 § 565.15(c)
        switch (char) {
          case 'A':
            return 1;
          case 'B':
            return 2;
          case 'C':
            return 3;
          case 'D':
            return 4;
          case 'E':
            return 5;
          case 'F':
            return 6;
          case 'G':
            return 7;
          case 'H':
            return 8;
          case 'J':
            return 1;
          case 'K':
            return 2;
          case 'L':
            return 3;
          case 'M':
            return 4;
          case 'N':
            return 5;
          case 'P':
            return 7;
          case 'R':
            return 9;
          case 'S':
            return 2;
          case 'T':
            return 3;
          case 'U':
            return 4;
          case 'V':
            return 5;
          case 'W':
            return 6;
          case 'X':
            return 7;
          case 'Y':
            return 8;
          case 'Z':
            return 9;
          default:
            return 0;
        }
      }

      return 0;
    };

    // Calculate weighted sum
    const sum = [...vin].reduce((acc, char, idx) => acc + transliterate(char) * weights[idx], 0);

    // Calculate check digit
    const calculated = sum % 11;
    const expected = calculated === 10 ? 'X' : calculated.toString();
    const actual = vin[8].toUpperCase();

    return {
      position: 9,
      actual,
      expected,
      isValid: actual === expected,
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}
