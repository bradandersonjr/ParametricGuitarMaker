import { useEffect } from "react"
import { onPythonMessage } from "@/lib/fusion-bridge"

/**
 * Keeps the UI on the same theme as Fusion.
 *
 * Fusion has three UI themes and all three are distinct: Light Gray, Dark Blue
 * (the default) and the hidden Dark Gray. The token blocks for each live in
 * src/index.css, selected by a data-theme attribute on <html>, and their
 * neutrals are read from Fusion's own theme files -- which is what makes a
 * docked palette match the panels beside it.
 *
 * Python owns the value: it reads
 * app.preferences.generalPreferences.userInterfaceTheme and pushes PUSH_THEME
 * on ready and again on every re-show. Fusion raises no theme-changed event,
 * so re-opening the palette is what picks up a change made while it was
 * closed.
 *
 * Outside Fusion (`npm run dev`) no message ever arrives and the bare :root
 * block applies, which is Dark Blue.
 */

export type FusionTheme = "light" | "dark-blue" | "dark-gray"

const THEMES: readonly FusionTheme[] = ["light", "dark-blue", "dark-gray"]
const DEFAULT_THEME: FusionTheme = "dark-blue"

export function applyTheme(name: string): FusionTheme {
  const theme = (THEMES as readonly string[]).includes(name)
    ? (name as FusionTheme)
    : DEFAULT_THEME

  const root = document.documentElement
  root.setAttribute("data-theme", theme)

  // shadcn's own convention, kept in sync so any `dark:` Tailwind variant in
  // the codebase resolves correctly rather than silently staying light.
  root.classList.toggle("dark", theme !== "light")

  return theme
}

export function useFusionTheme() {
  useEffect(() => {
    return onPythonMessage("PUSH_THEME", (dataJson) => {
      try {
        const { theme } = JSON.parse(dataJson) as { theme?: string }
        if (theme) applyTheme(theme)
      } catch {
        // A malformed payload must not blank the UI; the default block stands.
      }
    })
  }, [])
}
