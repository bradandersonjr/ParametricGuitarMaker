import { useState, useEffect } from "react"
import { sendToPython, onPythonMessage } from "@/lib/fusion-bridge"

export interface UserPreferences {
  /** App version when user checked "Don't show again" on Beta Disclaimer, or null */
  betaDisclaimerDismissedVersion: string | null
  /** Decimal places for Reports page (3-9) */
  reportsPrecision: number
  /** Custom group ordering by ID, or null for default schema order */
  groupOrder: string[] | null
}

const DEFAULTS: UserPreferences = {
  betaDisclaimerDismissedVersion: null,
  reportsPrecision: 4,
  groupOrder: null,
}

const STORAGE_KEY = "pgfm_preferences"

/** Legacy keys that get migrated into the unified store on first load */
const LEGACY_KEYS = {
  betaVersion: "beta-disclaimer-version",
  precision: "reportsPrecision",
} as const

function migrateLegacyKeys(): Partial<UserPreferences> {
  const patch: Partial<UserPreferences> = {}

  const legacyBeta = localStorage.getItem(LEGACY_KEYS.betaVersion)
  if (legacyBeta) {
    patch.betaDisclaimerDismissedVersion = legacyBeta
    localStorage.removeItem(LEGACY_KEYS.betaVersion)
  }

  const legacyPrecision = localStorage.getItem(LEGACY_KEYS.precision)
  if (legacyPrecision) {
    const parsed = parseInt(legacyPrecision)
    if (!isNaN(parsed) && parsed >= 3 && parsed <= 9) {
      patch.reportsPrecision = parsed
    }
    localStorage.removeItem(LEGACY_KEYS.precision)
  }

  return patch
}

function loadFromStorage(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<UserPreferences>
      return { ...DEFAULTS, ...stored }
    }
  } catch {
    // Corrupted — fall through
  }

  const migrated = migrateLegacyKeys()
  const prefs = { ...DEFAULTS, ...migrated }
  saveToStorage(prefs)
  return prefs
}

function saveToStorage(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/**
 * Centralized user preferences hook.
 *
 * Python pushes PREFERENCES_LOADED proactively:
 *   - On first palette load (ready signal)
 *   - Every time the palette is re-shown (stop/run, button click)
 *
 * Returns [prefs, update, loadCount] where loadCount increments every time
 * Python sends preferences — App.tsx uses this to re-evaluate the disclaimer
 * even when betaDisclaimerDismissedVersion hasn't changed.
 */
export function usePreferences(): [UserPreferences, (patch: Partial<UserPreferences>) => void, number] {
  const [prefs, setPrefs] = useState<UserPreferences>(loadFromStorage)
  const [loadCount, setLoadCount] = useState(0)

  useEffect(() => {
    const handlePreferencesLoaded = (data: string) => {
      try {
        const fromPython = JSON.parse(data) as Partial<UserPreferences>
        console.log('[PREFS] Received from Python:', JSON.stringify(fromPython))
        // Python is authoritative — always overwrite with its values
        const next = { ...loadFromStorage(), ...fromPython }
        saveToStorage(next)
        setPrefs(next)
        setLoadCount(c => c + 1)
      } catch (e) {
        console.error('[PREFS] Failed to parse preferences from Python:', e)
        setLoadCount(c => c + 1)
      }
    }

    const unsubscribe = onPythonMessage('PREFERENCES_LOADED', handlePreferencesLoaded)

    // Fallback: request preferences in case Python hasn't pushed yet
    sendToPython('GET_PREFERENCES')

    return unsubscribe
  }, [])

  const update = (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch }
    saveToStorage(next)
    sendToPython('SAVE_PREFERENCES', next as Record<string, unknown>)
    setPrefs(next)
  }

  return [prefs, update, loadCount]
}
