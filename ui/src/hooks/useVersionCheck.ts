import { useEffect, useState } from "react"

interface VersionInfo {
  current: string
  latest: string | null
  isOutdated: boolean
  error: string | null
}

const GITHUB_REPO = "bradandersonjr/ParametricGuitarFretboardMaker"
const VERSION_CHECK_TIMEOUT = 5000 // 5 seconds

export function useVersionCheck(currentVersion: string): VersionInfo {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: currentVersion,
    latest: null,
    isOutdated: false,
    error: null,
  })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const checkLatestVersion = async () => {
      try {
        // Try to fetch the latest version from package.json in GitHub
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT)

        const response = await fetch(
          `https://raw.githubusercontent.com/${GITHUB_REPO}/master/ui/package.json`,
          { signal: controller.signal }
        )

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const latestVersion = data.version

        setVersionInfo({
          current: currentVersion,
          latest: latestVersion,
          isOutdated: isVersionOutdated(currentVersion, latestVersion),
          error: null,
        })
      } catch (error) {
        // Silently fail - don't show error to user
        setVersionInfo((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Version check failed",
        }))
      }
    }

    checkLatestVersion()

    return () => clearTimeout(timeoutId)
  }, [currentVersion])

  return versionInfo
}

// Compare two semantic versions
function isVersionOutdated(current: string, latest: string): boolean {
  const parseCurrent = current.split(".").map(Number)
  const parseLatest = latest.split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    const curr = parseCurrent[i] || 0
    const lat = parseLatest[i] || 0
    if (lat > curr) return true
    if (lat < curr) return false
  }

  return false
}

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}/releases`
