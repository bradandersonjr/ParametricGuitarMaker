import { type ReactNode, useState, useRef, useEffect } from "react"
import { X } from "lucide-react"
import localAnnouncementContent from "@/announcements.md?raw"
import { openUrl } from "@/lib/fusion-bridge"
import { Button } from "@/components/ui/button"

// GitHub raw content URL
const GITHUB_ANNOUNCEMENT_URL =
  "https://raw.githubusercontent.com/bradandersonjr/ParametricGuitarFretboardMaker/master/ui/src/announcements.md"

// LocalStorage key for fallback caching
const CACHE_KEY = "pgfm_announcement_cache"

/** Parse inline markdown (links, bold, italic) into React elements. */
function renderInlineMarkdown(text: string) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      const url = match[2]
      parts.push(
        <button
          key={match.index}
          onClick={() => openUrl(url)}
          className="underline underline-offset-2 hover:text-white/80 bg-none border-none p-0 cursor-pointer font-semibold mx-1"
        >
          {match[1]}
        </button>
      )
    } else if (match[3] !== undefined) {
      parts.push(<strong key={match.index} className="font-bold">{match[3]}</strong>)
    } else if (match[4] !== undefined) {
      parts.push(<em key={match.index} className="italic">{match[4]}</em>)
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)
  const [overflow, setOverflow] = useState(0)
  const [content, setContent] = useState("")
  const textRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch announcement from GitHub on every app load
  useEffect(() => {
    const loadAnnouncement = async () => {
      // Try to fetch fresh from GitHub
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        const response = await fetch(GITHUB_ANNOUNCEMENT_URL, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          const text = await response.text()
          const lines = text.split("\n")
          const extractedContent = lines.slice(1).join("\n").trim()

          // Cache as fallback for next time (if offline)
          localStorage.setItem(CACHE_KEY, extractedContent)

          setContent(extractedContent)
          return
        }
      } catch {
        // GitHub fetch failed (offline, timeout, network error, etc.)
        // Fall back to cached version or bundled local version
      }

      // Try cached version first
      const cachedContent = localStorage.getItem(CACHE_KEY)
      if (cachedContent) {
        setContent(cachedContent)
        return
      }

      // Fall back to bundled local version
      const lines = localAnnouncementContent.split("\n")
      const fallbackContent = lines.slice(1).join("\n").trim()
      setContent(fallbackContent)
    }

    loadAnnouncement()
  }, [])

  useEffect(() => {
    const measure = () => {
      const textEl = textRef.current
      const containerEl = containerRef.current
      if (textEl && containerEl) {
        // Temporarily remove any transforms to get accurate measurements
        const textWidth = textEl.getBoundingClientRect().width
        const containerWidth = containerEl.clientWidth

        // Account for the padding that will be added when scrolling (px-12 = 48px total)
        const paddingWhenScrolling = 48
        const textWidthWithPadding = textWidth + paddingWhenScrolling

        // Overflow exists if text (plus padding) is wider than container
        // Use a small buffer to avoid flickering
        if (textWidthWithPadding > containerWidth + 5) {
          setOverflow(textWidth)
        } else {
          setOverflow(0)
        }
      }
    }

    // Initial measurement
    measure()

    // Use ResizeObserver to detect size changes
    const ro = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure we measure after layout
      requestAnimationFrame(measure)
    })

    if (containerRef.current) ro.observe(containerRef.current)
    if (textRef.current) ro.observe(textRef.current)

    return () => ro.disconnect()
  }, [content])

  if (!content || dismissed) return null

  // Ensure speed is consistent regardless of length
  // Slowed down the speed (divisor changed from 40 to 25)
  const duration = overflow > 0 ? (overflow / 25).toFixed(1) : "0"

  const style: React.CSSProperties = overflow > 0 ? {
    "--marquee-duration": `${duration}s`,
  } as React.CSSProperties : {}

  return (
    <div className="w-full flex justify-center py-2 px-4 bg-background z-50">
      <div className="w-full flex items-center gap-2 pl-4 pr-1.5 py-1.5 bg-zinc-950 text-zinc-50 rounded-full shadow-md border border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-300 max-w-2xl relative">
        <div
          ref={containerRef}
          className="overflow-hidden flex-1 flex items-center h-6 relative"
          // We use a mask to fade the edges for a premium feel when scrolling
          style={{
            WebkitMaskImage: overflow > 0 ? 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' : 'none',
            maskImage: overflow > 0 ? 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' : 'none'
          }}
        >
          {(() => {
            const rendered = renderInlineMarkdown(content)
            return (
              <div
                className={`flex items-center ${overflow > 0 ? "w-max animate-marquee-left" : "w-full justify-center"}`}
                style={style}
              >
                <span
                  ref={textRef}
                  className={`text-xs font-medium whitespace-nowrap shrink-0 ${overflow > 0 ? "px-12" : ""}`}
                >
                  {rendered}
                </span>
                {overflow > 0 && (
                  <span className="text-xs font-medium px-12 whitespace-nowrap shrink-0">
                    {rendered}
                  </span>
                )}
              </div>
            )
          })()}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 z-10"
          aria-label="Dismiss"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  )
}
