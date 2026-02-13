import { ExternalLink } from "lucide-react"
import { GITHUB_REPO_URL } from "@/hooks/useVersionCheck"
import { openUrl } from "@/lib/fusion-bridge"

interface VersionHeaderProps {
  version: string
  isOutdated: boolean
}

export function VersionHeader({ version, isOutdated }: VersionHeaderProps) {
  return (
    <button
      onClick={() => openUrl(GITHUB_REPO_URL)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-muted/80 transition-colors group cursor-pointer bg-none border-none p-0"
      title={isOutdated ? "Update available - click to view releases" : "View on GitHub"}
    >
      <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
        v{version}
      </span>
      {isOutdated && (
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
      )}
      <ExternalLink size={12} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </button>
  )
}
