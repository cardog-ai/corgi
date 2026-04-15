/**
 * Corgi v3 - VIN Decoder
 * Core type definitions
 */

// ============================================================================
// Enums
// ============================================================================

export enum DriveWheelConfiguration {
  FWD = 'FWD',
  RWD = 'RWD',
  AWD = 'AWD',
  FOUR_WD = '4WD',
}

export enum BodyType {
  SEDAN = 'Sedan',
  COUPE = 'Coupe',
  CONVERTIBLE = 'Convertible',
  HATCHBACK = 'Hatchback',
  SUV = 'SUV',
  CROSSOVER = 'Crossover',
  WAGON = 'Wagon',
  VAN = 'Van',
  MINIVAN = 'Minivan',
  PICKUP = 'Pickup',
  TRUCK = 'Truck',
  BUS = 'Bus',
  MOTORCYCLE = 'Motorcycle',
  OTHER = 'Other',
}

export enum PowertrainType {
  ICE = 'ICE',
  BEV = 'BEV',
  PHEV = 'PHEV',
  HEV = 'HEV',
  FCEV = 'FCEV',
}

export enum FuelType {
  GASOLINE = 'Gasoline',
  DIESEL = 'Diesel',
  ELECTRIC = 'Electric',
  HYBRID = 'Hybrid',
  HYDROGEN = 'Hydrogen',
  NATURAL_GAS = 'Natural Gas',
  PROPANE = 'Propane',
  FLEX_FUEL = 'Flex Fuel',
}

export enum TransmissionType {
  AUTOMATIC = 'Automatic',
  MANUAL = 'Manual',
  CVT = 'CVT',
  DCT = 'DCT',
  SINGLE_SPEED = 'Single Speed',
}

// ============================================================================
// Lookup Data Types (stored in binary format)
// ============================================================================

/** Pattern lookup entry - maps pattern to decoded value */
export interface Lookup {
  /** Pattern string (e.g., "AJ", "[A-C]Z*", "*****|*U") */
  pattern: string;
  /** Element code (e.g., "Model", "FuelTypePrimary", "BodyClass") */
  elementCode: string;
  /** Human-readable resolved value */
  resolved: string;
  /** Priority weight for conflict resolution (higher = preferred) */
  weight?: number;
}

/** WMI to Schema ID mapping */
export interface WmiSchema {
  schemaId: number;
  yearFrom: number;
  yearTo: number | null;
}

/** WMI to Make mapping */
export interface WmiMake {
  make: string;
  manufacturer?: string;
  country?: string;
  vehicleType?: string;
}

// ============================================================================
// Decode Output Types
// ============================================================================

/** VIN components extracted from the 17-character string */
export interface VINComponents {
  /** World Manufacturer Identifier (positions 1-3) */
  wmi: string;
  /** Vehicle Descriptor Section (positions 4-9) */
  vds: string;
  /** Vehicle Identifier Section (positions 10-17) */
  vis: string;
  /** Model year derived from position 10 */
  modelYear: number;
  /** Check digit (position 9) */
  checkDigit: string;
  /** Production sequence number (positions 12-17) */
  serialNumber: string;
}

/** Decoded vehicle information (Tier 1 - from VIN patterns only) */
export interface DecodedVehicle {
  make: string;
  model: string;
  year: number;
  series?: string;
  trim?: string;
  bodyType?: string;
  driveWheelConfiguration?: string;
  fuelType?: string;
  vehicleTransmission?: string;
  numberOfDoors?: number;
  gvwr?: string;
}

/** Decoded engine information */
export interface DecodedEngine {
  model?: string;
  cylinders?: number;
  displacement?: number;
  fuelType?: string;
  power?: number;
  configuration?: string;
}

/** Decoded plant information */
export interface DecodedPlant {
  code: string;
  country?: string;
  city?: string;
  state?: string;
}

/** Warning during decode (non-fatal) */
export interface DecodeWarning {
  code: string;
  message: string;
}

/** Error during decode (fatal) */
export interface DecodeError {
  code: string;
  message: string;
}

/** Result of VIN decoding */
export interface DecodeResult {
  /** The input VIN (normalized to uppercase) */
  vin: string;
  /** Whether decoding succeeded */
  valid: boolean;
  /** Extracted VIN components */
  components: VINComponents;
  /** Decoded vehicle info (if successful) */
  vehicle?: DecodedVehicle;
  /** Decoded engine info (if available) */
  engine?: DecodedEngine;
  /** Decoded plant info (if available) */
  plant?: DecodedPlant;
  /** Confidence score (0-1) */
  confidence: number;
  /** Non-fatal warnings */
  warnings: DecodeWarning[];
  /** Fatal errors */
  errors: DecodeError[];
}

// Legacy aliases for backwards compatibility
/** @deprecated Use DecodeWarning */
export type Warning = DecodeWarning;
/** @deprecated Use DecodeError */
export type Error = DecodeError;

// ============================================================================
// Pattern Match Types
// ============================================================================

export interface PatternMatch {
  pattern: string;
  elementCode: string;
  value: string;
  confidence: number;
  weight: number;
  positions: number[];
  /** Schema ID this pattern came from (for coherence scoring) */
  schemaId?: string;
}

// ============================================================================
// Index Types (FST structure)
// ============================================================================

/** Header for binary index file */
export interface IndexHeader {
  magic: number;        // 0x434F5247 ('CORG')
  version: number;      // Format version
  keyCount: number;     // Number of keys
  keysOffset: number;   // Offset to keys section
  keysLength: number;   // Length of keys section
  valuesOffset: number; // Offset to values section
  valuesLength: number; // Length of values section
}

/** Offsets index entry */
export interface OffsetEntry {
  keyOffset: number;
  keyLength: number;
  valueOffset: number;
  valueLength: number;
}

// ============================================================================
// Aliases for compatibility with existing lib/types.ts
// ============================================================================

/** Alias for DecodedVehicle */
export type VehicleInfo = DecodedVehicle;
/** Alias for DecodedEngine */
export type EngineInfo = DecodedEngine;
/** Alias for DecodedPlant */
export type PlantInfo = DecodedPlant;
