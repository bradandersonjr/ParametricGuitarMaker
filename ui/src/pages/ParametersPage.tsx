import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { sendToPython } from "@/lib/fusion-bridge"
import type { ModelPayload, ParameterGroup, Parameter } from "@/types"
import { ChevronDown, ChevronRight, LayoutGrid, X, Search, Undo2, Redo2, Plus, Minus, AlertCircle } from "lucide-react"
import { TimelinePanel } from "@/components/TimelinePanel"

// ── Uncategorized section ──────────────────────────────────────────

function UncategorizedSection({
  extraParams,
  displayValues,
  originalExpressions,
  onChange,
  searchQuery,
  parameterMap,
}: {
  extraParams: Parameter[]
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  searchQuery: string
  parameterMap: Record<string, { unit: string }>
}) {
  const [open, setOpen] = useState(true)

  // Filter extra params by search query
  const filteredParams = extraParams.filter((param) => {
    const query = searchQuery.toLowerCase()
    return (
      param.name.toLowerCase().includes(query) ||
      param.description.toLowerCase().includes(query)
    )
  })

  if (filteredParams.length === 0) {
    return null
  }

  return (
    <div className="border border-blue-300 dark:border-blue-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left rounded-t-lg"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-blue-600 dark:text-blue-400">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <AlertCircle size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-xs font-semibold font-heading text-blue-800 dark:text-blue-200">Uncategorized</span>
        <span className="text-xs text-blue-700 dark:text-blue-300 font-normal">
          ({filteredParams.length} parameter{filteredParams.length !== 1 ? "s" : ""})
        </span>
      </button>
      {open && (
        <div className="px-3 py-3 space-y-2 bg-blue-50/50 dark:bg-blue-950/20">
          {filteredParams.map((param) => {
            const modified = displayValues[param.name] !== originalExpressions[param.name]
            const unit = parameterMap[param.name]?.unit || ""
            return (
              <div
                key={param.name}
                className="px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors group/row"
              >
                <div className="flex items-start gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`param-${param.name}`} className="block text-xs font-medium text-foreground mb-0.5">
                      {param.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{param.description || "User-defined parameter"}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      id={`param-${param.name}`}
                      type="text"
                      value={displayValues[param.name] ?? ""}
                      onChange={(e) => onChange(param.name, e.target.value)}
                      className={[
                        "h-8 w-20 px-2 py-1 rounded-md text-xs text-center tabular-nums",
                        "border bg-background",
                        "focus:outline-none focus:ring-1 focus:ring-ring",
                        modified ? "border-primary/50 bg-primary/5" : "border-input",
                      ].join(" ")}
                    />
                    {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
                  </div>
                </div>
                {modified && (
                  <div className="text-xs text-muted-foreground px-2">
                    Original: <span className="font-medium">{originalExpressions[param.name]}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Group section ──────────────────────────────────────────────────

function GroupSection({
  group,
  displayValues,
  originalExpressions,
  onChange,
  defaultOpen,
  searchQuery,
  scaleMode,
  documentUnit,
}: {
  group: ParameterGroup
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  defaultOpen: boolean
  searchQuery: string
  scaleMode: "single" | "multi"
  documentUnit: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Filter parameters by search query and scale mode
  const filteredParams = group.parameters.filter((p) => {
    // Hide multiscale-only params in single mode
    if (scaleMode === "single" && ["ScaleLengthTreb", "NeutralFret"].includes(p.name)) {
      return false
    }

    const query = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(query) ||
      p.label.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    )
  })


  // Only show group if it has matching parameters
  if (filteredParams.length === 0) {
    return null
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left rounded-t-lg"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted-foreground">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <LayoutGrid size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold font-heading">{group.label}</span>
        <span className="text-xs text-muted-foreground font-normal">
          ({filteredParams.length} parameter{filteredParams.length !== 1 ? "s" : ""})
        </span>
      </button>
      {open && (
        <div className="px-3 py-3 space-y-2">
          {filteredParams.map((param) => {
            const modified = displayValues[param.name] !== originalExpressions[param.name]
            const displayUnit = param.unit || (param.unitKind === "length" ? documentUnit : param.unitKind === "angle" ? "deg" : "")
            return (
              <div
                key={param.name}
                className="px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors group/row"
              >
                <div className="flex items-center gap-3">
                  {/* Parameter name and description */}
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`param-${param.name}`} className="block text-xs font-medium text-foreground mb-0.5">
                      {scaleMode === "single" && param.name === "ScaleLengthBass" ? "Scale Length" : param.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{param.description}</p>
                  </div>

                  {/* Value input with unit — fixed width so all rows align identically */}
                  <div className="flex items-center justify-center gap-1 shrink-0 w-[130px]">
                    {!displayUnit ? (
                      <button
                        onClick={() => {
                          const val = parseInt(displayValues[param.name] ?? "0")
                          onChange(param.name, Math.max(parseInt(param.min?.toString() ?? "0"), val - 1).toString())
                        }}
                        className="p-0.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Decrease"
                      >
                        <Minus size={14} />
                      </button>
                    ) : (
                      <div className="w-[19px] shrink-0" />
                    )}
                    <input
                      id={`param-${param.name}`}
                      type="text"
                      value={displayValues[param.name] ?? ""}
                      onChange={(e) => onChange(param.name, e.target.value)}
                      placeholder={param.default}
                      className={[
                        "h-7 px-2 text-xs text-center tabular-nums rounded-lg w-20 shrink-0",
                        "border bg-background",
                        "focus:outline-none",
                        "placeholder:text-muted-foreground/50",
                        modified
                          ? "border-amber-500 ring-1 ring-amber-500/50"
                          : "border-input focus:ring-1 focus:ring-ring",
                      ].join(" ")}
                    />
                    {!displayUnit ? (
                      <button
                        onClick={() => {
                          const val = parseInt(displayValues[param.name] ?? "0")
                          onChange(param.name, Math.min(parseInt(param.max?.toString() ?? "999"), val + 1).toString())
                        }}
                        className="p-0.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Increase"
                      >
                        <Plus size={14} />
                      </button>
                    ) : (
                      <span className="w-[19px] shrink-0 text-xs text-muted-foreground text-center">
                        {displayUnit}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Parameters page ────────────────────────────────────────────────

export function ParametersPage({
  payload,
}: {
  payload: ModelPayload | null
}) {
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [history, setHistory] = useState<{ name: string; oldVal: string; newVal: string }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set())
  const [originalExpressions, setOriginalExpressions] = useState<Record<string, string>>({})
  const [parameterMap, setParameterMap] = useState<Record<string, { unit: string }>>({})
  const [scaleMode, setScaleMode] = useState<"single" | "multi">("single")
  const [baselineSet, setBaselineSet] = useState(false)
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false)

  const isInitial = !payload?.hasFingerprint

  // Reset local state when payload changes
  useEffect(() => {
    if (!payload) return

    const baseline: Record<string, string> = {}
    const display: Record<string, string> = {}
    const paramMap: Record<string, { unit: string }> = {}

    for (const group of payload.groups) {
      for (const param of group.parameters) {
        const expr = param.expression ?? param.default ?? ""
        const numericMatch = expr.match(/^([\d.]+)/)
        // If expression doesn't start with a number (e.g. fraction like "( 3 / 16 ) * 1 in"),
        // fall back to the schema default which is the decimal equivalent
        const displayVal = numericMatch
          ? numericMatch[1]
          : (param.default?.match(/^([\d.]+)/)?.[1] ?? expr)

        baseline[param.name] = displayVal
        display[param.name] = displayVal
        paramMap[param.name] = { unit: param.unit ?? "" }
      }
    }

    // Initialize extra (uncategorized) parameters from extraParams array
    // Extra params come from the design but aren't in the schema
    // Always extract from expression (which is in user units), never use raw value (which is in cm)
    if (payload.extraParams) {
      for (const param of payload.extraParams) {
        const expr = param.expression ?? param.default ?? ""
        const numericMatch = expr.match(/^([\d.]+)/)
        const displayVal = numericMatch
          ? numericMatch[1]
          : (param.default?.match(/^([\d.]+)/)?.[1] ?? expr)

        baseline[param.name] = displayVal
        display[param.name] = displayVal
        paramMap[param.name] = { unit: param.unit ?? "" }
      }
    }

    // Derive scale mode from payload: if scales are equal (within tolerance), use single mode
    const bass = parseFloat(display["ScaleLengthBass"] ?? "0")
    const treb = parseFloat(display["ScaleLengthTreb"] ?? "0")
    const isMulti = Math.abs(bass - treb) > 0.001
    setScaleMode(isMulti ? "multi" : "single")

    // Reset baseline when:
    // - First load (no baseline yet)
    // - After apply refresh in live mode — design values are the new truth
    // Do NOT reset on template load — we want amber diffs vs the previous baseline
    const shouldResetBaseline = !baselineSet || payload.mode === 'live'
    if (shouldResetBaseline) {
      setOriginalExpressions(baseline)
      setBaselineSet(true)
    }
    setParameterMap(paramMap)
    setDisplayValues(display)
    setHistory([])
    setHistoryIndex(-1)
  }, [payload])

  const modifiedCount = payload
    ? Object.entries(displayValues).filter(([name, val]) => {
      const original = originalExpressions[name]
      return original !== undefined && val !== original
    }).length
    : 0

  const initialChangeCount = isInitial ? modifiedCount : 0
  const hasChanges = modifiedCount > 0
  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1

  function handleParamChange(name: string, newVal: string) {
    const oldVal = displayValues[name] ?? ""
    if (oldVal === newVal) return

    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push({ name, oldVal, newVal })

    // In single mode, mirror ScaleLengthBass to ScaleLengthTreb
    if (scaleMode === "single" && name === "ScaleLengthBass") {
      const trebOldVal = displayValues["ScaleLengthTreb"] ?? ""
      trimmed.push({ name: "ScaleLengthTreb", oldVal: trebOldVal, newVal })
    }

    const maxHistory = 50
    const capped = trimmed.length > maxHistory ? trimmed.slice(-maxHistory) : trimmed
    setHistory(capped)
    setHistoryIndex(capped.length - 1)
    setDisplayValues((prev) => {
      const next = { ...prev, [name]: newVal }
      if (scaleMode === "single" && name === "ScaleLengthBass") {
        next["ScaleLengthTreb"] = newVal
      }
      return next
    })
  }

  function handleUndo() {
    if (!canUndo) return
    const entry = history[historyIndex]
    setDisplayValues((prev) => ({ ...prev, [entry.name]: entry.oldVal }))
    setHistoryIndex(historyIndex - 1)
  }

  function handleRedo() {
    if (!canRedo) return
    const entry = history[historyIndex + 1]
    setDisplayValues((prev) => ({ ...prev, [entry.name]: entry.newVal }))
    setHistoryIndex(historyIndex + 1)
  }

  function handleResetAll() {
    setDisplayValues({ ...originalExpressions })
    setHistory([])
    setHistoryIndex(-1)
  }


  function buildExpression(name: string, displayVal: string): string {
    const unit = parameterMap[name]?.unit || ""
    if (!displayVal) return ""
    if (!unit) return displayVal
    return `${displayVal} ${unit}`
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Parameters</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track and manage measurements for your guitar.
        </p>
      </header>

      {/* Scale mode toggle - tabs */}
      <div className="shrink-0 border-b border-border bg-muted/30">
        <div className="flex justify-center py-2">
          <div className="inline-flex bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => {
                if (scaleMode === "multi") {
                  // Switching to single: mirror Bass to Treb
                  const bassVal = displayValues["ScaleLengthBass"] ?? ""
                  if (displayValues["ScaleLengthTreb"] !== bassVal) {
                    handleParamChange("ScaleLengthTreb", bassVal)
                  }
                  setScaleMode("single")
                }
              }}
              className={[
                "px-6 py-1.5 text-xs font-medium rounded-lg transition-colors",
                scaleMode === "single"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Single Scale
            </button>
            <button
              onClick={() => setScaleMode("multi")}
              className={[
                "px-6 py-1.5 text-xs font-medium rounded-lg transition-colors",
                scaleMode === "multi"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Multi-scale
            </button>
          </div>
        </div>
      </div>

      {/* Search bar and status banners */}
      <div className="shrink-0 border-b border-border">
        <div className="px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search parameters by name, label, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={[
                "w-full h-8 pl-8 pr-3 text-xs rounded-lg",
                "border bg-background",
                "focus:outline-none focus:ring-1 focus:ring-ring",
                "placeholder:text-muted-foreground/50",
                "border-input",
              ].join(" ")}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded transition-colors"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Status banners */}
        {payload && (isInitial || (payload.missing.length > 0 && !dismissedWarnings.has("missing")) || (payload.extra.length > 0 && !dismissedWarnings.has("extra"))) && (
          <div className="px-4 pb-3 space-y-2">
            {isInitial && (
              <div className="rounded-md border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
                Configure parameters, then click "Import &amp; Apply" to create the model.
              </div>
            )}
            {!isInitial && payload.missing.length > 0 && !dismissedWarnings.has("missing") && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200 flex items-center justify-between gap-2">
                <span>Missing parameters: {payload.missing.join(", ")}</span>
                <button
                  onClick={() => setDismissedWarnings((prev) => new Set([...prev, "missing"]))}
                  className="p-0.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 rounded transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {!isInitial && payload.extra.length > 0 && !dismissedWarnings.has("extra") && (
              <div className="rounded-md border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
                <span>Extra parameters (not in schema): {payload.extra.join(", ")}</span>
                <button
                  onClick={() => setDismissedWarnings((prev) => new Set([...prev, "extra"]))}
                  className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Parameter groups */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {!payload ? (
            <p className="text-sm text-muted-foreground">Loading parameters...</p>
          ) : (
            <>
              {payload.groups.map((group: ParameterGroup) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  displayValues={displayValues}
                  originalExpressions={originalExpressions}
                  onChange={handleParamChange}
                  defaultOpen={true}
                  searchQuery={searchQuery}
                  scaleMode={scaleMode}
                  documentUnit={payload.documentUnit ?? "in"}
                />
              ))}

              {/* Uncategorized section for extra parameters */}
              {payload.extraParams && payload.extraParams.length > 0 && (
                <UncategorizedSection
                  extraParams={payload.extraParams}
                  displayValues={displayValues}
                  originalExpressions={originalExpressions}
                  onChange={handleParamChange}
                  searchQuery={searchQuery}
                  parameterMap={parameterMap}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Action bar */}
      <footer className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card shrink-0">
        {!isInitial && <TimelinePanel isOpen={timelineSheetOpen} onOpenChange={setTimelineSheetOpen} />}

        <Button variant="secondary" size="sm" onClick={() => sendToPython("GET_MODEL_STATE")}>
          Refresh
        </Button>
        {!isInitial && hasChanges && (
          <Button variant="ghost" size="sm" onClick={handleResetAll} title="Reset all to baseline">
            Reset
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1"
          disabled={!isInitial && !hasChanges}
          onClick={() => {
            if (isInitial) {
              const changedParams: Record<string, string> = {}
              for (const [name, displayVal] of Object.entries(displayValues)) {
                const original = originalExpressions[name]
                if (original === undefined || displayVal !== original) {
                  changedParams[name] = buildExpression(name, displayVal)
                }
              }
              setHistory([])
              setHistoryIndex(-1)
              sendToPython("APPLY_PARAMS", changedParams)
            } else {
              const changed: Record<string, string> = {}
              for (const [name, displayVal] of Object.entries(displayValues)) {
                const original = originalExpressions[name]
                if (original !== undefined && displayVal !== original) {
                  changed[name] = buildExpression(name, displayVal)
                }
              }
              if (Object.keys(changed).length > 0) {
                sendToPython("APPLY_PARAMS", changed)
              }
            }
          }}
        >
          {isInitial
            ? initialChangeCount > 0
              ? `Import & Apply ${initialChangeCount} change${initialChangeCount !== 1 ? "s" : ""}`
              : "Import & Apply"
            : hasChanges
              ? `Apply ${modifiedCount} change${modifiedCount !== 1 ? "s" : ""}`
              : "Apply to Model"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canUndo}
          onClick={handleUndo}
          title="Undo"
        >
          <Undo2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canRedo}
          onClick={handleRedo}
          title="Redo"
        >
          <Redo2 size={14} />
        </Button>
      </footer>
    </div>
  )
}
