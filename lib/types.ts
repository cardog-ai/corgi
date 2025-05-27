/**
 * Core types for the VIN decoder library
 */

/**
 * Standardized vehicle body styles
 */
export enum BodyStyle {
  SEDAN = "Sedan",
  COUPE = "Coupe",
  CONVERTIBLE = "Convertible",
  HATCHBACK = "Hatchback",
  SUV = "SUV",
  CROSSOVER = "Crossover",
  WAGON = "Wagon",
  VAN = "Van",
  MINIVAN = "Minivan",
  PICKUP = "Pickup",
  TRUCK = "Truck",
  BUS = "Bus",
  MOTORCYCLE = "Motorcycle",
  OTHER = "Other"
}

/**
 * Maps standard database body class values to user-friendly body styles
 */
export const BODY_STYLE_MAP: Record<string, BodyStyle> = {
  // Sedans and coupes
  "Sedan/Saloon": BodyStyle.SEDAN,
  "Sedan": BodyStyle.SEDAN,
  "4-Door Sedan": BodyStyle.SEDAN,
  "2-Door Sedan": BodyStyle.SEDAN,
  "4-Door Saloon": BodyStyle.SEDAN,
  "Coupe": BodyStyle.COUPE,
  "2-Door Coupe": BodyStyle.COUPE,
  "Convertible": BodyStyle.CONVERTIBLE,
  "2-Door Convertible": BodyStyle.CONVERTIBLE,
  "4-Door Convertible": BodyStyle.CONVERTIBLE,
  
  // Hatchbacks and wagons
  "Hatchback": BodyStyle.HATCHBACK,
  "3-Door Hatchback": BodyStyle.HATCHBACK,
  "5-Door Hatchback": BodyStyle.HATCHBACK,
  "Station Wagon": BodyStyle.WAGON,
  "Wagon": BodyStyle.WAGON,
  
  // SUVs and crossovers
  "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)": BodyStyle.SUV,
  "Sport Utility Vehicle (SUV)": BodyStyle.SUV,
  "SUV": BodyStyle.SUV,
  "Crossover Utility Vehicle (CUV)": BodyStyle.SUV, // Map to SUV for consistency with tests
  "Crossover": BodyStyle.SUV, // Map to SUV for consistency with tests
  
  // Vans and minivans
  "Van": BodyStyle.VAN,
  "Cargo Van": BodyStyle.VAN,
  "Minivan": BodyStyle.MINIVAN,
  "Passenger Van": BodyStyle.VAN,
  
  // Trucks and pickups
  "Pickup": BodyStyle.PICKUP,
  "Pickup Truck": BodyStyle.PICKUP,
  "Truck": BodyStyle.TRUCK,
  "Standard Pickup Truck": BodyStyle.PICKUP,
  "Extended Cab Pickup": BodyStyle.PICKUP,
  "Crew Cab Pickup": BodyStyle.PICKUP,
  
  // Bus
  "Bus": BodyStyle.BUS,
  "School Bus": BodyStyle.BUS,
  
  // Motorcycle
  "Motorcycle": BodyStyle.MOTORCYCLE,
  
  // Catch-all
  "Incomplete Vehicle": BodyStyle.OTHER,
  "Other": BodyStyle.OTHER
};

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  WARNING = "warning",
  ERROR = "error",
  FATAL = "fatal"
}

/**
 * Error category types
 */
export enum ErrorCategory {
  VALIDATION = "validation",
  STRUCTURE = "structure",
  LOOKUP = "lookup",
  PATTERN = "pattern",
  DATABASE = "database"
}

/**
 * Specific error codes with structured grouping
 */
export enum ErrorCode {
  // Structure Errors (100-199)
  INVALID_LENGTH = "100",
  INVALID_CHARACTERS = "101",

  // Validation Errors (200-299)
  INVALID_CHECK_DIGIT = "200",
  INVALID_MODEL_YEAR = "201",
  INVALID_REGION = "202",

  // Lookup Errors (300-399)
  WMI_NOT_FOUND = "300",
  MANUFACTURER_NOT_FOUND = "301",
  MAKE_NOT_FOUND = "302",

  // Pattern Errors (400-499)
  NO_PATTERNS_FOUND = "400",
  LOW_CONFIDENCE_PATTERNS = "401",
  CONFLICTING_PATTERNS = "402",

  // Database Errors (500-599)
  DATABASE_CONNECTION_ERROR = "500",
  QUERY_ERROR = "501",
  INVALID_RESULT = "502"
}

/**
 * Base error interface for all error types
 */
export interface BaseError {
  code: ErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  positions?: number[];
  details?: string;
}

/**
 * Error for validation issues (check digit, etc.)
 */
export interface ValidationError extends BaseError {
  category: ErrorCategory.VALIDATION;
  expected?: string;
  actual?: string;
}

/**
 * Error for VIN structure issues (length, characters)
 */
export interface StructureError extends BaseError {
  category: ErrorCategory.STRUCTURE;
  positions?: number[];
}

/**
 * Error for database lookup failures
 */
export interface LookupError extends BaseError {
  category: ErrorCategory.LOOKUP;
  searchKey: string;
  searchType: string;
}

/**
 * Error for pattern matching issues
 */
export interface PatternError extends BaseError {
  category: ErrorCategory.PATTERN;
  pattern?: string;
  confidence?: number;
}

/**
 * Error for database-related issues
 */
export interface DatabaseError extends BaseError {
  category: ErrorCategory.DATABASE;
  query?: string;
  params?: unknown[];
}

/**
 * Union type of all possible decoder errors
 */
export type DecodeError =
  | ValidationError
  | StructureError
  | LookupError
  | PatternError
  | DatabaseError;

/**
 * Position information for a VIN pattern
 */
export interface Position {
  start: number;
  length: number;
  value: string;
}

/**
 * Configuration options for VIN decoding
 */
export interface DecodeOptions {
  /** Include raw database records in the response */
  includeRawData?: boolean;
  
  /** Include detailed pattern matching information */
  includePatternDetails?: boolean;
  
  /** Override the detected model year */
  modelYear?: number;
  
  /** Minimum confidence threshold for pattern matches (default: 0.5) */
  confidenceThreshold?: number;
  
  /** Include timing and debug information */
  includeDiagnostics?: boolean;
}

/**
 * World Manufacturer Identifier result
 */
export interface WMIResult {
  /** 3-character WMI code from the VIN */
  code: string;
  
  /** Manufacturer name */
  manufacturer: string;
  
  /** Manufacturing country */
  country: string;
  
  /** Vehicle type */
  vehicleType: string;
  
  /** Geographic region */
  region: string;
  
  /** Vehicle make/brand */
  make: string;
}

/**
 * Model year extraction result
 */
export interface ModelYearResult {
  /** Determined model year */
  year: number;
  
  /** Source of the year determination */
  source: "position" | "override" | "calculated";
  
  /** Confidence in the year (0-1) */
  confidence: number;
}

/**
 * Check digit validation result
 */
export interface CheckDigitResult {
  /** Position in the VIN (typically 9) */
  position: number;
  
  /** Actual check digit from the VIN */
  actual: string;
  
  /** Expected check digit based on calculation */
  expected?: string;
  
  /** Whether the check digit is valid */
  isValid: boolean;
}

/**
 * Core vehicle information extracted from VIN patterns
 */
export interface VehicleInfo {
  /** Vehicle manufacturer (e.g., "Hyundai") */
  make: string;
  
  /** Vehicle model (e.g., "Kona") */
  model: string;
  
  /** Model year (e.g., 2023) */
  year: number;
  
  /** Vehicle series or sub-model */
  series?: string;
  
  /** Trim level */
  trim?: string;
  
  /** Body style (e.g., "SUV", "Sedan") */
  bodyStyle?: string;
  
  /** Drive type (e.g., "AWD", "4x2") */
  driveType?: string;
  
  /** Engine type */
  engineType?: string;
  
  /** Primary fuel type */
  fuelType?: string;
  
  /** Transmission type */
  transmission?: string;
  
  /** Number of doors */
  doors?: string;
  
  /** Vehicle manufacturer name */
  manufacturer?: string;
}

/**
 * Manufacturing plant information
 */
export interface PlantInfo {
  /** Manufacturing country */
  country: string;
  
  /** Manufacturing city */
  city?: string;
  
  /** Plant operator/manufacturer */
  manufacturer?: string;
  
  /** Plant code (from VIN position 11) */
  code: string;
}

/**
 * Engine specifications
 */
export interface EngineInfo {
  /** Engine type */
  type?: string;
  
  /** Engine model code */
  model?: string;
  
  /** Number of cylinders */
  cylinders?: string;
  
  /** Engine displacement in liters */
  displacement?: string;
  
  /** Fuel type */
  fuel?: string;
  
  /** Engine power (HP) */
  power?: string;
}

/**
 * Pattern match result from database
 */
export interface PatternMatch {
  /** Element name (e.g., "Model", "Body Class") */
  element: string;
  
  /** Element code */
  code: string;
  
  /** Attribute ID */
  attributeId: string | number | null;
  
  /** Decoded value */
  value: string | null;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** VIN positions covered by this pattern */
  positions: number[];
  
  /** Schema name */
  schema: string;
  
  /** Additional metadata */
  metadata?: {
    /** Lookup table name */
    lookupTable?: string;
    
    /** Group name */
    groupName?: string;
    
    /** Element weight for priority */
    elementWeight?: number;
    
    /** Pattern type */
    patternType?: "VDS" | "VIS";
    
    /** Original pattern string */
    rawPattern?: string;
    
    /** Match details */
    matchDetails?: {
      exactMatches?: number;
      wildcardMatches?: number;
      totalPositions?: number;
    };
  };
}

/**
 * Decoded VIN components
 */
export interface VINComponents {
  /** World Manufacturer Identifier information */
  wmi?: WMIResult;
  
  /** Model year information */
  modelYear?: ModelYearResult;
  
  /** Check digit validation */
  checkDigit?: CheckDigitResult;
  
  /** Vehicle Descriptor Section patterns */
  vds?: {
    raw: string;
    patterns: PatternMatch[];
  };
  
  /** Vehicle Identifier Section patterns */
  vis?: {
    raw: string;
    patterns: PatternMatch[];
  };
  
  /** Core vehicle information */
  vehicle?: VehicleInfo;
  
  /** Manufacturing plant information */
  plant?: PlantInfo;
  
  /** Engine specifications */
  engine?: EngineInfo;
}

/**
 * Diagnostic and timing information
 */
export interface DiagnosticInfo {
  /** Total processing time in milliseconds */
  processingTime: number;
  
  /** Overall confidence score */
  confidence: number;
  
  /** Library version */
  schemaVersion: string;
  
  /** Primary schema used for decoding */
  matchedSchema?: string;
  
  /** Total number of patterns found */
  totalPatterns?: number;
  
  /** Raw database records (if requested) */
  rawRecords?: any[];
  
  /** SQL query information (if diagnostics enabled) */
  queries?: {
    sql: string;
    params: any[];
    timing: number;
  }[];
}

/**
 * Complete VIN decoding result
 */
export interface DecodeResult {
  /** Input VIN */
  vin: string;
  
  /** Whether the VIN is valid */
  valid: boolean;
  
  /** Decoded components */
  components: VINComponents;
  
  /** Any validation or decoding errors */
  errors: DecodeError[];
  
  /** Pattern matching details (if requested) */
  patterns?: PatternMatch[];
  
  /** Diagnostic information */
  metadata?: DiagnosticInfo;
}