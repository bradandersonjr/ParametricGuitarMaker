const METRIC_UNITS = new Set(["nm", "um", "mm", "cm", "m", "km"])
const IMPERIAL_UNITS = new Set(["mil", "in", "ft", "yd", "mi", "ftin", "ftandin"])

export function isMetricUnit(documentUnit?: string): boolean {
  const unit = (documentUnit ?? "").trim().toLowerCase()
  if (!unit) return false

  const normalized = unit.replace(/[^a-z]/g, "")
  if (METRIC_UNITS.has(normalized)) return true
  if (IMPERIAL_UNITS.has(normalized)) return false

  if (/(meter|metre|millimeter|centimeter|kilometer|micrometer|nanometer)/.test(normalized)) {
    return true
  }
  if (/(inch|foot|feet|yard|mile|thou)/.test(normalized)) {
    return false
  }

  return false
}
