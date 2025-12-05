/**
 * Error severity levels
 */
export enum ErrorSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Error category types
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  STRUCTURE = 'structure',
  LOOKUP = 'lookup',
  PATTERN = 'pattern',
  DATABASE = 'database',
}

/**
 * Specific error codes with structured grouping
 */
export enum ErrorCode {
  // Structure Errors (100-199)
  INVALID_LENGTH = '100',
  INVALID_CHARACTERS = '101',

  // Validation Errors (200-299)
  INVALID_CHECK_DIGIT = '200',
  INVALID_MODEL_YEAR = '201',
  INVALID_REGION = '202',

  // Lookup Errors (300-399)
  WMI_NOT_FOUND = '300',
  MANUFACTURER_NOT_FOUND = '301',
  MAKE_NOT_FOUND = '302',

  // Pattern Errors (400-499)
  NO_PATTERNS_FOUND = '400',
  LOW_CONFIDENCE_PATTERNS = '401',
  CONFLICTING_PATTERNS = '402',

  // Database Errors (500-599)
  DATABASE_CONNECTION_ERROR = '500',
  QUERY_ERROR = '501',
  INVALID_RESULT = '502',
}

/**
 * Standardized vehicle body styles
 */
export enum BodyStyle {
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
  TRACTOR = 'Tractor',
  TRAILER = 'Trailer',
  BUS = 'Bus',
  MOTORCYCLE = 'Motorcycle',
  OTHER = 'Other',
}
