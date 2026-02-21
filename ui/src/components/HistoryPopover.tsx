import React, { useState, useRef, useCallback } from "react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

export interface HistoryEntry {
  name: string
  oldVal: string
  newVal: string
}

// Shared tooltip style — use this for all footer icon buttons
const TOOLTIP_CLASS = "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-popover border border-border rounded-md shadow-lg px-2 py-1 text-xs text-popover-foreground whitespace-nowrap pointer-events-none"

// Simple icon button tooltip wrapper — same style as HistoryPopover's quick tooltip
export function IconTooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [show, setShow] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHovered = useRef(false)

  const handleMouseEnter = useCallback(() => {
    isHovered.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (isHovered.current) setShow(true)
    }, 500)
  }, [])

  const handleMouseLeave = useCallback(() => {
    isHovered.current = false
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    setShow(false)
  }, [])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-flex"
    >
      {children}
      {show && <div className={TOOLTIP_CLASS}>{label}</div>}
    </div>
  )
}

interface HistoryPopoverProps {
  children: React.ReactNode
  history: HistoryEntry[]
  historyIndex: number
  direction: "undo" | "redo"
  disabled?: boolean
  onSelect?: (relativeIndex: number) => void
}

export function HistoryPopover({
  children,
  history,
  historyIndex,
  direction,
  disabled = false,
  onSelect,
}: HistoryPopoverProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isHovered = useRef(false)

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    isHovered.current = true
    // Clear close timer if re-entering
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    // Since we're hovering, if history is ALREADY visible, we essentially "keep" it visible
    // by having cleared the close timer. We don't want to restart the "opening" logic.
    if (showHistory) return

    // Clear opening timers to restart them fresh (or ensure they aren't duplicated)
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current)

    // Always show tooltip first (even when disabled — no history)
    tooltipTimeoutRef.current = setTimeout(() => {
      // Check !showHistory to ensure we don't show tooltip if history appeared (unlikely given timing, but safe)
      if (isHovered.current && !showHistory) setShowTooltip(true)
    }, 500)

    // Only show history popover if there's something to undo/redo
    if (!disabled) {
      hoverTimeoutRef.current = setTimeout(() => {
        if (isHovered.current) {
          setShowHistory(true)
          setShowTooltip(false)
        }
      }, 2000)
    }
  }, [disabled, showHistory])

  const handleMouseLeave = useCallback(() => {
    isHovered.current = false

    // Clear opening timers immediately so we don't open stuff while mouse is gone
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null }
    if (tooltipTimeoutRef.current) { clearTimeout(tooltipTimeoutRef.current); tooltipTimeoutRef.current = null }

    // Add a slight delay before closing, allowing user to bridge the gap to the popover
    closeTimeoutRef.current = setTimeout(() => {
      setShowHistory(false)
      setShowTooltip(false)
    }, 500)
  }, [])

  const getHistoryItems = (): HistoryEntry[] => {
    if (direction === "undo") {
      return history.slice(0, historyIndex + 1).reverse()
    } else {
      return history.slice(historyIndex + 1)
    }
  }

  const handleSelect = (index: number) => {
    onSelect?.(index)
    setShowHistory(false)
    setShowTooltip(false)
  }

  const items = getHistoryItems()
  const tooltip = direction === "undo" ? "Undo" : "Redo"

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-flex"
    >
      {children}

      {/* Quick tooltip */}
      {showTooltip && !showHistory && (
        <div className={TOOLTIP_CLASS}>{tooltip}</div>
      )}

      {/* History popover */}
      {showHistory && items.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 w-max max-w-xs max-h-48 overflow-y-auto">
          <div className="text-xs font-semibold text-foreground mb-2 px-2 pt-1">
            {direction === "undo" ? "Undo History" : "Redo History"}
          </div>
          <div className="space-y-1">
            {items.map((item, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSelect(idx)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors focus:outline-none focus:bg-muted"
                  >
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {item.oldVal} → {item.newVal}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{`Revert to ${item.newVal}`}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
