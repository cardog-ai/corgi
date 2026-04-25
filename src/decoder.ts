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

// Commercial vehicle WMIs - patterns often discontinued in federal submissions
const COMMERCIAL_WMIS = new Set([
  '1FD', '1FT', '2FD', '2FT', '3FD', '3FT',  // Ford heavy trucks
  '1HT', '1HS', '2HT', '3HT',                 // International
  '1GD', '1GB', '1GC', '2GD', '3GD',          // GM Commercial
  '1FU', '1FV', '1FW', '3AL',                 // Freightliner
  '1M1', '1M2', '1M3', '1M9',                 // Mack
  '1NK', '1XK', '2NK', '3NK',                 // Kenworth
  '1NP', '1XP', '2NP',                        // Peterbilt
  '4V4', '4VZ',                               // Volvo Trucks
  '5KK', '5KL',                               // Western Star
  '1H2', '1H4', '5PV',                        // Hino
  '4KL', '52N', 'JAL',                        // Isuzu Commercial
  '1BA', '1BU',                               // Blue Bird (buses)
]);

// Extended WMI: small-volume manufacturers (<500 vehicles/year) use 6-char WMI
// Format: positions 1-3 end in "9" + positions 12-14 form the full identifier
const EXTENDED_WMI_PREFIXES = new Set([
  '1A9', '1B9', '1C9', '1D9', '1E9', '1F9', '1G9', '1H9',
  '1J9', '1K9', '1L9', '1M9', '1N9', '1P9', '1R9', '1S9',
  '1T9', '1U9', '1V9', '1W9', '1X9', '1Y9', '1Z9',
  '2A9', '2B9', '2C9', '2D9', '2E9', '2F9', '2G9', '2H9',
  '2J9', '2K9', '2L9', '2M9', '2N9', '2P9', '2R9', '2S9',
  '2T9', '2U9', '2V9', '2W9', '2X9', '2Y9', '2Z9',
  '3A9', '3B9', '3C9', '3D9', '3E9', '3F9', '3G9', '3H9',
  '3J9', '3K9', '3L9', '3M9', '3N9', '3P9', '3R9', '3S9',
  '3T9', '3U9', '3V9', '3W9', '3X9', '3Y9', '3Z9',
  '4A9', '4B9', '4C9', '4D9', '4E9', '4F9', '4G9', '4H9',
  '4J9', '4K9', '4L9', '4M9', '4N9', '4P9', '4R9', '4S9',
  '4T9', '4U9', '4V9', '4W9', '4X9', '4Y9', '4Z9',
  '5A9', '5B9', '5C9', '5D9', '5E9', '5F9', '5G9', '5H9',
  '5J9', '5K9', '5L9', '5M9', '5N9', '5P9', '5R9', '5S9',
  '5T9', '5U9', '5V9', '5W9', '5X9', '5Y9', '5Z9',
  '8A9', '8B9', '8C9', '8D9', '8E9', '8F9', '8G9', '8H9',
  '8J9', '8K9', '8L9', '8M9', '8N9', '8P9', '8R9', '8S9',
  '8T9', '8U9', '8V9', '8W9', '8X9', '8Y9', '8Z9',
  '9A9', '9B9', '9C9', '9D9', '9E9', '9F9', '9G9', '9H9',
  '9J9', '9K9', '9L9', '9M9', '9N9', '9P9', '9R9', '9S9',
  '9T9', '9U9', '9V9', '9W9', '9X9', '9Y9', '9Z9',
]);

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
    const wmi3 = vin.slice(0, 3);
    const vds = vin.slice(3, 9);
    const vis = vin.slice(9, 17);
    const checkDigit = vin[CHECK_DIGIT_POS];
    const modelYearChar = vin[MODEL_YEAR_POS];
    const plantCode = vin[PLANT_CODE_POS];
    const serialNumber = vin.slice(11, 17);

    // Extended WMI: small-volume manufacturers use 6-char WMI (pos 1-3 + pos 12-14)
    const extendedWmi = EXTENDED_WMI_PREFIXES.has(wmi3)
      ? wmi3 + vin.slice(11, 14)
      : null;
    const wmi = extendedWmi || wmi3;

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

    // Get WMI info - try extended WMI first, fall back to 3-char
    let wmiMakes = extendedWmi ? this.wmiMakeIndex.get(extendedWmi) : undefined;
    if (!wmiMakes || wmiMakes.length === 0) {
      wmiMakes = this.wmiMakeIndex.get(wmi3);
    }

    // Get schemas for this WMI and year - try extended WMI first, fall back to 3-char
    let wmiSchemas = extendedWmi ? (this.wmiSchemaIndex.get(extendedWmi) || []) : [];
    if (wmiSchemas.length === 0) {
      wmiSchemas = this.wmiSchemaIndex.get(wmi3) || [];
    }
    const validSchemas = wmiSchemas.filter(s =>
      modelYear >= s.yearFrom && (s.yearTo === null || modelYear <= s.yearTo)
    );

    // Collect all pattern matches from valid schemas
    let allMatches: PatternMatch[] = [];

    for (const schema of validSchemas) {
      const schemaIdStr = String(schema.schemaId);
      const lookups = this.patternsIndex.get(schemaIdStr);
      if (!lookups) continue;

      const matches = matchPatterns(lookups, vds, vis, this.options.confidenceThreshold, schemaIdStr);
      allMatches = allMatches.concat(matches);
    }

    // Deduplicate and extract info
    const uniqueMatches = deduplicateMatches(allMatches);
    let vehicle = this.extractVehicleInfo(uniqueMatches, wmiMakes, modelYear);
    const engine = this.extractEngineInfo(uniqueMatches);
    const plant = this.extractPlantInfo(uniqueMatches, plantCode);

    // Check for trailer/commercial fallback
    const isTrailer = wmiMakes?.some(w => w.vehicleType === 'Trailer');
    const isCommercial = COMMERCIAL_WMIS.has(wmi3);

    // Trailer fallback: return partial decode from WMI
    if (!vehicle && isTrailer && wmiMakes && wmiMakes.length > 0) {
      const trailerInfo = wmiMakes[0];
      vehicle = {
        make: trailerInfo.manufacturer || trailerInfo.make || 'Unknown Trailer',
        model: 'Trailer',
        year: modelYear,
        bodyType: 'Trailer',
      };
      warnings.push({
        code: 'TRAILER_PARTIAL_DECODE',
        message: 'Trailer VIN decoded from WMI only (VDS patterns not available)',
      });
    }

    // Commercial vehicle fallback: return partial decode from WMI
    if (!vehicle && isCommercial && wmiMakes && wmiMakes.length > 0) {
      const commercialInfo = wmiMakes[0];
      const vehicleType = commercialInfo.vehicleType || 'Commercial Vehicle';
      vehicle = {
        make: commercialInfo.make || commercialInfo.manufacturer || 'Unknown',
        model: vehicleType,
        year: modelYear,
        bodyType: vehicleType,
      };
      warnings.push({
        code: 'COMMERCIAL_PARTIAL_DECODE',
        message: `Commercial vehicle decoded from WMI only (federal patterns discontinued for ${wmi3})`,
      });
    }

    // Calculate overall confidence
    let confidence = uniqueMatches.length > 0
      ? uniqueMatches.reduce((sum, m) => sum + m.confidence, 0) / uniqueMatches.length
      : 0;

    // Lower confidence for partial decodes
    if ((isTrailer || isCommercial) && uniqueMatches.length === 0 && vehicle) {
      confidence = 0.6;
    }

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

    // Get make from WMI lookup - select correct make when multiple exist
    if (wmiMakes && wmiMakes.length > 0) {
      if (wmiMakes.length === 1) {
        info.make = wmiMakes[0].make;
      } else {
        // Multiple makes for this WMI - match make name to manufacturer name
        const manufacturer = wmiMakes[0].manufacturer?.toUpperCase() || '';
        const matched = wmiMakes.find(wm =>
          wm.make && manufacturer.includes(wm.make.toUpperCase())
        );
        if (matched) {
          info.make = matched.make;
        } else if (wmiMakes[0].manufacturer) {
          // Use manufacturer name as make
          info.make = wmiMakes[0].manufacturer;
        } else {
          info.make = wmiMakes[0].make;
        }
      }
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
