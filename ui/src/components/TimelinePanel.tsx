import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { sendToPython, addMessageHandler } from "@/lib/fusion-bridge"
import type { TimelineItem, TimelineSummary } from "@/types"
import { ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw, AlertCircle, Layers } from "lucide-react"

interface TimelinePanelProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TimelinePanel({ isOpen: controlledOpen, onOpenChange }: TimelinePanelProps) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [summary, setSummary] = useState<TimelineSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [internalOpen, setInternalOpen] = useState(false)
  // Local suppress state for UI — tracks user's toggles before submit
  const [localSuppressed, setLocalSuppressed] = useState<Record<string, boolean>>({})

  // Use controlled open if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const handleOpenChange = (open: boolean) => {
    setInternalOpen(open)
    onOpenChange?.(open)
  }

  // Fetch timeline data
  const refreshTimeline = useCallback(() => {
    setLoading(true)
    setError(null)
    sendToPython("GET_TIMELINE_ITEMS", {})
    sendToPython("GET_TIMELINE_SUMMARY", {})
  }, [])

  // Register message handler
  useEffect(() => {
    return addMessageHandler((action: string, dataJson: string) => {
      if (
        action !== "PUSH_TIMELINE_ITEMS" &&
        action !== "PUSH_TIMELINE_SUMMARY" &&
        action !== "TIMELINE_OPERATION_RESULT"
      ) return

      try {
        const data = JSON.parse(dataJson)
        if (action === "PUSH_TIMELINE_ITEMS") {
          setItems(data.items || [])
          setLoading(false)
        } else if (action === "PUSH_TIMELINE_SUMMARY") {
          setSummary(data)
        } else if (action === "TIMELINE_OPERATION_RESULT") {
          if (!data.success) {
            setError(data.message || "Operation failed")
            setTimeout(() => setError(null), 3000)
          } else {
            // Clear local overrides after successful apply
            setLocalSuppressed({})
          }
          // Refresh to get server state
          setTimeout(() => refreshTimeline(), 150)
        }
      } catch (e) {
        console.error("Timeline message parse error:", e)
      }
    })
  }, [refreshTimeline])

  // Load timeline when sheet opens
  useEffect(() => {
    if (isOpen) {
      refreshTimeline()
    }
  }, [isOpen, refreshTimeline])

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const handleToggleItem = (item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation()
    // Toggle only local state — actual suppression happens on Submit
    const key = `${item.type}:${item.name}`
    const currentLocal = localSuppressed[key]
    const serverState = item.suppressed

    // If local state matches server, toggling means going to opposite of server
    // If local state differs from server, toggling means back to server state
    if (currentLocal === undefined) {
      // No local override yet — toggle away from server state
      setLocalSuppressed(prev => ({ ...prev, [key]: !serverState }))
    } else {
      // Has local override — toggle back to server or to opposite
      setLocalSuppressed(prev => {
        const newVal = prev[key]
        delete prev[key]
        return newVal === serverState ? { ...prev } : { ...prev, [key]: !newVal }
      })
    }
  }

  const handleSubmit = () => {
    setLoading(true)
    // Build list of changed items (include group children)
    const changes: Array<{ name: string; type: 'Feature' | 'Group'; suppressed: boolean }> = []

    const checkItem = (item: TimelineItem) => {
      const key = `${item.type}:${item.name}`
      const newState = localSuppressed[key]
      if (newState !== undefined && newState !== item.suppressed) {
        changes.push({ name: item.name, type: item.type, suppressed: newState })
      }
      item.children?.forEach(checkItem)
    }

    items.forEach(checkItem)

    if (changes.length === 0) {
      setLoading(false)
      return
    }

    sendToPython("APPLY_TIMELINE_CHANGES", { changes })
  }

  // Build grouped items from the children arrays provided by Python
  const groupedItems: Record<string, TimelineItem[]> = {}
  items.forEach((item) => {
    if (item.type === "Group") {
      groupedItems[item.name] = item.children ?? []
    }
  })

  const sheetContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Timeline Browser</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Suppress or unsuppress features and groups
        </p>
      </header>

      {/* Summary stats */}
      {summary && (
        <div className="px-4 py-3 border-b border-border shrink-0 bg-muted/30">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="font-semibold text-green-600 dark:text-green-400">
                {summary.active_count}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Suppressed</div>
              <div className="font-semibold text-amber-600 dark:text-amber-400">
                {summary.suppressed_count}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Groups</div>
              <div className="font-semibold">{summary.group_count}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Features</div>
              <div className="font-semibold">{summary.feature_count}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-4 pt-3 pb-0 shrink-0">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Timeline items (scrollable) */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No timeline items found
            </p>
          ) : (
            items.map((item) => {
              const isGroup = item.type === "Group"
              const hasChildren = isGroup && (groupedItems[item.name]?.length ?? 0) > 0
              const isExpanded = expandedGroups.has(item.name)
              const key = `${item.type}:${item.name}`
              const effectiveSuppressed = localSuppressed[key] !== undefined ? localSuppressed[key] : item.suppressed
              const isLocallyChanged = localSuppressed[key] !== undefined && localSuppressed[key] !== item.suppressed

              // Only render groups; features are rendered as children within groups
              if (!isGroup) return null

              return (
                <div key={`${item.type}-${item.name}-${item.index}`}>
                  {/* Group header */}
                  <div
                    className={[
                      "border border-border rounded-lg overflow-hidden",
                      isLocallyChanged ? "border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/20" : "",
                    ].join(" ")}
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                      onClick={() => toggleGroup(item.name)}
                    >
                      <span className="text-muted-foreground">
                        {hasChildren ? (
                          isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                        ) : (
                          <div className="w-[13px]" />
                        )}
                      </span>
                      <button
                        onClick={(e) => handleToggleItem(item, e)}
                        className={[
                          "p-0.5 rounded hover:bg-muted transition-colors shrink-0",
                          effectiveSuppressed
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-green-600 dark:text-green-400",
                        ].join(" ")}
                        title={effectiveSuppressed ? "Unsuppress" : "Suppress"}
                      >
                        {effectiveSuppressed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <span className="text-xs font-semibold font-heading flex-1 min-w-0 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({groupedItems[item.name]?.length ?? 0})
                      </span>
                    </button>

                    {/* Group contents */}
                    {isExpanded && hasChildren && (
                      <div className="px-3 py-3 space-y-2 border-t border-border bg-background/50">
                        {groupedItems[item.name]?.map((child) => {
                          const childKey = `${child.type}:${child.name}`
                          const childEffectiveSuppressed = localSuppressed[childKey] !== undefined ? localSuppressed[childKey] : child.suppressed
                          const childIsLocallyChanged = localSuppressed[childKey] !== undefined && localSuppressed[childKey] !== child.suppressed

                          return (
                            <div
                              key={`${child.type}-${child.name}-${child.index}`}
                              className={[
                                "px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors group/child",
                                childEffectiveSuppressed ? "opacity-60" : "opacity-100",
                                childIsLocallyChanged ? "bg-amber-50/30 dark:bg-amber-950/20" : "",
                              ].join(" ")}
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => handleToggleItem(child, e)}
                                  className={[
                                    "p-0.5 rounded hover:bg-muted transition-colors shrink-0",
                                    childEffectiveSuppressed
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-green-600 dark:text-green-400",
                                  ].join(" ")}
                                  title={childEffectiveSuppressed ? "Unsuppress" : "Suppress"}
                                >
                                  {childEffectiveSuppressed ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>

                                <span
                                  className={[
                                    "flex-1 min-w-0 truncate text-xs font-medium",
                                    childEffectiveSuppressed
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground",
                                  ].join(" ")}
                                >
                                  {child.name}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Action buttons */}
      <footer className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card shrink-0">
        <Button
          onClick={handleSubmit}
          disabled={loading || Object.keys(localSuppressed).length === 0}
          size="sm"
          className="flex-1"
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Applying...
            </>
          ) : (
            <>Submit Changes</>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLocalSuppressed({})
            refreshTimeline()
          }}
          disabled={loading}
          title="Refresh timeline"
        >
          <RefreshCw size={14} />
        </Button>
      </footer>
    </div>
  )

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title={`Timeline (${summary?.active_count ?? 0}/${summary?.total_items ?? 0})`}
        >
          <Layers size={14} />
          <span className="hidden sm:inline">Timeline</span>
          {summary && (
            <span className="text-xs px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
              {summary.active_count}/{summary.total_items}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col w-[380px] p-0">
        {sheetContent}
      </SheetContent>
    </Sheet>
  )
}
