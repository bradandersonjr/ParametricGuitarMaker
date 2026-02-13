import type { ModelPayload } from "@/types"

// ── Types ──────────────────────────────────────────────────────────

export interface FretPosition {
  fret: number
  distanceBass: number
  distanceTreble: number
  spacingBass: number
  spacingTreble: number
}

export interface StringInfo {
  number: number
  gauge: number
}

export interface GuitarReport {
  // Scale lengths
  scaleLengthBass: number
  scaleLengthTreble: number
  isMultiScale: boolean

  // Frets
  fretCount: number
  fretPositions: FretPosition[]

  // Strings
  stringCount: number
  strings: StringInfo[]
  stringAction: number
  nutSpacing: number | null
  nutSlotSpacing: number | null

  // Dimensions
  guitarLength: number | null
  guitarWidth: number | null
  guitarThickness: number | null
  bodyLength: number | null
  bodyWidth: number | null
  bodyThickness: number | null
  neckThickness1st: number | null
  neckThickness12th: number | null
  neckWidth1st: number | null
  neckWidth12th: number | null
  headstockLength: number | null
  headstockWidth: number | null
  headstockThickness: number | null

  // Multi-scale specifics
  neutralFret: number | null
  scaleDifference: number
  fretboardLengthBass: number
  fretboardLengthTreble: number
}

// ── Helpers ────────────────────────────────────────────────────────

/** Extract a numeric parameter value from the payload by name.
 * Preferentially uses the expression (which has proper units) over the raw value.
 * The raw value from Fusion is in cm, but expressions preserve user-facing units. */
export function extractParamValue(payload: ModelPayload, name: string): number | null {
  for (const group of payload.groups) {
    for (const param of group.parameters) {
      if (param.name === name) {
        // Prefer expression because it has proper units (e.g. "25.5 in")
        // The raw value is in cm but we want user-facing values
        const expr = param.expression ?? param.default ?? ""
        const match = expr.match(/^([\d.]+)/)
        if (match) return parseFloat(match[1])

        // Fall back to raw value if no expression available
        if (param.value != null) return param.value
        return null
      }
    }
  }
  return null
}

// ── Computations ───────────────────────────────────────────────────

/**
 * Compute fret positions using the 12-TET formula:
 * distance_from_nut(n) = scale_length * (1 - 1/2^(n/12))
 */
export function computeFretPositions(
  scaleLengthBass: number,
  scaleLengthTreble: number,
  fretCount: number
): FretPosition[] {
  const positions: FretPosition[] = []
  let prevBass = 0
  let prevTreble = 0

  for (let n = 1; n <= fretCount; n++) {
    const distBass = scaleLengthBass * (1 - 1 / Math.pow(2, n / 12))
    const distTreble = scaleLengthTreble * (1 - 1 / Math.pow(2, n / 12))
    positions.push({
      fret: n,
      distanceBass: distBass,
      distanceTreble: distTreble,
      spacingBass: distBass - prevBass,
      spacingTreble: distTreble - prevTreble,
    })
    prevBass = distBass
    prevTreble = distTreble
  }

  return positions
}

/** Build a complete guitar report from the model payload. */
export function buildGuitarReport(payload: ModelPayload): GuitarReport {
  const val = (name: string) => extractParamValue(payload, name)

  const scaleBass = val("ScaleLengthBass") ?? 25.5
  const scaleTreble = val("ScaleLengthTreb") ?? scaleBass
  const fretCount = val("FretCount") ?? 24
  const stringCount = val("StringCount") ?? 6

  const isMultiScale = Math.abs(scaleBass - scaleTreble) > 0.001

  // Build string list
  const strings: StringInfo[] = []
  for (let i = 1; i <= stringCount; i++) {
    const gauge = val(`StringGauge${i}`) ?? 0
    strings.push({ number: i, gauge })
  }

  const fretPositions = computeFretPositions(scaleBass, scaleTreble, fretCount)

  return {
    scaleLengthBass: scaleBass,
    scaleLengthTreble: scaleTreble,
    isMultiScale,
    fretCount,
    fretPositions,
    stringCount,
    strings,
    stringAction: val("StringAction") ?? 0,
    nutSpacing: val("NutSpacing"),
    nutSlotSpacing: val("NutSlotSpacing"),
    guitarLength: val("GuitarLength"),
    guitarWidth: val("GuitarWidth"),
    guitarThickness: val("GuitarThickness"),
    bodyLength: val("BodyLength"),
    bodyWidth: val("BodyWidth"),
    bodyThickness: val("BodyThickness"),
    neckThickness1st: val("NeckThickness1st"),
    neckThickness12th: val("NeckThickness12th"),
    neckWidth1st: val("NeckLocation1st"),
    neckWidth12th: val("NeckLocation12th"),
    headstockLength: val("HeadstockLength"),
    headstockWidth: val("HeadstockWidth"),
    headstockThickness: val("HeadstockThickness"),
    neutralFret: val("NeutralFret"),
    scaleDifference: Math.abs(scaleBass - scaleTreble),
    fretboardLengthBass: scaleBass * (1 - 1 / Math.pow(2, fretCount / 12)),
    fretboardLengthTreble: scaleTreble * (1 - 1 / Math.pow(2, fretCount / 12)),
  }
}
