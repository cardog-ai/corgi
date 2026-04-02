# Vehicle Ontology

## Overview

This document defines the complete data model for a vehicle. It adopts Schema.org naming conventions and extends them for areas not covered by existing vocabularies.

**Namespace:** `https://schema.org/` (adopted), `https://vis.cardog.dev/` (extensions)

**Naming convention:** camelCase

---

## Design Principles

1. **Schema.org first** — Use existing properties where they exist
2. **Extend consistently** — New properties follow Schema.org patterns
3. **QuantitativeValue for measurements** — Includes units, allows ranges
4. **Enumerations where bounded** — Use enums for closed sets, text for open
5. **Nested objects for complexity** — EngineSpecification pattern

---

## Core Vehicle Schema

### Vehicle (Root)

Adopts `schema:Vehicle` as base type.

```yaml
Vehicle:
  # === IDENTITY (Schema.org + extensions) ===
  vehicleIdentificationNumber: string         # schema:vehicleIdentificationNumber
  worldManufacturerIdentifier: string         # vis:worldManufacturerIdentifier (WMI, 3 or 6 chars)
  manufacturer: Organization                  # schema:manufacturer
  brand: Brand                                # schema:brand (make)
  model: ProductModel | string                # schema:model
  vehicleModelDate: Date                      # schema:vehicleModelDate (model year)
  generation: string?                         # vis:generation
  variant: string?                            # vis:variant (trim level)

  # === BODY (Schema.org) ===
  bodyType: BodyType | string                 # schema:bodyType
  numberOfDoors: integer                      # schema:numberOfDoors
  seatingCapacity: integer                    # schema:seatingCapacity
  steeringPosition: SteeringPositionValue     # schema:steeringPosition
  wheelbase: QuantitativeValue                # schema:wheelbase
  cargoVolume: QuantitativeValue              # schema:cargoVolume

  # === BODY (Extensions) ===
  numberOfRows: integer?                      # vis:numberOfRows
  roofType: RoofType?                         # vis:roofType
  bedLength: QuantitativeValue?               # vis:bedLength (trucks)
  cabType: CabType?                           # vis:cabType (trucks)

  # === POWERTRAIN (Schema.org) ===
  vehicleEngine: EngineSpecification?         # schema:vehicleEngine
  vehicleTransmission: string                 # schema:vehicleTransmission
  driveWheelConfiguration: DriveWheelConfigurationValue  # schema:driveWheelConfiguration
  fuelType: FuelType | string                 # schema:fuelType
  fuelCapacity: QuantitativeValue             # schema:fuelCapacity
  fuelConsumption: QuantitativeValue?         # schema:fuelConsumption
  fuelEfficiency: QuantitativeValue?          # schema:fuelEfficiency

  # === POWERTRAIN (Extensions) ===
  powertrainType: PowertrainType              # vis:powertrainType
  electricMotor: MotorSpecification?          # vis:electricMotor
  battery: BatterySpecification?              # vis:battery

  # === PERFORMANCE (Schema.org) ===
  accelerationTime: QuantitativeValue?        # schema:accelerationTime (0-100 km/h)
  speed: QuantitativeValue?                   # schema:speed (top speed)
  enginePower: QuantitativeValue?             # schema:enginePower (convenience, duplicates engine)
  torque: QuantitativeValue?                  # schema:torque (convenience, duplicates engine)

  # === WEIGHT (Schema.org) ===
  weightTotal: QuantitativeValue?             # schema:weightTotal (GVWR)
  payload: QuantitativeValue?                 # schema:payload
  trailerWeight: QuantitativeValue?           # schema:trailerWeight (towing capacity)
  tongueWeight: QuantitativeValue?            # schema:tongueWeight

  # === WEIGHT (Extensions) ===
  curbWeight: QuantitativeValue?              # vis:curbWeight
  grossCombinedWeight: QuantitativeValue?     # vis:grossCombinedWeight (GCWR)

  # === DIMENSIONS (Extensions) ===
  length: QuantitativeValue?                  # vis:length
  width: QuantitativeValue?                   # vis:width
  height: QuantitativeValue?                  # vis:height
  groundClearance: QuantitativeValue?         # vis:groundClearance

  # === PRODUCTION (Schema.org + extensions) ===
  productionDate: Date?                       # schema:productionDate
  productionPlant: Place?                     # vis:productionPlant
  productionCountry: Country?                 # vis:productionCountry
  productionSequence: string?                 # vis:productionSequence

  # === COMPLIANCE (Schema.org + extensions) ===
  emissionsCO2: number?                       # schema:emissionsCO2 (g/km)
  meetsEmissionStandard: string?              # schema:meetsEmissionStandard
  targetMarkets: Country[]                    # vis:targetMarkets
  certifications: Certification[]             # vis:certifications

  # === SAFETY (Schema.org + extensions) ===
  numberOfAirbags: integer?                   # schema:numberOfAirbags
  safetyFeatures: SafetyFeatures?             # vis:safetyFeatures

  # === FEATURES (Extensions) ===
  connectivityFeatures: ConnectivityFeatures? # vis:connectivityFeatures
  adasFeatures: ADASFeatures?                 # vis:adasFeatures
  comfortFeatures: ComfortFeatures?           # vis:comfortFeatures
  infotainmentFeatures: InfotainmentFeatures? # vis:infotainmentFeatures
```

---

## Component Schemas

### EngineSpecification (Schema.org)

```yaml
EngineSpecification:                          # schema:EngineSpecification
  engineType: string                          # schema:engineType (layout: I4, V6, etc.)
  engineDisplacement: QuantitativeValue       # schema:engineDisplacement
  enginePower: QuantitativeValue              # schema:enginePower
  torque: QuantitativeValue                   # schema:torque
  fuelType: FuelType | string                 # schema:fuelType

  # Extensions
  engineCode: string?                         # vis:engineCode (manufacturer code)
  engineFamily: string?                       # vis:engineFamily
  cylinders: integer?                         # vis:cylinders
  valvesPerCylinder: integer?                 # vis:valvesPerCylinder
  bore: QuantitativeValue?                    # vis:bore
  stroke: QuantitativeValue?                  # vis:stroke
  compressionRatio: number?                   # vis:compressionRatio
  aspiration: Aspiration?                     # vis:aspiration
```

### MotorSpecification (Extension)

```yaml
MotorSpecification:                           # vis:MotorSpecification
  motorType: MotorType                        # vis:motorType
  motorPosition: MotorPosition                # vis:motorPosition
  motorPower: QuantitativeValue               # vis:motorPower
  motorTorque: QuantitativeValue              # vis:motorTorque
  motorCount: integer                         # vis:motorCount
```

### BatterySpecification (Extension)

```yaml
BatterySpecification:                         # vis:BatterySpecification
  batteryCapacity: QuantitativeValue          # vis:batteryCapacity (kWh)
  batteryVoltage: QuantitativeValue           # vis:batteryVoltage
  batteryChemistry: BatteryChemistry          # vis:batteryChemistry
  batteryModules: integer?                    # vis:batteryModules
  batteryCells: integer?                      # vis:batteryCells
  batteryRange: QuantitativeValue?            # vis:batteryRange (estimated range)
```

---

## Feature Schemas

### ConnectivityFeatures

```yaml
ConnectivityFeatures:                         # vis:ConnectivityFeatures
  appleCarPlay: boolean                       # vis:appleCarPlay
  appleCarPlayWireless: boolean               # vis:appleCarPlayWireless
  androidAuto: boolean                        # vis:androidAuto
  androidAutoWireless: boolean                # vis:androidAutoWireless
  bluetooth: boolean                          # vis:bluetooth
  bluetoothVersion: string?                   # vis:bluetoothVersion
  wifiHotspot: boolean                        # vis:wifiHotspot
  wirelessCharging: boolean                   # vis:wirelessCharging
  usbPorts: integer                           # vis:usbPorts
  usbCPorts: integer                          # vis:usbCPorts
  nfc: boolean                                # vis:nfc
```

### ADASFeatures

Naming aligned with SAE J3016 and NHTSA terminology.

```yaml
ADASFeatures:                                 # vis:ADASFeatures
  # Longitudinal control
  adaptiveCruiseControl: boolean              # vis:adaptiveCruiseControl
  automaticEmergencyBraking: boolean          # vis:automaticEmergencyBraking
  forwardCollisionWarning: boolean            # vis:forwardCollisionWarning

  # Lateral control
  laneKeepAssist: boolean                     # vis:laneKeepAssist
  laneDepartureWarning: boolean               # vis:laneDepartureWarning
  laneCenteringAssist: boolean                # vis:laneCenteringAssist

  # Monitoring
  blindSpotMonitoring: boolean                # vis:blindSpotMonitoring
  rearCrossTrafficAlert: boolean              # vis:rearCrossTrafficAlert
  driverMonitoring: boolean                   # vis:driverMonitoring

  # Detection
  pedestrianDetection: boolean                # vis:pedestrianDetection
  cyclistDetection: boolean                   # vis:cyclistDetection
  trafficSignRecognition: boolean             # vis:trafficSignRecognition

  # Parking
  parkingSensorsFront: boolean                # vis:parkingSensorsFront
  parkingSensorsRear: boolean                 # vis:parkingSensorsRear
  surroundViewCamera: boolean                 # vis:surroundViewCamera
  backupCamera: boolean                       # vis:backupCamera
  automaticParking: boolean                   # vis:automaticParking

  # Advanced
  nightVision: boolean                        # vis:nightVision
  headsUpDisplay: boolean                     # vis:headsUpDisplay

  # Autonomous capability
  automationLevel: AutomationLevel?           # vis:automationLevel (SAE J3016)
  automationSystemName: string?               # vis:automationSystemName (e.g., "Autopilot", "SuperCruise")
```

### InfotainmentFeatures

```yaml
InfotainmentFeatures:                         # vis:InfotainmentFeatures
  displaySize: QuantitativeValue?             # vis:displaySize (inches, diagonal)
  displayCount: integer                       # vis:displayCount
  touchscreen: boolean                        # vis:touchscreen
  navigationSystem: boolean                   # vis:navigationSystem
  voiceControl: boolean                       # vis:voiceControl

  # Audio
  speakerCount: integer                       # vis:speakerCount
  speakerPower: QuantitativeValue?            # vis:speakerPower (watts)
  premiumAudio: string?                       # vis:premiumAudio (brand: "Bose", "Harman Kardon")
  satelliteRadio: boolean                     # vis:satelliteRadio
  hdRadio: boolean                            # vis:hdRadio
```

### ComfortFeatures

```yaml
ComfortFeatures:                              # vis:ComfortFeatures
  # Climate
  climateZones: integer                       # vis:climateZones
  heatedSeats: HeatedSeats?                   # vis:heatedSeats
  cooledSeats: CooledSeats?                   # vis:cooledSeats
  heatedSteeringWheel: boolean                # vis:heatedSteeringWheel

  # Seats
  powerSeats: PowerSeats?                     # vis:powerSeats
  memorySeats: boolean                        # vis:memorySeats
  massageSeats: boolean                       # vis:massageSeats
  lumbarSupport: boolean                      # vis:lumbarSupport

  # Roof
  sunroof: boolean                            # vis:sunroof
  moonroof: boolean                           # vis:moonroof
  panoramicRoof: boolean                      # vis:panoramicRoof
  convertibleTop: boolean                     # vis:convertibleTop

  # Convenience
  keylessEntry: boolean                       # vis:keylessEntry
  pushButtonStart: boolean                    # vis:pushButtonStart
  remoteStart: boolean                        # vis:remoteStart
  powerLiftgate: boolean                      # vis:powerLiftgate
  handsFreeLiftgate: boolean                  # vis:handsFreeLiftgate
```

### SafetyFeatures

```yaml
SafetyFeatures:                               # vis:SafetyFeatures
  # Airbags
  frontAirbags: boolean                       # vis:frontAirbags
  sideAirbags: boolean                        # vis:sideAirbags
  curtainAirbags: boolean                     # vis:curtainAirbags
  kneeAirbags: boolean                        # vis:kneeAirbags
  rearAirbags: boolean                        # vis:rearAirbags

  # Active safety
  abs: boolean                                # vis:abs
  stabilityControl: boolean                   # vis:stabilityControl
  tractionControl: boolean                    # vis:tractionControl
  tirePressureMonitor: boolean                # vis:tirePressureMonitor

  # Structural
  safetyRating: string?                       # vis:safetyRating (e.g., "5-Star NHTSA")
  ncapRating: integer?                        # vis:ncapRating
  iihsRating: string?                         # vis:iihsRating
```

---

## Enumerations

### Schema.org Enumerations (Adopted)

```yaml
DriveWheelConfigurationValue:
  - AllWheelDriveConfiguration     # AWD
  - FourWheelDriveConfiguration    # 4WD
  - FrontWheelDriveConfiguration   # FWD
  - RearWheelDriveConfiguration    # RWD

SteeringPositionValue:
  - LeftHandDriving
  - RightHandDriving

CarUsageType:
  - DrivingSchoolVehicleUsage
  - RentalVehicleUsage
  - TaxiVehicleUsage
```

### Extended Enumerations

```yaml
BodyType:                         # Extends schema:bodyType text values
  - sedan | saloon
  - coupe
  - hatchback | liftback
  - wagon | estate | touring
  - suv
  - crossover | cuv
  - pickup | truck | ute
  - van | panel
  - minivan | mpv
  - convertible | cabriolet
  - roadster | spider | spyder
  - targa
  - fastback
  - bus | coach

PowertrainType:
  - ice                           # Internal Combustion Engine only
  - bev                           # Battery Electric Vehicle
  - hev                           # Hybrid Electric Vehicle (non-plug-in)
  - phev                          # Plug-in Hybrid Electric Vehicle
  - mhev                          # Mild Hybrid Electric Vehicle
  - fcev                          # Fuel Cell Electric Vehicle
  - erev                          # Extended Range Electric Vehicle

FuelType:                         # Extends schema:fuelType text values
  - gasoline | petrol
  - diesel
  - electric
  - hydrogen
  - lpg | autogas
  - cng
  - lng
  - e85 | flex
  - biodiesel
  - methanol

TransmissionType:
  - manual
  - automatic
  - cvt                           # Continuously Variable
  - dct                           # Dual-Clutch
  - amt                           # Automated Manual
  - direct                        # Single-speed (EVs)

EngineLayout:
  - i2 | i3 | i4 | i5 | i6 | i8   # Inline
  - v4 | v6 | v8 | v10 | v12 | v16
  - h2 | h4 | h6                  # Flat/Boxer
  - w8 | w12 | w16
  - rotary | wankel
  - single                        # Single cylinder

Aspiration:
  - natural | na
  - turbocharged | turbo
  - supercharged
  - twincharged                   # Turbo + Supercharger
  - electricSupercharged          # e-turbo

MotorType:
  - permanentMagnet               # PMSM
  - induction                     # AC Induction
  - switchedReluctance            # SRM
  - axialFlux

MotorPosition:
  - front
  - rear
  - frontAndRear                  # Dual motor
  - inWheel

BatteryChemistry:
  - nmc                           # Nickel Manganese Cobalt
  - lfp                           # Lithium Iron Phosphate
  - nca                           # Nickel Cobalt Aluminum
  - nmca                          # Nickel Manganese Cobalt Aluminum
  - solidState

RoofType:
  - standard
  - sunroof
  - moonroof
  - panoramic
  - tTop
  - targa
  - convertible | soft
  - retractableHardtop

CabType:                          # Trucks
  - regularCab
  - extendedCab | superCab | kingCab
  - crewCab | doubleCab

AutomationLevel:                  # SAE J3016
  - level0                        # No Automation
  - level1                        # Driver Assistance
  - level2                        # Partial Automation
  - level2Plus                    # Level 2+
  - level3                        # Conditional Automation
  - level4                        # High Automation
  - level5                        # Full Automation
```

---

## QuantitativeValue Pattern

Following Schema.org convention for measurements:

```yaml
QuantitativeValue:
  value: number
  unitCode: string                # UN/CEFACT Common Code
  unitText: string?               # Human-readable unit
  minValue: number?
  maxValue: number?

# Common unit codes:
# CMQ - cubic centimeter (displacement)
# LTR - liter (displacement, fuel capacity)
# KWT - kilowatt (power)
# BHP - brake horsepower (power)
# NWT - newton meter (torque)
# KGM - kilogram (weight)
# LBR - pound (weight)
# MMT - millimeter (dimensions)
# INH - inch (dimensions)
# CMT - centimeter (dimensions)
# MTR - meter (dimensions)
# KMH - kilometers per hour (speed)
# HM - miles per hour (speed)
```

---

## JSON-LD Context

```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "vis": "https://vis.cardog.dev/",

    "vehicleIdentificationNumber": "schema:vehicleIdentificationNumber",
    "worldManufacturerIdentifier": "vis:worldManufacturerIdentifier",
    "vehicleEngine": "schema:vehicleEngine",
    "vehicleTransmission": "schema:vehicleTransmission",
    "driveWheelConfiguration": "schema:driveWheelConfiguration",
    "bodyType": "schema:bodyType",
    "fuelType": "schema:fuelType",

    "powertrainType": "vis:powertrainType",
    "electricMotor": "vis:electricMotor",
    "battery": "vis:battery",
    "connectivityFeatures": "vis:connectivityFeatures",
    "adasFeatures": "vis:adasFeatures",
    "comfortFeatures": "vis:comfortFeatures",
    "infotainmentFeatures": "vis:infotainmentFeatures",
    "safetyFeatures": "vis:safetyFeatures"
  }
}
```

---

## Example Vehicle Record

```json
{
  "@context": "https://vis.cardog.dev/context.jsonld",
  "@type": "Car",

  "vehicleIdentificationNumber": "5YJ3E1EA1PF123456",
  "worldManufacturerIdentifier": "5YJ",
  "manufacturer": {
    "@type": "Organization",
    "name": "Tesla, Inc."
  },
  "brand": {
    "@type": "Brand",
    "name": "Tesla"
  },
  "model": "Model 3",
  "vehicleModelDate": "2023",
  "variant": "Long Range",

  "bodyType": "sedan",
  "numberOfDoors": 4,
  "seatingCapacity": 5,
  "driveWheelConfiguration": "AllWheelDriveConfiguration",

  "powertrainType": "bev",
  "fuelType": "electric",

  "electricMotor": {
    "@type": "MotorSpecification",
    "motorType": "permanentMagnet",
    "motorPosition": "frontAndRear",
    "motorPower": {
      "@type": "QuantitativeValue",
      "value": 366,
      "unitCode": "KWT"
    },
    "motorCount": 2
  },

  "battery": {
    "@type": "BatterySpecification",
    "batteryCapacity": {
      "@type": "QuantitativeValue",
      "value": 82,
      "unitCode": "KWH"
    },
    "batteryChemistry": "nmc"
  },

  "connectivityFeatures": {
    "appleCarPlay": false,
    "androidAuto": false,
    "bluetooth": true,
    "wifiHotspot": true,
    "wirelessCharging": true
  },

  "adasFeatures": {
    "adaptiveCruiseControl": true,
    "automaticEmergencyBraking": true,
    "laneKeepAssist": true,
    "blindSpotMonitoring": true,
    "surroundViewCamera": true,
    "automaticParking": true,
    "automationLevel": "level2Plus",
    "automationSystemName": "Autopilot"
  }
}
```
