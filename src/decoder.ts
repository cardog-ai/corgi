/**
 * Corgi v3 - VIN Decoder
 *
 * VIN Structure (ISO 3779):
 *   Position 1-3:  WMI (World Manufacturer Identifier)
 *   Position 4-9:  VDS (Vehicle Descriptor Section)
 *   Position 9:    Check digit (North America)
 *   Position 10:   Model year code
 *   Position 11:   Plant code
 *   Position 12-17: Production sequence
 */

import { IndexReader, createIndexReader } from './index-reader.js';
import { matchPatterns, deduplicateMatches } from './pattern-matcher.js';
import type {
  Lookup,
  WmiSchema,
  WmiMake,
  DecodeResult,
  DecodedVehicle,
  DecodedEngine,
  DecodedPlant,
  PatternMatch,
  DecodeWarning,
  DecodeError,
} from './types.js';

// ============================================================================
// VIN Constants
// ============================================================================

const VIN_LENGTH = 17;
const VALID_CHARS = /^[A-HJ-NPR-Z0-9]+$/;
const CHECK_DIGIT_POS = 8;
const MODEL_YEAR_POS = 9;
const PLANT_CODE_POS = 10;

// Model year decoding (position 10)
const YEAR_CODES: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  1: 2001, 2: 2002, 3: 2003, 4: 2004, 5: 2005, 6: 2006, 7: 2007, 8: 2008, 9: 2009,
};

// Check digit weights
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

// ============================================================================
// Decoder Class
// ============================================================================

export interface DecoderOptions {
  /** Confidence threshold for pattern matching (default: 0.5) */
  confidenceThreshold?: number;
  /** Whether to validate check digit (default: true for US VINs) */
  validateCheckDigit?: boolean;
}

export class VINDecoder {
  private wmiSchemaIndex: IndexReader<WmiSchema[]>;
  private wmiMakeIndex: IndexReader<WmiMake[]>;
  private patternsIndex: IndexReader<Lookup[]>;
  private options: Required<DecoderOptions>;

  constructor(
    wmiSchemaData: Uint8Array,
    wmiMakeData: Uint8Array,
    patternsData: Uint8Array,
    options: DecoderOptions = {}
  ) {
    this.wmiSchemaIndex = createIndexReader<WmiSchema[]>(wmiSchemaData);
    this.wmiMakeIndex = createIndexReader<WmiMake[]>(wmiMakeData);
    this.patternsIndex = createIndexReader<Lookup[]>(patternsData);
    this.options = {
      confidenceThreshold: options.confidenceThreshold ?? 0.5,
      validateCheckDigit: options.validateCheckDigit ?? true,
    };
  }

  /**
   * Decode a single VIN
   */
  decode(vin: string): DecodeResult {
    const warnings: DecodeWarning[] = [];
    const errors: DecodeError[] = [];

    // Normalize
    vin = vin.toUpperCase().trim();

    // Basic validation
    if (vin.length !== VIN_LENGTH) {
      return this.errorResult(vin, [{
        code: 'INVALID_LENGTH',
        message: `VIN must be ${VIN_LENGTH} characters, got ${vin.length}`,
      }]);
    }

    if (!VALID_CHARS.test(vin)) {
      const invalid = vin.split('').filter(c => !VALID_CHARS.test(c));
      return this.errorResult(vin, [{
        code: 'INVALID_CHARACTERS',
        message: `Invalid characters: ${invalid.join(', ')}`,
      }]);
    }

    // Extract components
    const wmi = vin.slice(0, 3);
    const vds = vin.slice(3, 9);
    const vis = vin.slice(9, 17);
    const checkDigit = vin[CHECK_DIGIT_POS];
    const modelYearChar = vin[MODEL_YEAR_POS];
    const plantCode = vin[PLANT_CODE_POS];
    const serialNumber = vin.slice(11, 17);

    // Model year
    const modelYear = YEAR_CODES[modelYearChar];
    if (!modelYear) {
      warnings.push({
        code: 'UNKNOWN_MODEL_YEAR',
        message: `Unknown model year code: ${modelYearChar}`,
      });
    }

    // Check digit validation (US VINs only)
    const checkDigitValid = checkDigit === '0' || checkDigit === '1' || checkDigit === '2' ||
                           checkDigit === '3' || checkDigit === '4' || checkDigit === '5' ||
                           checkDigit === '6' || checkDigit === '7' || checkDigit === '8' ||
                           checkDigit === '9' || checkDigit === 'X';

    if (this.options.validateCheckDigit && !checkDigitValid) {
      // Non-standard check digit (common in EU VINs)
      warnings.push({
        code: 'NON_STANDARD_CHECK_DIGIT',
        message: `Non-standard check digit: ${checkDigit} (common in non-US vehicles)`,
      });
    } else if (this.options.validateCheckDigit && checkDigitValid) {
      const calculated = this.calculateCheckDigit(vin);
      if (calculated !== checkDigit) {
        warnings.push({
          code: 'CHECK_DIGIT_MISMATCH',
          message: `Check digit mismatch: expected ${calculated}, got ${checkDigit}`,
        });
      }
    }

    // Get WMI info
    const wmiMakes = this.wmiMakeIndex.get(wmi);

    // Get schemas for this WMI and year
    const wmiSchemas = this.wmiSchemaIndex.get(wmi) || [];
    const validSchemas = wmiSchemas.filter(s =>
      modelYear >= s.yearFrom && (s.yearTo === null || modelYear <= s.yearTo)
    );

    // Collect all pattern matches from valid schemas
    let allMatches: PatternMatch[] = [];

    for (const schema of validSchemas) {
      const lookups = this.patternsIndex.get(String(schema.schemaId));
      if (!lookups) continue;

      const matches = matchPatterns(lookups, vds, vis, this.options.confidenceThreshold);
      allMatches = allMatches.concat(matches);
    }

    // Deduplicate and extract info
    const uniqueMatches = deduplicateMatches(allMatches);
    const vehicle = this.extractVehicleInfo(uniqueMatches, wmiMakes, modelYear);
    const engine = this.extractEngineInfo(uniqueMatches);
    const plant = this.extractPlantInfo(uniqueMatches, plantCode);

    // Calculate overall confidence
    const confidence = uniqueMatches.length > 0
      ? uniqueMatches.reduce((sum, m) => sum + m.confidence, 0) / uniqueMatches.length
      : 0;

    return {
      vin,
      valid: errors.length === 0 && vehicle !== undefined,
      components: {
        wmi,
        vds,
        vis,
        modelYear: modelYear || 0,
        checkDigit,
        serialNumber,
      },
      vehicle,
      engine: engine && Object.keys(engine).length > 0 ? engine : undefined,
      plant,
      confidence,
      warnings,
      errors,
    };
  }

  /**
   * Decode multiple VINs in batch
   */
  decodeBatch(vins: string[]): DecodeResult[] {
    return vins.map(vin => this.decode(vin));
  }

  /**
   * Calculate check digit for US VINs
   */
  private calculateCheckDigit(vin: string): string {
    let sum = 0;

    for (let i = 0; i < 17; i++) {
      const char = vin[i];
      let value: number;

      if (/[0-9]/.test(char)) {
        value = parseInt(char, 10);
      } else {
        value = TRANSLITERATION[char] || 0;
      }

      sum += value * WEIGHTS[i];
    }

    const remainder = sum % 11;
    return remainder === 10 ? 'X' : String(remainder);
  }

  /**
   * Extract vehicle info from matches
   */
  private extractVehicleInfo(
    matches: PatternMatch[],
    wmiMakes: WmiMake[] | undefined,
    modelYear: number
  ): DecodedVehicle | undefined {
    const info: Partial<DecodedVehicle> = { year: modelYear };

    // Get make from WMI lookup first
    if (wmiMakes && wmiMakes.length > 0) {
      info.make = wmiMakes[0].make;
    }

    for (const match of matches) {
      switch (match.elementCode) {
        case 'Make':
          info.make = match.value;
          break;
        case 'Model':
          info.model = match.value;
          break;
        case 'Series':
          info.series = match.value;
          break;
        case 'Trim':
        case 'Trim Level':
          info.trim = match.value;
          break;
        case 'Body Class':
        case 'Body Style':
          info.bodyType = match.value;
          break;
        case 'Drive Type':
          info.driveWheelConfiguration = match.value;
          break;
        case 'Fuel Type - Primary':
          info.fuelType = match.value;
          break;
        case 'Transmission Style':
          info.vehicleTransmission = match.value;
          break;
        case 'Doors':
          info.numberOfDoors = parseInt(match.value, 10) || undefined;
          break;
        case 'Gross Vehicle Weight Rating From':
          info.gvwr = match.value;
          break;
      }
    }

    // Must have at least make and model
    if (!info.make || !info.model) {
      return undefined;
    }

    return info as DecodedVehicle;
  }

  /**
   * Extract engine info from matches
   */
  private extractEngineInfo(matches: PatternMatch[]): DecodedEngine | undefined {
    const info: Partial<DecodedEngine> = {};

    for (const match of matches) {
      switch (match.elementCode) {
        case 'Engine Model':
          info.model = match.value;
          break;
        case 'Engine Number of Cylinders':
        case 'Cylinders':
          info.cylinders = parseInt(match.value, 10) || undefined;
          break;
        case 'Displacement (L)':
          info.displacement = parseFloat(match.value) || undefined;
          break;
        case 'Fuel Type - Primary':
        case 'Fuel Type':
          info.fuelType = match.value;
          break;
        case 'Engine Brake (hp) From':
        case 'Engine Power (kW)':
          info.power = parseFloat(match.value) || undefined;
          break;
        case 'Engine Configuration':
          info.configuration = match.value;
          break;
      }
    }

    return Object.keys(info).length > 0 ? info as DecodedEngine : undefined;
  }

  /**
   * Extract plant info from matches
   */
  private extractPlantInfo(matches: PatternMatch[], plantCode: string): DecodedPlant | undefined {
    const info: Partial<DecodedPlant> = { code: plantCode };

    for (const match of matches) {
      const element = match.elementCode.toLowerCase();
      if (element.includes('plant country') || element === 'country name') {
        info.country = match.value;
      } else if (element.includes('plant city')) {
        info.city = match.value;
      } else if (element.includes('plant state')) {
        info.state = match.value;
      }
    }

    if (!info.country) {
      return undefined;
    }

    return info as DecodedPlant;
  }

  /**
   * Create error result
   */
  private errorResult(vin: string, errors: DecodeError[]): DecodeResult {
    return {
      vin,
      valid: false,
      components: {
        wmi: vin.slice(0, 3),
        vds: vin.slice(3, 9),
        vis: vin.slice(9, 17),
        modelYear: 0,
        checkDigit: vin[CHECK_DIGIT_POS] || '',
        serialNumber: vin.slice(11, 17),
      },
      confidence: 0,
      warnings: [],
      errors,
    };
  }
}
