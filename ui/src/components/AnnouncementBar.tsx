import { type ReactNode, useState, useRef, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import localAnnouncementContent from "@/announcements.md?raw"
import { openUrl } from "@/lib/fusion-bridge"
import { Button } from "@/components/ui/button"

// GitHub raw content URL
const GITHUB_ANNOUNCEMENT_URL =
  "https://raw.githubusercontent.com/bradandersonjr/ParametricGuitarFretboardMaker/master/ui/src/announcements.md"

// LocalStorage key for fallback caching
const CACHE_KEY = "pgfm_announcement_cache"

// Auto-advance interval in milliseconds
const AUTO_ADVANCE_MS = 10000

/** Parse the markdown file into an array of announcement strings (one per non-empty line). */
function parseAnnouncements(raw: string): string[] {
  return raw
    .split("\n")
    .slice(1) // skip the # header line
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

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
  const [announcements, setAnnouncements] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [overflow, setOverflow] = useState(0)
  const textRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch announcements from GitHub on every app load
  useEffect(() => {
    const loadAnnouncement = async () => {
      // Try to fetch fresh from GitHub
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(GITHUB_ANNOUNCEMENT_URL, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          const text = await response.text()
          localStorage.setItem(CACHE_KEY, text)
          setAnnouncements(parseAnnouncements(text))
          return
        }
      } catch {
        // GitHub fetch failed — fall back below
      }

      // Try cached version first
      const cachedContent = localStorage.getItem(CACHE_KEY)
      if (cachedContent) {
        setAnnouncements(parseAnnouncements(cachedContent))
        return
      }

      // Fall back to bundled local version
      setAnnouncements(parseAnnouncements(localAnnouncementContent))
    }

    loadAnnouncement()
  }, [])

  const total = announcements.length
  const hasMultiple = total > 1

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    setOverflow(0) // reset overflow so it remeasures for new content
  }, [])

  const goNext = useCallback(() => {
    goTo((currentIndex + 1) % total)
  }, [currentIndex, total, goTo])

  const goPrev = useCallback(() => {
    goTo((currentIndex - 1 + total) % total)
  }, [currentIndex, total, goTo])

  // Auto-advance timer — resets whenever the index changes or announcements load
  useEffect(() => {
    if (!hasMultiple) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(goNext, AUTO_ADVANCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, hasMultiple, goNext])

  // Measure overflow for marquee animation
  useEffect(() => {
    const measure = () => {
      const textEl = textRef.current
      const containerEl = containerRef.current
      if (textEl && containerEl) {
        const textWidth = textEl.getBoundingClientRect().width
        const containerWidth = containerEl.clientWidth
        const paddingWhenScrolling = 48
        const textWidthWithPadding = textWidth + paddingWhenScrolling

        if (textWidthWithPadding > containerWidth + 5) {
          setOverflow(textWidth)
        } else {
          setOverflow(0)
        }
      }
    }

    measure()

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure)
    })

    if (containerRef.current) ro.observe(containerRef.current)
    if (textRef.current) ro.observe(textRef.current)

    return () => ro.disconnect()
  }, [currentIndex, announcements])

  if (!total || dismissed) return null

  const content = announcements[currentIndex]
  const duration = overflow > 0 ? (overflow / 25).toFixed(1) : "0"
  const style: React.CSSProperties = overflow > 0 ? {
    "--marquee-duration": `${duration}s`,
  } as React.CSSProperties : {}

  const rendered = renderInlineMarkdown(content)

  return (
    <div className="w-full flex justify-center py-2 px-12 bg-background z-50">
      <div className="w-full flex items-center py-1.5 bg-zinc-950 text-zinc-50 rounded-full shadow-md border border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-300 relative">

        {/* Left side — same width as right side to keep text centered */}
        <div className="w-[62px] flex items-center justify-end pr-2 shrink-0">
          {hasMultiple && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              className="h-6 w-6 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
              aria-label="Previous announcement"
            >
              <ChevronLeft size={14} />
            </Button>
          )}
        </div>

        {/* Scrolling text area */}
        <div
          ref={containerRef}
          className="overflow-hidden flex-1 flex items-center h-6 relative"
          style={{
            WebkitMaskImage: overflow > 0 ? 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' : 'none',
            maskImage: overflow > 0 ? 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' : 'none'
          }}
        >
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
        </div>

        {/* Right side — next arrow + dismiss */}
        <div className="w-[62px] flex items-center justify-end gap-2 pr-1.5 shrink-0">
          {hasMultiple && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              className="h-6 w-6 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
              aria-label="Next announcement"
            >
              <ChevronRight size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 z-10"
            aria-label="Dismiss"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
