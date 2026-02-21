/** Filter input to valid numeric characters.
 *  integerOnly=true: digits only.  integerOnly=false: digits + single decimal point. */
export function filterNumericInput(raw: string, integerOnly: boolean): string {
  if (integerOnly) return raw.replace(/[^0-9]/g, "")
  let result = ""
  let hasDot = false
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") { result += ch }
    else if (ch === "." && !hasDot) { result += ch; hasDot = true }
  }
  return result
}

/** Remove trailing zeros from numeric strings.
 *  "16.00" → "16", "25.400" → "25.4", "12.75" → "12.75", "0.0625" → "0.0625" */
export function stripTrailingZeros(value: string): string {
  if (!/^\d*\.?\d+$/.test(value)) return value
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toString()
}

/** Compare two parameter expressions, treating numerically-equal strings as equal.
 *  "27.00" == "27", "25.400" == "25.4" — falls back to string equality for formulas. */
export function expressionsEqual(a: string, b: string): boolean {
  if (a === b) return true
  const isNumeric = (s: string) => s.trim() !== "" && !isNaN(Number(s))
  if (isNumeric(a) && isNumeric(b)) return parseFloat(a) === parseFloat(b)
  return false
}
