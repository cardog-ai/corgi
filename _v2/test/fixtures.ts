/**
 * Test fixtures for comprehensive VIN decoder testing
 * VINs sourced from Cardog production database
 */

import { BodyStyle } from "../lib/types";

export interface VINTestCase {
  vin: string;
  expected: {
    make: string;
    model: string;
    year: number;
    bodyStyle?: BodyStyle;
  };
  description?: string;
}

export interface ProblematicVINTestCase extends VINTestCase {
  issue?: string;
  nhtsaExpected?: {
    make: string;
    model: string;
    year: number;
  };
}

/**
 * Problematic VINs from GitHub issues that have known decoding issues
 * These are critical regression tests
 */
export const PROBLEMATIC_VINS: ProblematicVINTestCase[] = [
  {
    // GitHub Issue #22 - F-150 incorrectly decoded as F-550
    vin: "1FTFW5L86RFB45612",
    expected: {
      make: "Ford",
      model: "F-150",
      year: 2024,
    },
    nhtsaExpected: {
      make: "Ford",
      model: "F-150",
      year: 2024,
    },
    issue: "https://github.com/cardog-ai/corgi/issues/22",
    description: "F-150 incorrectly decoded as F-550 due to pattern weight issues",
  },
  {
    // GitHub Issue #22 - Subaru VIN mentioned
    vin: "4S4SLDB69T3023252",
    expected: {
      make: "Subaru",
      model: "Forester", // Expected model based on VIN structure
      year: 2026,
    },
    issue: "https://github.com/cardog-ai/corgi/issues/22",
    description: "Subaru VIN mentioned in issue as problematic",
  },
];

/**
 * Ford F-Series VINs for testing truck model differentiation
 * Critical for ensuring F-150/F-250/F-350/F-450/F-550 are correctly identified
 */
export const FORD_F_SERIES_VINS: VINTestCase[] = [
  {
    vin: "1FTEX1CM8EFB88051",
    expected: { make: "Ford", model: "F-150", year: 2014, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTFW1E59NKD69096",
    expected: { make: "Ford", model: "F-150", year: 2022, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTMF1CB8LKE83281",
    expected: { make: "Ford", model: "F-150", year: 2020, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTEW3LP3SKE46696",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTFW5L88TFA10526",
    expected: { make: "Ford", model: "F-150", year: 2026, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTEW2LP6SKE65351",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTEW1EP5NKE29730",
    expected: { make: "Ford", model: "F-150", year: 2022, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTEW3LP4SKD87111",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTFW1E59NKE32102",
    expected: { make: "Ford", model: "F-150", year: 2022, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTEW2L57SFC06715",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FT8W3BT0REF19088",
    expected: { make: "Ford", model: "F-350", year: 2024, bodyStyle: BodyStyle.PICKUP },
    description: "F-350 Super Duty",
  },
  {
    vin: "1FTFW5L89SKF07106",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTFW1EF7BFB11754",
    expected: { make: "Ford", model: "F-150", year: 2011, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTEW3LP9SKE98169",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FTFW1EV2AFB19783",
    expected: { make: "Ford", model: "F-150", year: 2010, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FT8W3BN0TED89595",
    expected: { make: "Ford", model: "F-350", year: 2026, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FT6W7L77SWG24842",
    expected: { make: "Ford", model: "F-150 Lightning", year: 2025, bodyStyle: BodyStyle.PICKUP },
    description: "F-150 Lightning electric truck",
  },
  // Different F-Series models for model differentiation
  {
    vin: "1FTFW4L84SFB52686",
    expected: { make: "Ford", model: "F-150", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FT7W2BT2TEC24023",
    expected: { make: "Ford", model: "F-250", year: 2026, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FT7W2BT3JEB02011",
    expected: { make: "Ford", model: "F-250", year: 2018, bodyStyle: BodyStyle.PICKUP },
    description: "F-250 Super Duty",
  },
  {
    vin: "1FT8W3DT0SEC32031",
    expected: { make: "Ford", model: "F-350", year: 2025, bodyStyle: BodyStyle.PICKUP },
  },
  {
    vin: "1FT8W3BT6FEB34730",
    expected: { make: "Ford", model: "F-350", year: 2015, bodyStyle: BodyStyle.PICKUP },
    description: "F-350 Super Duty",
  },
  {
    vin: "1FDUF4GN1RDA21062",
    expected: { make: "Ford", model: "F-450", year: 2024 },
  },
  {
    vin: "1FDUF5HT8TDA00915",
    expected: { make: "Ford", model: "F-550", year: 2026 },
  },
];

/**
 * VINs by make for comprehensive manufacturer coverage
 */
export const VINS_BY_MAKE: Record<string, VINTestCase[]> = {
  BMW: [
    { vin: "WBAVL1C5XFVY41004", expected: { make: "BMW", model: "X1", year: 2015, bodyStyle: BodyStyle.SUV } },
    { vin: "5UXWX9C58F0D45921", expected: { make: "BMW", model: "X3", year: 2015, bodyStyle: BodyStyle.SUV } },
    { vin: "5UXCY6C07L9C95894", expected: { make: "BMW", model: "X6", year: 2020, bodyStyle: BodyStyle.SUV } },
    { vin: "5UX63DP06R9U65632", expected: { make: "BMW", model: "X3", year: 2024 } },
    { vin: "WBX73EF02T5577908", expected: { make: "BMW", model: "X1", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  Chevrolet: [
    { vin: "3GNKBHR47NS184058", expected: { make: "Chevrolet", model: "Blazer", year: 2022, bodyStyle: BodyStyle.SUV } },
    { vin: "3GNKDCRJ7RS147570", expected: { make: "Chevrolet", model: "Blazer EV", year: 2024, bodyStyle: BodyStyle.SUV } },
    { vin: "1G1YC2D47T5102754", expected: { make: "Chevrolet", model: "Corvette", year: 2026, bodyStyle: BodyStyle.COUPE } },
    { vin: "KL77LJE29TC062289", expected: { make: "Chevrolet", model: "Trax", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "KL77LJE21TC004791", expected: { make: "Chevrolet", model: "Trax", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  Ford: [
    { vin: "1FTEW3LP9SFA08077", expected: { make: "Ford", model: "F-150", year: 2025 } },
    { vin: "3FTTW8A35SRA58370", expected: { make: "Ford", model: "Maverick", year: 2025, bodyStyle: BodyStyle.PICKUP } },
    { vin: "1FAGP8FF8S5112755", expected: { make: "Ford", model: "Mustang", year: 2025, bodyStyle: BodyStyle.CONVERTIBLE } },
    { vin: "3FMCR9DA1SRE41113", expected: { make: "Ford", model: "Bronco Sport", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "1FMCU9GN1TUA36201", expected: { make: "Ford", model: "Escape", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  GMC: [
    { vin: "2GKFLTEK4H6343592", expected: { make: "GMC", model: "Terrain", year: 2017, bodyStyle: BodyStyle.SUV } },
    { vin: "1GT49VEY4LF338098", expected: { make: "GMC", model: "Sierra 3500HD", year: 2020, bodyStyle: BodyStyle.PICKUP } },
    { vin: "1GT4UVEY9SF358134", expected: { make: "GMC", model: "Sierra 3500HD", year: 2025, bodyStyle: BodyStyle.PICKUP } },
    { vin: "3GKALUEG5SL191305", expected: { make: "GMC", model: "Terrain", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "1GKENPKS9TJ130604", expected: { make: "GMC", model: "Acadia", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  Honda: [
    { vin: "2HKRW2H20NH207506", expected: { make: "Honda", model: "CR-V", year: 2022, bodyStyle: BodyStyle.SUV } },
    { vin: "2HGFE4F86SH011469", expected: { make: "Honda", model: "Civic", year: 2025, bodyStyle: BodyStyle.SEDAN } },
    { vin: "2HKRS6H50TH219620", expected: { make: "Honda", model: "CR-V", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "2HKRS6H56TH206550", expected: { make: "Honda", model: "CR-V", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "2HKRS6H58TH224757", expected: { make: "Honda", model: "CR-V", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  Hyundai: [
    { vin: "5NMS3CAA0LH217545", expected: { make: "Hyundai", model: "Santa Fe", year: 2020, bodyStyle: BodyStyle.SUV } },
    { vin: "KM8R5DGE3PU560806", expected: { make: "Hyundai", model: "Palisade", year: 2023, bodyStyle: BodyStyle.SUV } },
    { vin: "KMHRC8A33RU325703", expected: { make: "Hyundai", model: "Venue", year: 2024, bodyStyle: BodyStyle.WAGON } },
    { vin: "KM8JDDD23SU377666", expected: { make: "Hyundai", model: "Tucson", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "KM8HACAB5SU275906", expected: { make: "Hyundai", model: "Kona", year: 2025, bodyStyle: BodyStyle.SUV } },
  ],
  Jeep: [
    { vin: "1C4RJKBG0S8730795", expected: { make: "Jeep", model: "Grand Cherokee L", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "3C4NJDBN1ST538862", expected: { make: "Jeep", model: "Compass", year: 2025 } },
    { vin: "1C6RJTBG8TL161612", expected: { make: "Jeep", model: "Gladiator", year: 2026, bodyStyle: BodyStyle.PICKUP } },
    { vin: "3C4NJDDN8TT247869", expected: { make: "Jeep", model: "Compass", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "3C4NJDBN0TT212830", expected: { make: "Jeep", model: "Compass", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "1C4PJMBN0PD109492", expected: { make: "Jeep", model: "Cherokee", year: 2023, bodyStyle: BodyStyle.SUV } },
    { vin: "1C4PJMMBXPD109289", expected: { make: "Jeep", model: "Cherokee", year: 2023, bodyStyle: BodyStyle.SUV } },
    { vin: "1C4PJMCBXKD279503", expected: { make: "Jeep", model: "Cherokee", year: 2019, bodyStyle: BodyStyle.SUV } },
    { vin: "1C4PJMDX7KD188313", expected: { make: "Jeep", model: "Cherokee", year: 2019, bodyStyle: BodyStyle.SUV } },
    { vin: "1C4PJMBXXJD592546", expected: { make: "Jeep", model: "Cherokee", year: 2018, bodyStyle: BodyStyle.SUV } },
  ],
  Kia: [
    { vin: "KNDERCAA9M7182895", expected: { make: "Kia", model: "Seltos", year: 2021, bodyStyle: BodyStyle.SUV } },
    { vin: "3KPF54AD7ME321714", expected: { make: "Kia", model: "Forte", year: 2021, bodyStyle: BodyStyle.SEDAN } },
    { vin: "5XYP5DGC3SG621138", expected: { make: "Kia", model: "Telluride", year: 2025 } },
    { vin: "KNDPUCDF9S7368156", expected: { make: "Kia", model: "Sportage", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "3KPFT4DE7SE200978", expected: { make: "Kia", model: "K4", year: 2025, bodyStyle: BodyStyle.SEDAN } },
  ],
  Mazda: [
    { vin: "JM3TCBCY6M0454042", expected: { make: "Mazda", model: "CX-9", year: 2021, bodyStyle: BodyStyle.SUV } },
    { vin: "JM3TCBDY2P0645072", expected: { make: "Mazda", model: "CX-9", year: 2023, bodyStyle: BodyStyle.SUV } },
    { vin: "JM3KFBCM8P0225916", expected: { make: "Mazda", model: "CX-5", year: 2023, bodyStyle: BodyStyle.SUV } },
    { vin: "JM1NDAM79S0658829", expected: { make: "Mazda", model: "MX-5", year: 2025, bodyStyle: BodyStyle.CONVERTIBLE } },
    { vin: "JM3KJDHDXS1128660", expected: { make: "Mazda", model: "CX-70", year: 2025, bodyStyle: BodyStyle.SUV } },
  ],
  "Mercedes-Benz": [
    { vin: "WDC0G8EB1LV225517", expected: { make: "Mercedes-Benz", model: "GLC", year: 2020, bodyStyle: BodyStyle.SUV } },
    { vin: "W1N0G8EB1MV319798", expected: { make: "Mercedes-Benz", model: "GLC", year: 2021, bodyStyle: BodyStyle.SUV } },
    { vin: "W1KWF8EB3MR649946", expected: { make: "Mercedes-Benz", model: "C-Class", year: 2021, bodyStyle: BodyStyle.SEDAN } },
    { vin: "W1KWK6EB1PG120303", expected: { make: "Mercedes-Benz", model: "C-Class", year: 2023, bodyStyle: BodyStyle.CONVERTIBLE } },
    { vin: "4JGFD6BB8TB572566", expected: { make: "Mercedes-Benz", model: "GLE", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  Nissan: [
    { vin: "5N1AT2MVXLC807279", expected: { make: "Nissan", model: "Rogue", year: 2020, bodyStyle: BodyStyle.SUV } },
    { vin: "JN1BJ1AW5PW109661", expected: { make: "Nissan", model: "Qashqai", year: 2023 } },
    { vin: "3N8AP6CB1SL419565", expected: { make: "Nissan", model: "Kicks", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JN8BT3AB4SW412749", expected: { make: "Nissan", model: "Rogue", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JN8BT3BB7TW089619", expected: { make: "Nissan", model: "Rogue", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
  RAM: [
    { vin: "1C6SRFETXKN545625", expected: { make: "RAM", model: "1500", year: 2019, bodyStyle: BodyStyle.PICKUP } },
    { vin: "3C6UR5DL8NG108210", expected: { make: "RAM", model: "2500", year: 2022, bodyStyle: BodyStyle.PICKUP } },
    { vin: "3C6MRVSGXSE503535", expected: { make: "RAM", model: "ProMaster 3500", year: 2025, bodyStyle: BodyStyle.VAN } },
    { vin: "1C6SRFLP2TN241485", expected: { make: "RAM", model: "1500", year: 2026, bodyStyle: BodyStyle.PICKUP } },
    { vin: "1C6SRFLPXTN198921", expected: { make: "RAM", model: "1500", year: 2026, bodyStyle: BodyStyle.PICKUP } },
  ],
  Subaru: [
    { vin: "JF2GUADC6S8315811", expected: { make: "Subaru", model: "Crosstrek", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "4S4GUHU63S3737318", expected: { make: "Subaru", model: "Crosstrek", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JF2SLDRC1SH457958", expected: { make: "Subaru", model: "Forester", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JF2SLDDC0SH493602", expected: { make: "Subaru", model: "Forester", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JF2GUHFC6T8216428", expected: { make: "Subaru", model: "Crosstrek", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "JF2GTABC3L8272553", expected: { make: "Subaru", model: "Crosstrek", year: 2020, bodyStyle: BodyStyle.SUV } },
    { vin: "JF1VBAL68P9806699", expected: { make: "Subaru", model: "WRX", year: 2023, bodyStyle: BodyStyle.SEDAN } },
    { vin: "JF2SLDRC5SH534153", expected: { make: "Subaru", model: "Forester", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JF2SLDHC2TH459074", expected: { make: "Subaru", model: "Forester", year: 2026, bodyStyle: BodyStyle.SUV } },
    { vin: "JF1VBAZ67S9808671", expected: { make: "Subaru", model: "WRX", year: 2025, bodyStyle: BodyStyle.SEDAN } },
  ],
  Toyota: [
    { vin: "JTDBBRBE6LJ007243", expected: { make: "Toyota", model: "Corolla", year: 2020 } },
    { vin: "JTNKHMBX1L1083032", expected: { make: "Toyota", model: "C-HR", year: 2020, bodyStyle: BodyStyle.SUV } },
    { vin: "2T3B1RFV0SC582226", expected: { make: "Toyota", model: "RAV4", year: 2025, bodyStyle: BodyStyle.SUV } },
    { vin: "JTDACACU8T3062569", expected: { make: "Toyota", model: "Prius", year: 2026, bodyStyle: BodyStyle.HATCHBACK } },
    { vin: "3TYLB5JN8TT109813", expected: { make: "Toyota", model: "Tacoma", year: 2026, bodyStyle: BodyStyle.PICKUP } },
  ],
  Volkswagen: [
    { vin: "3VWR17AU5KM502465", expected: { make: "Volkswagen", model: "Golf", year: 2019 } },
    { vin: "3VV4B7AX5MM144910", expected: { make: "Volkswagen", model: "Tiguan", year: 2021, bodyStyle: BodyStyle.SUV } },
    { vin: "3VV4B7AX7NM043899", expected: { make: "Volkswagen", model: "Tiguan", year: 2022, bodyStyle: BodyStyle.SUV } },
    { vin: "WVWJF7CD8TW190545", expected: { make: "Volkswagen", model: "Golf R", year: 2026 } },
    { vin: "3VV4C7B25TM032025", expected: { make: "Volkswagen", model: "Taos", year: 2026, bodyStyle: BodyStyle.SUV } },
  ],
};

/**
 * VINs for different body styles
 */
export const VINS_BY_BODY_STYLE: Record<string, VINTestCase[]> = {
  Convertible: [
    { vin: "1FATP8UH1M5101621", expected: { make: "Ford", model: "Mustang", year: 2021, bodyStyle: BodyStyle.CONVERTIBLE } },
    { vin: "WDBTK72F57F202954", expected: { make: "Mercedes-Benz", model: "CLK-Class", year: 2007, bodyStyle: BodyStyle.CONVERTIBLE } },
    { vin: "4USBU53567LW92799", expected: { make: "BMW", model: "Z4", year: 2007, bodyStyle: BodyStyle.CONVERTIBLE } },
    { vin: "JTHFN45Y389019133", expected: { make: "Lexus", model: "SC 430", year: 2008, bodyStyle: BodyStyle.CONVERTIBLE } },
  ],
  Coupe: [
    { vin: "WBA3R5C57EK186393", expected: { make: "BMW", model: "4-Series", year: 2014, bodyStyle: BodyStyle.COUPE } },
    { vin: "WDBTJ56J26F166340", expected: { make: "Mercedes-Benz", model: "CLK-Class", year: 2006, bodyStyle: BodyStyle.COUPE } },
    { vin: "2HGFG12616H006196", expected: { make: "Honda", model: "Civic", year: 2006, bodyStyle: BodyStyle.COUPE } },
    { vin: "2B3CJ7DW4AH121212", expected: { make: "Dodge", model: "Challenger", year: 2010, bodyStyle: BodyStyle.COUPE } },
    { vin: "WUAC6BFR6DA902376", expected: { make: "Audi", model: "RS5", year: 2013, bodyStyle: BodyStyle.COUPE } },
  ],
  Hatchback: [
    { vin: "3VW217AU3FM090764", expected: { make: "Volkswagen", model: "Golf", year: 2015, bodyStyle: BodyStyle.HATCHBACK } },
  ],
  Minivan: [
    { vin: "2C4RC1L70PR614477", expected: { make: "Chrysler", model: "Pacifica", year: 2023, bodyStyle: BodyStyle.MINIVAN } },
  ],
  Sedan: [
    { vin: "2HGFE1E58NH081047", expected: { make: "Honda", model: "Civic", year: 2022, bodyStyle: BodyStyle.SEDAN } },
    { vin: "JTDBT923291344240", expected: { make: "Toyota", model: "Yaris", year: 2009, bodyStyle: BodyStyle.SEDAN } },
    { vin: "3FAHP0CG7AR407361", expected: { make: "Ford", model: "Fusion", year: 2010, bodyStyle: BodyStyle.SEDAN } },
    { vin: "WAUM2AF27KN066221", expected: { make: "Audi", model: "A6", year: 2019, bodyStyle: BodyStyle.SEDAN } },
    { vin: "JTHCK262785015684", expected: { make: "Lexus", model: "IS 250", year: 2008, bodyStyle: BodyStyle.SEDAN } },
    { vin: "WP0AB2Y18LSA50759", expected: { make: "Porsche", model: "Taycan", year: 2020, bodyStyle: BodyStyle.SEDAN } },
  ],
  Van: [
    { vin: "1FTBR1Y83SKA13525", expected: { make: "Ford", model: "Transit", year: 2025, bodyStyle: BodyStyle.VAN } },
  ],
  Wagon: [
    { vin: "KMHRC8A35NU136688", expected: { make: "Hyundai", model: "Venue", year: 2022, bodyStyle: BodyStyle.WAGON } },
  ],
  Pickup: [
    { vin: "1FTRX12W28FB34687", expected: { make: "Ford", model: "F-150", year: 2008, bodyStyle: BodyStyle.PICKUP } },
    { vin: "1GTGK13U83F214071", expected: { make: "GMC", model: "Sierra 1500", year: 2003, bodyStyle: BodyStyle.PICKUP } },
  ],
  SUV: [
    { vin: "JF2SH62689G711814", expected: { make: "Subaru", model: "Forester", year: 2009, bodyStyle: BodyStyle.SUV } },
    { vin: "4S4WX9JD2A4402717", expected: { make: "Subaru", model: "Tribeca", year: 2010, bodyStyle: BodyStyle.SUV } },
    { vin: "JTEBU11F470006153", expected: { make: "Toyota", model: "FJ Cruiser", year: 2007, bodyStyle: BodyStyle.SUV } },
  ],
};

/**
 * Older vehicle VINs (1995-2010) for testing historical data
 */
export const OLDER_VEHICLE_VINS: VINTestCase[] = [
  { vin: "JF2SH62689G711814", expected: { make: "Subaru", model: "Forester", year: 2009, bodyStyle: BodyStyle.SUV } },
  { vin: "JTDBT923291344240", expected: { make: "Toyota", model: "Yaris", year: 2009, bodyStyle: BodyStyle.SEDAN } },
  { vin: "WDBTK72F57F202954", expected: { make: "Mercedes-Benz", model: "CLK-Class", year: 2007, bodyStyle: BodyStyle.CONVERTIBLE } },
  { vin: "4USBU53567LW92799", expected: { make: "BMW", model: "Z4", year: 2007, bodyStyle: BodyStyle.CONVERTIBLE } },
  { vin: "3FAHP0CG7AR407361", expected: { make: "Ford", model: "Fusion", year: 2010, bodyStyle: BodyStyle.SEDAN } },
  { vin: "4S4WX9JD2A4402717", expected: { make: "Subaru", model: "Tribeca", year: 2010, bodyStyle: BodyStyle.SUV } },
  { vin: "WDBTJ56J26F166340", expected: { make: "Mercedes-Benz", model: "CLK-Class", year: 2006, bodyStyle: BodyStyle.COUPE } },
  { vin: "2HGFG12616H006196", expected: { make: "Honda", model: "Civic", year: 2006, bodyStyle: BodyStyle.COUPE } },
  { vin: "WBAVB13586PS65971", expected: { make: "BMW", model: "325", year: 2006 } },
  { vin: "2B3CJ7DW4AH121212", expected: { make: "Dodge", model: "Challenger", year: 2010, bodyStyle: BodyStyle.COUPE } },
  { vin: "1FTRX12W28FB34687", expected: { make: "Ford", model: "F-150", year: 2008, bodyStyle: BodyStyle.PICKUP } },
  { vin: "JTHFN45Y389019133", expected: { make: "Lexus", model: "SC 430", year: 2008, bodyStyle: BodyStyle.CONVERTIBLE } },
  { vin: "1GTGK13U83F214071", expected: { make: "GMC", model: "Sierra 1500", year: 2003, bodyStyle: BodyStyle.PICKUP } },
  { vin: "JTDJT123850075562", expected: { make: "Toyota", model: "Echo", year: 2005 } },
  { vin: "JTEBU11F470006153", expected: { make: "Toyota", model: "FJ Cruiser", year: 2007, bodyStyle: BodyStyle.SUV } },
];

/**
 * Luxury brand VINs for premium segment testing
 */
export const LUXURY_BRAND_VINS: VINTestCase[] = [
  { vin: "WUAC6BFR6DA902376", expected: { make: "Audi", model: "RS5", year: 2013, bodyStyle: BodyStyle.COUPE } },
  { vin: "3GYK3GM46TS148439", expected: { make: "Cadillac", model: "OPTIQ", year: 2026, bodyStyle: BodyStyle.SUV } },
  { vin: "5J8YE1H01SL802400", expected: { make: "Acura", model: "MDX", year: 2025, bodyStyle: BodyStyle.SUV } },
  { vin: "5LMPJ8KA4SJ919859", expected: { make: "Lincoln", model: "Nautilus", year: 2025 } },
  { vin: "5J8TC2H6XSL800414", expected: { make: "Acura", model: "RDX", year: 2025, bodyStyle: BodyStyle.SUV } },
  { vin: "5J8TC2H67SL803870", expected: { make: "Acura", model: "RDX", year: 2025, bodyStyle: BodyStyle.SUV } },
  { vin: "5J8TC2H86TL800638", expected: { make: "Acura", model: "RDX", year: 2026, bodyStyle: BodyStyle.SUV } },
  { vin: "WA1EAAFYXN2065837", expected: { make: "Audi", model: "Q5", year: 2022, bodyStyle: BodyStyle.SUV } },
  { vin: "2T2BAMCA8TC137310", expected: { make: "Lexus", model: "RX", year: 2026, bodyStyle: BodyStyle.SUV } },
  { vin: "WAUM2AF27KN066221", expected: { make: "Audi", model: "A6", year: 2019, bodyStyle: BodyStyle.SEDAN } },
  { vin: "5J8TC2H93LL800699", expected: { make: "Acura", model: "RDX", year: 2020, bodyStyle: BodyStyle.SUV } },
  { vin: "5J8TC2H69PL800623", expected: { make: "Acura", model: "RDX", year: 2023, bodyStyle: BodyStyle.SUV } },
  { vin: "JTHCK262785015684", expected: { make: "Lexus", model: "IS 250", year: 2008, bodyStyle: BodyStyle.SEDAN } },
  { vin: "2T2KGCEZ8RC048602", expected: { make: "Lexus", model: "NX 350", year: 2024, bodyStyle: BodyStyle.SUV } },
  { vin: "5LM5J7XCXSGL00787", expected: { make: "Lincoln", model: "Aviator", year: 2025, bodyStyle: BodyStyle.SUV } },
  { vin: "SALYB2RV4JA756586", expected: { make: "Land Rover", model: "Range Rover Velar", year: 2018, bodyStyle: BodyStyle.SUV } },
  { vin: "4W5KHNRL4RZ501903", expected: { make: "Acura", model: "ZDX", year: 2024, bodyStyle: BodyStyle.SUV } },
  { vin: "WP0AB2Y18LSA50759", expected: { make: "Porsche", model: "Taycan", year: 2020, bodyStyle: BodyStyle.SEDAN } },
  { vin: "1GYKPGRS2RZ729668", expected: { make: "Cadillac", model: "XT6", year: 2024, bodyStyle: BodyStyle.SUV } },
  { vin: "5J8YE1H93TL802186", expected: { make: "Acura", model: "MDX", year: 2026, bodyStyle: BodyStyle.SUV } },
];

/**
 * Known WMI issues where the decoder returns the wrong make
 * These are documented here for tracking and eventual fixing
 */
export const KNOWN_WMI_ISSUES: {
  vin: string;
  expectedMake: string;
  actualMake: string;
  reason: string;
}[] = [
  // Jeep VINs - WMI shared with Dodge/Chrysler group
  {
    vin: "1C4RJKBG0S8730795",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C4 shared between Chrysler brands - decoder returns Dodge instead of Jeep",
  },
  {
    vin: "3C4NJDBN1ST538862",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 3C4 shared between Chrysler brands",
  },
  {
    vin: "1C6RJTBG8TL161612",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C6 - Jeep Gladiator returns Dodge",
  },
  {
    vin: "3C4NJDDN8TT247869",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 3C4 - Jeep Compass returns Dodge",
  },
  {
    vin: "3C4NJDBN0TT212830",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 3C4 - Jeep Compass returns Dodge",
  },
  {
    vin: "1C4PJMBN0PD109492",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C4 - Jeep Cherokee returns Dodge",
  },
  {
    vin: "1C4PJMMBXPD109289",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C4 - Jeep Cherokee returns Dodge",
  },
  {
    vin: "1C4PJMCBXKD279503",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C4 - Jeep Cherokee returns Dodge",
  },
  {
    vin: "1C4PJMDX7KD188313",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C4 - Jeep Cherokee returns Dodge",
  },
  {
    vin: "1C4PJMBXXJD592546",
    expectedMake: "Jeep",
    actualMake: "Dodge",
    reason: "WMI 1C4 - Jeep Cherokee returns Dodge",
  },
  // Kia VINs - WMI shared with Hyundai group
  {
    vin: "KNDERCAA9M7182895",
    expectedMake: "Kia",
    actualMake: "Hyundai",
    reason: "WMI KND used by both Kia and Hyundai - decoder prefers Hyundai",
  },
  {
    vin: "3KPF54AD7ME321714",
    expectedMake: "Kia",
    actualMake: "Hyundai",
    reason: "WMI 3KP used by Kia - decoder returns Hyundai",
  },
  {
    vin: "5XYP5DGC3SG621138",
    expectedMake: "Kia",
    actualMake: "Hyundai",
    reason: "WMI 5XY - Kia Telluride returns Hyundai",
  },
  {
    vin: "KNDPUCDF9S7368156",
    expectedMake: "Kia",
    actualMake: "Hyundai",
    reason: "WMI KND - Kia Sportage returns Hyundai",
  },
  {
    vin: "3KPFT4DE7SE200978",
    expectedMake: "Kia",
    actualMake: "Hyundai",
    reason: "WMI 3KP - Kia K4 returns Hyundai",
  },
  // RAM VINs - WMI shared with Dodge
  {
    vin: "1C6SRFETXKN545625",
    expectedMake: "RAM",
    actualMake: "Dodge",
    reason: "WMI 1C6 shared between RAM and Dodge",
  },
  {
    vin: "3C6UR5DL8NG108210",
    expectedMake: "RAM",
    actualMake: "Dodge",
    reason: "WMI 3C6 shared between RAM and Dodge",
  },
  {
    vin: "3C6MRVSGXSE503535",
    expectedMake: "RAM",
    actualMake: "Dodge",
    reason: "WMI 3C6 - RAM ProMaster 3500 returns Dodge",
  },
  {
    vin: "1C6SRFLP2TN241485",
    expectedMake: "RAM",
    actualMake: "Dodge",
    reason: "WMI 1C6 - RAM 1500 returns Dodge",
  },
  {
    vin: "1C6SRFLPXTN198921",
    expectedMake: "RAM",
    actualMake: "Dodge",
    reason: "WMI 1C6 - RAM 1500 returns Dodge",
  },
  // Subaru WRX - Sometimes returns Toyota
  {
    vin: "JF1VBAL68P9806699",
    expectedMake: "Subaru",
    actualMake: "Toyota",
    reason: "Some Subaru WRX VINs incorrectly return Toyota",
  },
  {
    vin: "JF1VBAZ67S9808671",
    expectedMake: "Subaru",
    actualMake: "Toyota",
    reason: "Subaru WRX VIN returns Toyota",
  },
  // Chrysler - Returns Dodge
  {
    vin: "2C4RC1L70PR614477",
    expectedMake: "Chrysler",
    actualMake: "Dodge",
    reason: "WMI 2C4 shared between Chrysler/Dodge",
  },
];

/**
 * Known model identification issues
 * Note: Issue #22 (F-150 -> F-550) was fixed by adding schema pattern count as a tiebreaker
 */
export const KNOWN_MODEL_ISSUES: {
  vin: string;
  expectedModel: string;
  actualModel: string;
  reason: string;
}[] = [
  // F-150 issue #22 has been fixed - keeping this array for future issues
];

/**
 * VINs that fail validation (return valid: false)
 * These might be missing from VPIC database or have other issues
 */
export const INVALID_VIN_ISSUES: {
  vin: string;
  expectedMake: string;
  expectedModel: string;
  reason: string;
}[] = [
  {
    vin: "5UX63DP06R9U65632",
    expectedMake: "BMW",
    expectedModel: "X3",
    reason: "VIN returns valid: false - possibly missing from VPIC database",
  },
  {
    vin: "JN1BJ1AW5PW109661",
    expectedMake: "Nissan",
    expectedModel: "Qashqai",
    reason: "VIN returns valid: false - possibly missing from VPIC database (Qashqai not sold in US)",
  },
];

/**
 * All test VINs flattened into a single array
 */
export function getAllTestVINs(): VINTestCase[] {
  const allVins: VINTestCase[] = [
    ...PROBLEMATIC_VINS,
    ...FORD_F_SERIES_VINS,
    ...OLDER_VEHICLE_VINS,
    ...LUXURY_BRAND_VINS,
  ];

  // Add VINs from makes
  for (const vins of Object.values(VINS_BY_MAKE)) {
    allVins.push(...vins);
  }

  // Add VINs from body styles
  for (const vins of Object.values(VINS_BY_BODY_STYLE)) {
    allVins.push(...vins);
  }

  // Deduplicate by VIN
  const seen = new Set<string>();
  return allVins.filter((v) => {
    if (seen.has(v.vin)) return false;
    seen.add(v.vin);
    return true;
  });
}

/**
 * Get unique VINs count
 */
export function getTestVINCount(): number {
  return getAllTestVINs().length;
}
