/**
 * Community VIN Pattern Schema Validation
 *
 * Zod schemas for validating community YAML files before processing.
 */

import { z } from "zod";

// Valid VIN characters (no I, O, Q)
const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const PATTERN_CHARS = VIN_CHARS + "*";

// Valid element names from VPIC
export const VALID_ELEMENTS = [
  "Model",
  "Body Class",
  "Doors",
  "Drive Type",
  "Fuel Type - Primary",
  "Electrification Level",
  "Transmission",
  "Plant City",
  "Plant Country",
  "Other Engine Info",
  "Other Restraint System Info",
  "Gross Vehicle Weight Rating From",
  "Engine Configuration",
  "Engine Cylinders",
  "Displacement (L)",
  "Turbo",
  "Valve Train Design",
  "Series",
  "Trim",
] as const;

// Valid vehicle types from VPIC
export const VALID_VEHICLE_TYPES = [
  "Passenger Car",
  "Multipurpose Passenger Vehicle (MPV)",
  "Truck",
  "Bus",
  "Trailer",
  "Motorcycle",
  "Low Speed Vehicle (LSV)",
  "Incomplete Vehicle",
  "Off Road Vehicle",
] as const;

// Valid source types
export const VALID_SOURCE_TYPES = [
  "service_manual",
  "regulatory",
  "oem_documentation",
  "community",
] as const;

// Valid modes
export const VALID_MODES = ["new", "supplement"] as const;

// ============================================================================
// Helper Validators
// ============================================================================

/**
 * Validates a 3-character WMI code
 */
const wmiSchema = z
  .string()
  .length(3, "WMI must be exactly 3 characters")
  .regex(
    new RegExp(`^[${VIN_CHARS}]{3}$`),
    "WMI can only contain valid VIN characters (no I, O, Q)"
  );

/**
 * Validates a 6-character pattern for positions 4-9
 */
const patternStringSchema = z
  .string()
  .length(6, "Pattern must be exactly 6 characters (positions 4-9)")
  .regex(
    new RegExp(`^[${PATTERN_CHARS}]{6}$`),
    "Pattern can only contain valid VIN characters or * wildcard"
  );

/**
 * Validates a 17-character VIN
 */
const vinSchema = z
  .string()
  .length(17, "VIN must be exactly 17 characters")
  .regex(
    new RegExp(`^[${VIN_CHARS}]{17}$`),
    "VIN can only contain valid VIN characters (no I, O, Q)"
  );

/**
 * Validates VIN check digit (position 9)
 */
function validateCheckDigit(vin: string): { valid: boolean; expected: string } {
  const transliteration: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };

  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i];
    const value = /\d/.test(char) ? parseInt(char) : transliteration[char] || 0;
    sum += value * weights[i];
  }

  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);

  return {
    valid: vin[8] === expected,
    expected,
  };
}

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Source documentation schema
 */
const sourceSchema = z.object({
  type: z.enum(VALID_SOURCE_TYPES, {
    errorMap: () => ({
      message: `Source type must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
    }),
  }),
  url: z.string().url().optional(),
  description: z.string().min(1, "Source description is required"),
});

/**
 * Year range schema
 */
const yearsSchema = z
  .object({
    from: z
      .number()
      .int()
      .min(1980, "Year must be 1980 or later")
      .max(2100, "Year must be 2100 or earlier"),
    to: z
      .number()
      .int()
      .min(1980, "Year must be 1980 or later")
      .max(2100, "Year must be 2100 or earlier")
      .nullable(),
  })
  .refine(
    (data) => data.to === null || data.to >= data.from,
    "End year must be greater than or equal to start year"
  );

/**
 * Pattern definition schema
 */
const patternSchema = z.object({
  pattern: patternStringSchema,
  element: z.enum(VALID_ELEMENTS as unknown as [string, ...string[]], {
    errorMap: () => ({
      message: `Element must be one of: ${VALID_ELEMENTS.join(", ")}`,
    }),
  }),
  value: z.string().min(1, "Pattern value is required"),
});

/**
 * Expected values in test VIN schema
 */
const expectedValuesSchema = z
  .object({
    make: z.string().optional(),
    model: z.string().optional(),
    body_class: z.string().optional(),
    drive_type: z.string().optional(),
    year: z.number().int().optional(),
    fuel_type: z.string().optional(),
    plant_city: z.string().optional(),
    plant_country: z.string().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one expected value is required"
  );

/**
 * Test VIN schema
 */
const testVinSchema = z.object({
  vin: vinSchema,
  expected: expectedValuesSchema,
});

/**
 * Main WMI schema for new WMIs
 */
export const wmiFileSchema = z
  .object({
    wmi: wmiSchema,
    mode: z.enum(VALID_MODES).optional().default("new"),
    manufacturer: z.string().min(1, "Manufacturer is required"),
    make: z.string().min(1, "Make is required"),
    country: z.string().min(1, "Country is required"),
    vehicle_type: z.enum(VALID_VEHICLE_TYPES as unknown as [string, ...string[]], {
      errorMap: () => ({
        message: `Vehicle type must be one of: ${VALID_VEHICLE_TYPES.join(", ")}`,
      }),
    }),
    years: yearsSchema,
    schema_name: z.string().optional(),
    sources: z
      .array(sourceSchema)
      .min(1, "At least one source is required"),
    patterns: z
      .array(patternSchema)
      .min(1, "At least one pattern is required"),
    test_vins: z
      .array(testVinSchema)
      .min(1, "At least one test VIN is required"),
  })
  .superRefine((data, ctx) => {
    // Check for duplicate patterns (same pattern + element)
    const seen = new Set<string>();
    for (let i = 0; i < data.patterns.length; i++) {
      const key = `${data.patterns[i].pattern}|${data.patterns[i].element}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate pattern: ${data.patterns[i].pattern} for element ${data.patterns[i].element}`,
          path: ["patterns", i],
        });
      }
      seen.add(key);
    }

    // Validate check digits for test VINs
    for (let i = 0; i < data.test_vins.length; i++) {
      const vin = data.test_vins[i].vin;
      const check = validateCheckDigit(vin);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid check digit: position 9 is '${vin[8]}', expected '${check.expected}'`,
          path: ["test_vins", i, "vin"],
        });
      }

      // Validate that test VIN starts with the WMI
      if (!vin.startsWith(data.wmi)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Test VIN must start with WMI '${data.wmi}', got '${vin.substring(0, 3)}'`,
          path: ["test_vins", i, "vin"],
        });
      }
    }
  });

/**
 * Supplemental schema (for adding patterns to existing WMIs)
 */
export const supplementalFileSchema = z
  .object({
    wmi: wmiSchema,
    mode: z.literal("supplement"),
    sources: z
      .array(sourceSchema)
      .min(1, "At least one source is required"),
    patterns: z
      .array(patternSchema)
      .min(1, "At least one pattern is required"),
    test_vins: z
      .array(testVinSchema)
      .min(1, "At least one test VIN is required"),
    // Optional overrides for supplemental
    schema_name: z.string().optional(),
    years: yearsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Same validations as main schema
    const seen = new Set<string>();
    for (let i = 0; i < data.patterns.length; i++) {
      const key = `${data.patterns[i].pattern}|${data.patterns[i].element}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate pattern: ${data.patterns[i].pattern} for element ${data.patterns[i].element}`,
          path: ["patterns", i],
        });
      }
      seen.add(key);
    }

    for (let i = 0; i < data.test_vins.length; i++) {
      const vin = data.test_vins[i].vin;
      const check = validateCheckDigit(vin);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid check digit: position 9 is '${vin[8]}', expected '${check.expected}'`,
          path: ["test_vins", i, "vin"],
        });
      }

      if (!vin.startsWith(data.wmi)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Test VIN must start with WMI '${data.wmi}', got '${vin.substring(0, 3)}'`,
          path: ["test_vins", i, "vin"],
        });
      }
    }
  });

// ============================================================================
// Type Exports
// ============================================================================

export type WmiFile = z.infer<typeof wmiFileSchema>;
export type SupplementalFile = z.infer<typeof supplementalFileSchema>;
export type Pattern = z.infer<typeof patternSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type TestVin = z.infer<typeof testVinSchema>;

// ============================================================================
// Validation Function
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
  data?: WmiFile | SupplementalFile;
}

/**
 * Validates a parsed YAML object against the schema
 */
export function validateWmiFile(data: unknown): ValidationResult {
  const warnings: ValidationResult["warnings"] = [];

  // Determine which schema to use based on mode
  const mode = (data as Record<string, unknown>)?.mode;
  const schema = mode === "supplement" ? supplementalFileSchema : wmiFileSchema;

  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      warnings,
    };
  }

  // Add warnings for potential issues
  const validData = result.data;

  // Warn if only community source
  const hasOfficialSource = validData.sources.some(
    (s) => s.type !== "community"
  );
  if (!hasOfficialSource) {
    warnings.push({
      path: "sources",
      message:
        "Only community sources provided. Consider adding official documentation.",
    });
  }

  // Warn if only one test VIN
  if (validData.test_vins.length < 3) {
    warnings.push({
      path: "test_vins",
      message: `Only ${validData.test_vins.length} test VIN(s) provided. Recommend at least 3.`,
    });
  }

  // Warn about fully wildcard patterns (all 6 positions)
  for (let i = 0; i < validData.patterns.length; i++) {
    const pattern = validData.patterns[i];
    if (pattern.pattern === "******") {
      // Only warn if it's not a "universal" element like fuel type or plant
      const universalElements = [
        "Fuel Type - Primary",
        "Electrification Level",
        "Plant City",
        "Plant Country",
      ];
      if (!universalElements.includes(pattern.element)) {
        warnings.push({
          path: `patterns.${i}`,
          message: `Pattern '******' is fully wildcard for element '${pattern.element}'. This applies to all VINs.`,
        });
      }
    }
  }

  return {
    valid: true,
    errors: [],
    warnings,
    data: validData as WmiFile | SupplementalFile,
  };
}
