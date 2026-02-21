import { useState, useEffect } from "react"
import { sendToPython, onPythonMessage } from "@/lib/fusion-bridge"

export interface UserPreferences {
  /** If true, hide the Important Information disclaimer across sessions */
  hideBetaDisclaimer: boolean
  /** Decimal places for Reports page (3-9) */
  reportsPrecision: number
  /** Custom group ordering by ID, or null for default schema order */
  groupOrder: string[] | null
}

const DEFAULTS: UserPreferences = {
  hideBetaDisclaimer: false,
  reportsPrecision: 4,
  groupOrder: null,
}

const STORAGE_KEY = "pgfm_preferences"

/** Legacy keys that get migrated into the unified store on first load */
const LEGACY_KEYS = {
  betaVersion: "beta-disclaimer-version",
  betaHide: "hideBetaDisclaimer",
  precision: "reportsPrecision",
  betaSession: "pgfm_beta_disclaimer_dismissed_session",
} as const

function migrateLegacyKeys(): Partial<UserPreferences> {
  const patch: Partial<UserPreferences> = {}

  const legacyHide = localStorage.getItem(LEGACY_KEYS.betaHide)
  if (legacyHide === "true") {
    patch.hideBetaDisclaimer = true
    localStorage.removeItem(LEGACY_KEYS.betaHide)
  }

  const legacyBeta = localStorage.getItem(LEGACY_KEYS.betaVersion)
  if (legacyBeta) {
    patch.hideBetaDisclaimer = true
    localStorage.removeItem(LEGACY_KEYS.betaVersion)
  }

  // Clean up old sessionStorage key from previous implementation
  sessionStorage.removeItem(LEGACY_KEYS.betaSession)

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
      const stored = JSON.parse(raw) as Partial<UserPreferences> & {
        betaDisclaimerDismissedVersion?: string | null
      }
      const normalized: Partial<UserPreferences> = {
        ...stored,
        hideBetaDisclaimer: Boolean(
          stored.hideBetaDisclaimer ||
          (typeof stored.betaDisclaimerDismissedVersion === "string" &&
            stored.betaDisclaimerDismissedVersion.length > 0)
        ),
      }
      return { ...DEFAULTS, ...normalized }
    }
  } catch {
    // Corrupted, fall through
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
 * Returns [prefs, update].
 */
export function usePreferences(): [UserPreferences, (patch: Partial<UserPreferences>) => void] {
  const [prefs, setPrefs] = useState<UserPreferences>(loadFromStorage)

  useEffect(() => {
    const handlePreferencesLoaded = (data: string) => {
      try {
        const fromPython = JSON.parse(data) as Partial<UserPreferences> & {
          betaDisclaimerDismissedVersion?: string | null
        }
        console.log('[PREFS] Received from Python:', JSON.stringify(fromPython))
        const normalizedFromPython: Partial<UserPreferences> = {
          ...fromPython,
          hideBetaDisclaimer: Boolean(
            fromPython.hideBetaDisclaimer ||
            (typeof fromPython.betaDisclaimerDismissedVersion === "string" &&
              fromPython.betaDisclaimerDismissedVersion.length > 0)
          ),
        }

        // Python is authoritative, always overwrite with its values
        const next = { ...loadFromStorage(), ...normalizedFromPython }
        saveToStorage(next)
        setPrefs(next)
      } catch (e) {
        console.error('[PREFS] Failed to parse preferences from Python:', e)
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

  return [prefs, update]
}
