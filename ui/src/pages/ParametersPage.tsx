import { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { sendToPython } from "@/lib/fusion-bridge"
import { isMetricUnit } from "@/lib/units"
import type { ModelPayload, ParameterGroup, PendingParam } from "@/types"
import { X, LayoutGrid, Search, Undo2, Redo2, RefreshCw, RotateCcw, Check, GripVertical } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { HistoryPopover, IconTooltip } from "@/components/HistoryPopover"
import { OptionsPanel } from "@/components/OptionsPanel"
import { usePreferences } from "@/hooks/usePreferences"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

// Extracted components
import {
  expressionsEqual,
  stripTrailingZeros,
  GroupSection,
  SortableGroupItem,
  CustomCategorySection,
  UncategorizedSection,
} from "@/components/parameters"

// ── Parameters page ────────────────────────────────────────────────

export function ParametersPage({
  payload,
  showImportSuccess,
  onDismissImportSuccess,
}: {
  payload: ModelPayload | null
  showImportSuccess?: boolean
  onDismissImportSuccess?: () => void
}) {
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [history, setHistory] = useState<{ name: string; oldVal: string; newVal: string }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set())
  const [originalExpressions, setOriginalExpressions] = useState<Record<string, string>>({})
  const [parameterMap, setParameterMap] = useState<Record<string, { unit: string; unitKind?: string; min?: number; max?: number; minMetric?: number; maxMetric?: number; step?: number; stepMetric?: number }>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [scaleMode, setScaleMode] = useState<"single" | "multi">("single")
  const [originalScaleMode, setOriginalScaleMode] = useState<"single" | "multi">("single")
  const [radiusMode, setRadiusMode] = useState<"compound" | "straight" | "flat">("compound")
  const [originalRadiusMode, setOriginalRadiusMode] = useState<"compound" | "straight" | "flat">("compound")
  const [baselineSet, setBaselineSet] = useState(false)
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false)
  const [editStartValues, setEditStartValues] = useState<Record<string, string>>({})
  const [showErrorFilter, setShowErrorFilter] = useState(false)
  const [pendingParams, setPendingParams] = useState<PendingParam[]>([])
  const [activeAddFormGroupId, setActiveAddFormGroupId] = useState<string | null>(null)
  const [activeAddFormCustomCategoryId, setActiveAddFormCustomCategoryId] = useState<string | null>(null)
  const [customCategories, setCustomCategories] = useState<{ id: string; label: string }[]>([])

  const previousModeRef = useRef<string | undefined>(undefined)
  const previousDocUnitRef = useRef<string | undefined>(undefined)

  const isInitial = !payload?.hasFingerprint
  const documentUnit = payload?.documentUnit ?? "in"

  // ── Group reordering via drag-and-drop ──────────────────────────
  const [prefs, updatePrefs] = usePreferences()
  const [activeGroupDragId, setActiveGroupDragId] = useState<string | null>(null)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortedGroups = useMemo(() => {
    if (!payload) return []
    const order = prefs.groupOrder
    if (!order) return payload.groups
    const map = new Map(payload.groups.map((g) => [g.id, g]))
    const ordered = order.filter((id) => map.has(id)).map((id) => map.get(id)!)
    payload.groups.forEach((g) => { if (!order.includes(g.id)) ordered.push(g) })
    return ordered
  }, [payload, prefs.groupOrder])

  const handleGroupDragStart = useCallback((event: DragStartEvent) => {
    setActiveGroupDragId(event.active.id as string)
  }, [])

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    setActiveGroupDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sortedGroups.findIndex((g) => g.id === active.id)
    const newIndex = sortedGroups.findIndex((g) => g.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(sortedGroups.map((g) => g.id), oldIndex, newIndex)
    updatePrefs({ groupOrder: newOrder })
  }, [sortedGroups, updatePrefs])

  const activeGroupForOverlay = activeGroupDragId
    ? sortedGroups.find((g) => g.id === activeGroupDragId)
    : null

  const allParamNames = useMemo(() => {
    const names = new Set<string>()
    if (payload) {
      for (const group of payload.groups) {
        for (const param of group.parameters) names.add(param.name)
      }
      for (const param of payload.extraParams ?? []) names.add(param.name)
    }
    for (const p of pendingParams) names.add(p.name)
    return names
  }, [payload, pendingParams])

  // ── Sync state from payload ─────────────────────────────────────
  useEffect(() => {
    if (!payload) return

    const baseline: Record<string, string> = {}
    const display: Record<string, string> = {}
    const paramMap: Record<string, { unit: string; unitKind?: string; min?: number; max?: number; minMetric?: number; maxMetric?: number; step?: number; stepMetric?: number }> = {}

    for (const group of payload.groups) {
      for (const param of group.parameters) {
        const isMetric = isMetricUnit(documentUnit) && param.unitKind === 'length'
        const defaultVal = isMetric && param.defaultMetric ? param.defaultMetric : param.default ?? ""
        const expr = param.expression ?? defaultVal ?? ""
        const isParamRef = /^[A-Za-z_][A-Za-z0-9_]*$/.test(expr)
        const numericMatch = expr.match(/^([\d.]+)/)
        const rawDisplayVal = isParamRef
          ? expr
          : numericMatch
            ? numericMatch[1]
            : (defaultVal?.match(/^([\d.]+)/)?.[1] ?? expr)

        const displayVal = isParamRef ? rawDisplayVal : stripTrailingZeros(rawDisplayVal)

        baseline[param.name] = displayVal
        display[param.name] = displayVal
        paramMap[param.name] = {
          unit: param.unit ?? "",
          unitKind: param.unitKind,
          min: param.min !== undefined ? param.min : undefined,
          max: param.max !== undefined ? param.max : undefined,
          minMetric: param.minMetric !== undefined ? param.minMetric : undefined,
          maxMetric: param.maxMetric !== undefined ? param.maxMetric : undefined,
          step: param.step !== undefined ? param.step : undefined,
          stepMetric: param.stepMetric !== undefined ? param.stepMetric : undefined,
        }
      }
    }

    if (payload.extraParams) {
      for (const param of payload.extraParams) {
        const expr = param.expression ?? param.default ?? ""
        const numericMatch = expr.match(/^([\d.]+)/)
        const rawDisplayVal = numericMatch
          ? numericMatch[1]
          : (param.default?.match(/^([\d.]+)/)?.[1] ?? expr)
        const displayVal = stripTrailingZeros(rawDisplayVal)
        baseline[param.name] = displayVal
        display[param.name] = displayVal
        paramMap[param.name] = { unit: param.unit ?? "" }
      }
    }

    if (pendingParams.length > 0) {
      const newlyCreated = new Set(payload.extra)
      setPendingParams((prev) => prev.filter((p) => !newlyCreated.has(p.name)))
    }

    for (const key of Object.keys(display)) {
      const val = display[key]
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(val) && display[val] !== undefined) {
        display[key] = display[val]
        baseline[key] = display[val]
      }
    }

    // Derive scale mode
    const trebExpr = (() => {
      for (const group of payload.groups) {
        for (const param of group.parameters) {
          if (param.name === "ScaleLengthTreb") return param.expression ?? ""
        }
      }
      return ""
    })()
    const isSingleByReference = /^[A-Za-z_][A-Za-z0-9_]*$/.test(trebExpr)

    const derivedScaleMode: "single" | "multi" = isSingleByReference
      ? "single"
      : (() => {
        const bass = parseFloat(display["ScaleLengthBass"] ?? "0")
        const treb = parseFloat(display["ScaleLengthTreb"] ?? "0")
        return Math.abs(bass - treb) > 0.001 ? "multi" : "single"
      })()

    setScaleMode(derivedScaleMode)

    // Derive radius mode
    const heelRadiusExpr = (() => {
      for (const group of payload.groups) {
        for (const param of group.parameters) {
          if (param.name === "HeelRadius") return param.expression ?? ""
        }
      }
      return ""
    })()
    const nutRadiusExpr = (() => {
      for (const group of payload.groups) {
        for (const param of group.parameters) {
          if (param.name === "NutRadius") return param.expression ?? ""
        }
      }
      return ""
    })()

    const isRadiusReference = /^NutRadius$/i.test(heelRadiusExpr.trim())
    const flatValue = isMetricUnit(documentUnit) ? "254000" : "10000"
    const isFlatNut = nutRadiusExpr.includes(flatValue)
    const isFlatHeel = heelRadiusExpr.includes(flatValue)

    const derivedRadiusMode: "compound" | "straight" | "flat" =
      isFlatNut && isFlatHeel ? "flat" :
        isRadiusReference ? "straight" :
          "compound"

    setRadiusMode(derivedRadiusMode)

    const modeChanged = payload?.mode !== previousModeRef.current
    const docUnitChanged = documentUnit !== previousDocUnitRef.current

    const shouldResetBaseline = !baselineSet || payload.mode === 'live' || docUnitChanged || (modeChanged && payload.mode !== 'template' && payload.mode !== 'imported')

    if (shouldResetBaseline) {
      setOriginalExpressions(baseline)
      setOriginalScaleMode(derivedScaleMode)
      setOriginalRadiusMode(derivedRadiusMode)
      setBaselineSet(true)
    }
    previousDocUnitRef.current = documentUnit
    setParameterMap(paramMap)
    setDisplayValues(display)
    setEditStartValues({})
    setValidationErrors({})
    if (modeChanged) {
      setHistory([])
      setHistoryIndex(-1)
      previousModeRef.current = payload?.mode
    }
  }, [payload, documentUnit])

  // ── Validation effect ──────────────────────────────────────────
  useEffect(() => {
    const newErrors: Record<string, string> = {}

    for (const [name, value] of Object.entries(displayValues)) {
      if (!value) continue

      if (radiusMode === "flat" && (name === "NutRadius" || name === "HeelRadius")) continue
      if (name === "HeelCurveRadius" && (value.includes("10000") || value.includes("254000"))) continue

      const limits = parameterMap[name]
      if (!limits) continue

      const numericMatch = value.match(/^-?\d*\.?\d+/)
      if (!numericMatch) continue

      const numValue = parseFloat(numericMatch[0])
      if (isNaN(numValue)) continue

      const isLengthInMm = limits.unitKind === 'length' && isMetricUnit(documentUnit)
      const minVal = isLengthInMm ? limits.minMetric : limits.min
      const maxVal = isLengthInMm ? limits.maxMetric : limits.max

      if (minVal == null && maxVal == null) continue

      const unitSuffix = isLengthInMm ? ' mm' : ''

      if (minVal != null && numValue < minVal) {
        newErrors[name] = `Min: ${minVal.toFixed(1)}${unitSuffix}`
      } else if (maxVal != null && numValue > maxVal) {
        newErrors[name] = `Max: ${maxVal.toFixed(1)}${unitSuffix}`
      }
    }
    setValidationErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      setShowErrorFilter(false)
    }
  }, [displayValues, parameterMap, documentUnit, radiusMode])

  // ── Derived values ─────────────────────────────────────────────
  const finalDisplayValues = useMemo(() => {
    const next = { ...displayValues }
    if (scaleMode === "single") {
      next["ScaleLengthTreb"] = displayValues["ScaleLengthBass"] ?? ""
    }
    if (radiusMode === "straight") {
      next["HeelRadius"] = displayValues["NutRadius"] ?? ""
    }
    return next
  }, [displayValues, scaleMode, radiusMode])

  const modifiedCount = payload
    ? Object.entries(finalDisplayValues).filter(([name, val]) => {
      const original = originalExpressions[name]
      return original !== undefined && !expressionsEqual(val, original)
    }).length
    : 0

  const scaleModeChanged = scaleMode !== originalScaleMode
  const radiusModeChanged = radiusMode !== originalRadiusMode
  const initialChangeCount = isInitial ? (modifiedCount + (scaleModeChanged ? 1 : 0) + (radiusModeChanged ? 1 : 0)) : 0
  const hasChanges = modifiedCount > 0 || scaleModeChanged || radiusModeChanged
  const hasPending = pendingParams.length > 0
  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1
  const hasValidationErrors = Object.keys(validationErrors).length > 0

  // ── Handlers ────────────────────────────────────────────────────
  function handleParamChange(name: string, newVal: string) {
    setDisplayValues((prev) => {
      const next = { ...prev, [name]: newVal }
      if (scaleMode === "single" && name === "ScaleLengthBass") {
        next["ScaleLengthTreb"] = newVal
      }
      if (radiusMode === "straight" && name === "NutRadius") {
        next["HeelRadius"] = newVal
      }
      return next
    })
  }

  function handleParamBlur(name: string, currentValOverride?: string) {
    const currentVal = currentValOverride ?? displayValues[name] ?? ""
    const startVal = editStartValues[name] ?? originalExpressions[name] ?? ""

    if (expressionsEqual(currentVal, startVal)) {
      setEditStartValues((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      return
    }

    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push({ name, oldVal: startVal, newVal: currentVal })

    if (scaleMode === "single" && name === "ScaleLengthBass") {
      const trebStart = editStartValues["ScaleLengthTreb"] ?? originalExpressions["ScaleLengthTreb"] ?? ""
      const trebCurrent = displayValues["ScaleLengthTreb"] ?? ""
      if (!expressionsEqual(trebCurrent, trebStart)) {
        trimmed.push({ name: "ScaleLengthTreb", oldVal: trebStart, newVal: trebCurrent })
      }
    }

    if (radiusMode === "straight" && name === "NutRadius") {
      const heelStart = editStartValues["HeelRadius"] ?? originalExpressions["HeelRadius"] ?? ""
      const heelCurrent = displayValues["HeelRadius"] ?? ""
      if (!expressionsEqual(heelCurrent, heelStart)) {
        trimmed.push({ name: "HeelRadius", oldVal: heelStart, newVal: heelCurrent })
      }
    }

    const maxHistory = 50
    const capped = trimmed.length > maxHistory ? trimmed.slice(-maxHistory) : trimmed
    setHistory(capped)
    setHistoryIndex(capped.length - 1)

    setEditStartValues((prev) => {
      const next = { ...prev }
      delete next[name]
      if (name === "ScaleLengthBass") delete next["ScaleLengthTreb"]
      if (name === "NutRadius") delete next["HeelRadius"]
      return next
    })
  }

  function handleParamFocus(name: string) {
    if (!editStartValues.hasOwnProperty(name)) {
      setEditStartValues((prev) => ({
        ...prev,
        [name]: displayValues[name] ?? ""
      }))
    }
  }

  function handleUndo() {
    if (!canUndo) return
    const entry = history[historyIndex]
    setDisplayValues((prev) => ({ ...prev, [entry.name]: entry.oldVal }))
    setHistoryIndex(historyIndex - 1)
  }

  function handleUndoTo(relativeIndex: number) {
    if (!canUndo) return
    const stepsToUndo = relativeIndex + 1
    let newIndex = historyIndex

    setDisplayValues((prev) => {
      const next = { ...prev }
      for (let i = 0; i < stepsToUndo; i++) {
        const entry = history[newIndex]
        next[entry.name] = entry.oldVal
        newIndex--
      }
      return next
    })
    setHistoryIndex(newIndex)
  }

  function handleRedo() {
    if (!canRedo) return
    const entry = history[historyIndex + 1]
    setDisplayValues((prev) => ({ ...prev, [entry.name]: entry.newVal }))
    setHistoryIndex(historyIndex + 1)
  }

  function handleRedoTo(relativeIndex: number) {
    if (!canRedo) return
    const stepsToRedo = relativeIndex + 1
    let newIndex = historyIndex

    setDisplayValues((prev) => {
      const next = { ...prev }
      for (let i = 0; i < stepsToRedo; i++) {
        const entry = history[newIndex + 1]
        next[entry.name] = entry.newVal
        newIndex++
      }
      return next
    })
    setHistoryIndex(newIndex)
  }

  function handleResetAll() {
    setDisplayValues({ ...originalExpressions })
    setScaleMode(originalScaleMode)
    setRadiusMode(originalRadiusMode)
    setHistory([])
    setHistoryIndex(-1)
  }

  function handleRemovePendingParam(id: string) {
    setPendingParams((prev) => prev.filter((p) => p.id !== id))
  }

  function handlePendingParamChange(id: string, value: string) {
    setPendingParams((prev) => prev.map((p) => p.id === id ? { ...p, value } : p))
  }

  function buildExpression(name: string, displayVal: string): string {
    const unit = parameterMap[name]?.unit || ""
    if (!displayVal) return ""
    if (scaleMode === "single" && name === "ScaleLengthTreb") return "ScaleLengthBass"
    if (radiusMode === "straight" && name === "HeelRadius") return "NutRadius"
    const isParameterRef = /^[A-Za-z_][A-Za-z0-9_]*$/.test(displayVal)
    if (isParameterRef) return displayVal
    if (!unit) return displayVal
    return `${displayVal} ${unit}`
  }

  function buildPendingExpression(p: PendingParam): string {
    const unit = p.unitKind === "length" ? documentUnit : p.unitKind === "angle" ? "deg" : ""
    return unit ? `${p.value} ${unit}` : p.value
  }

  function handleAddCustomCategory(id: string, label: string) {
    setCustomCategories((prev) => [...prev, { id, label }])
  }

  function handleRemoveCustomCategory(id: string) {
    setCustomCategories((prev) => prev.filter((cat) => cat.id !== id))
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Parameters</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track and manage measurements for your guitar.
        </p>
      </header>

      {/* Scale & Radius mode selectors */}
      <div className="shrink-0 border-b border-border bg-muted/30">
        <div className="relative flex items-center justify-center gap-4 py-2.5 px-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Scale Length:
            </label>
            <Select
              value={scaleMode}
              onValueChange={(value: string) => {
                if (value === "single" || value === "multi") {
                  setScaleMode(value)
                }
              }}
            >
              <SelectTrigger
                className={[
                  "w-[140px] h-8 text-xs",
                  scaleMode !== originalScaleMode ? "ring-2 ring-amber-400 focus:ring-2 focus:ring-amber-400" : "",
                ].join(" ")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Scale</SelectItem>
                <SelectItem value="multi">Multi-scale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Radius:
            </label>
            <Select
              value={radiusMode}
              onValueChange={(value: string) => {
                if (value === "compound" || value === "straight" || value === "flat") {
                  setRadiusMode(value)
                }
              }}
            >
              <SelectTrigger
                className={[
                  "w-[120px] h-8 text-xs",
                  radiusMode !== originalRadiusMode ? "ring-2 ring-amber-400 focus:ring-2 focus:ring-amber-400" : "",
                ].join(" ")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compound">Compound</SelectItem>
                <SelectItem value="straight">Straight</SelectItem>
                <SelectItem value="flat">Flat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isInitial && (
            <div className="ml-auto">
              <OptionsPanel
                isOpen={timelineSheetOpen}
                onOpenChange={setTimelineSheetOpen}
                onHeelCurveToggle={(enabled: boolean) => {
                  const flatValue = isMetricUnit(documentUnit) ? '254000 mm' : '10000 in'
                  const defaultValue = isMetricUnit(documentUnit) ? '102 mm' : '4 in'
                  setDisplayValues(prev => ({
                    ...prev,
                    HeelCurveRadius: enabled ? (originalExpressions["HeelCurveRadius"] || defaultValue) : flatValue,
                  }))
                }}
              />
            </div>
          )}
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

        {showErrorFilter && hasValidationErrors && (
          <div className="px-4 pb-3">
            <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-2">
              <span>Showing {Object.keys(validationErrors).length} out-of-range parameter{Object.keys(validationErrors).length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => setShowErrorFilter(false)}
                className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors shrink-0"
                title="Show all parameters"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {showImportSuccess && (
          <div className="px-4 pb-3">
            <div className="rounded-md border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40 px-3 py-2 text-xs text-green-800 dark:text-green-200 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Check size={14} />
                Design parameters imported successfully.
              </span>
              <button
                onClick={onDismissImportSuccess}
                className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors shrink-0"
                title="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {payload && ((isInitial && !dismissedWarnings.has("initial")) || (payload.missing.length > 0 && !dismissedWarnings.has("missing")) || (payload.extra.length > 0 && !dismissedWarnings.has("extra"))) && (
          <div className="px-4 pb-3 space-y-2">
            {isInitial && !dismissedWarnings.has("initial") && (
              <div className="rounded-md border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
                <span>Configure parameters, then click "Import &amp; Apply" to create the model.</span>
                <button
                  onClick={() => setDismissedWarnings((prev) => new Set([...prev, "initial"]))}
                  className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X size={12} />
                </button>
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
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragStart={handleGroupDragStart}
                onDragEnd={handleGroupDragEnd}
              >
                <SortableContext items={sortedGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                  {sortedGroups.map((group: ParameterGroup) => (
                    <SortableGroupItem key={group.id} id={group.id}>
                      {(dragHandleProps) => (
                        <GroupSection
                          group={group}
                          displayValues={displayValues}
                          originalExpressions={originalExpressions}
                          onChange={handleParamChange}
                          onFocus={handleParamFocus}
                          onBlur={handleParamBlur}
                          defaultOpen={true}
                          searchQuery={searchQuery}
                          scaleMode={scaleMode}
                          radiusMode={radiusMode}
                          documentUnit={payload.documentUnit ?? "in"}
                          validationErrors={validationErrors}
                          editStartValues={editStartValues}
                          errorFilter={showErrorFilter ? new Set(Object.keys(validationErrors)) : null}
                          pendingParams={pendingParams.filter((p) => p.groupId === group.id)}
                          categorizedExtras={(payload.extraParams ?? []).filter((p) => p.group === group.id)}
                          groupSchemas={payload.groups.map((g) => ({ id: g.id, label: g.label }))}
                          isAddFormOpen={activeAddFormGroupId === group.id}
                          onOpenAddForm={() => { setActiveAddFormGroupId(group.id); setActiveAddFormCustomCategoryId(null) }}
                          onCloseAddForm={() => setActiveAddFormGroupId(null)}
                          onRemovePendingParam={handleRemovePendingParam}
                          onPendingParamChange={handlePendingParamChange}
                          allParamNames={allParamNames}
                          showAddButton={!isInitial}
                          customCategories={customCategories}
                          onAddCustomCategory={handleAddCustomCategory}
                          onRemoveCustomCategory={handleRemoveCustomCategory}
                          isInitial={isInitial}
                          disabled={group.id === "scallops" || group.id === "fall_away"}
                          dragHandleProps={dragHandleProps}
                        />
                      )}
                    </SortableGroupItem>
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeGroupForOverlay && (
                    <div className="border border-border rounded-lg bg-muted/40 shadow-lg opacity-90">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <GripVertical size={12} className="text-muted-foreground" />
                        <LayoutGrid size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold font-heading">{activeGroupForOverlay.label}</span>
                      </div>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>

              {!isInitial && customCategories.map((cat) => (
                <CustomCategorySection
                  key={cat.id}
                  category={cat}
                  extraParams={(payload.extraParams ?? []).filter((p) => p.group === cat.id)}
                  displayValues={displayValues}
                  originalExpressions={originalExpressions}
                  onChange={handleParamChange}
                  onFocus={handleParamFocus}
                  onBlur={handleParamBlur}
                  searchQuery={searchQuery}
                  parameterMap={parameterMap}
                  groupSchemas={payload.groups.map((g) => ({ id: g.id, label: g.label }))}
                  allParamNames={allParamNames}
                  customCategories={customCategories}
                  onAddCustomCategory={handleAddCustomCategory}
                  onRemoveCustomCategory={handleRemoveCustomCategory}
                  documentUnit={documentUnit}
                  isAddFormOpen={activeAddFormCustomCategoryId === cat.id}
                  onOpenAddForm={() => { setActiveAddFormCustomCategoryId(cat.id); setActiveAddFormGroupId(null) }}
                  onCloseAddForm={() => setActiveAddFormCustomCategoryId(null)}
                />
              ))}

              {payload.extraParams && payload.extraParams.some((p) => !p.group) && (
                <UncategorizedSection
                  extraParams={payload.extraParams.filter((p) => !p.group)}
                  displayValues={displayValues}
                  originalExpressions={originalExpressions}
                  onChange={handleParamChange}
                  onFocus={handleParamFocus}
                  onBlur={handleParamBlur}
                  searchQuery={searchQuery}
                  parameterMap={parameterMap}
                  groupSchemas={payload.groups.map((g) => ({ id: g.id, label: g.label }))}
                  allParamNames={allParamNames}
                  customCategories={customCategories}
                  onAddCustomCategory={handleAddCustomCategory}
                  onRemoveCustomCategory={handleRemoveCustomCategory}
                  documentUnit={documentUnit}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Action bar */}
      <TooltipProvider delayDuration={500}>
        <footer className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card shrink-0">
          <IconTooltip label="Refresh from Fusion">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              sendToPython("GET_MODEL_STATE")
            }}>
              <RefreshCw size={14} />
            </Button>
          </IconTooltip>

          <IconTooltip label="Reset to baseline">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!hasChanges && !hasPending}
              onClick={() => { handleResetAll(); setPendingParams([]) }}
            >
              <RotateCcw size={14} />
            </Button>
          </IconTooltip>

          <Button
            size="sm"
            className={`flex-1 ${hasValidationErrors ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
            disabled={!hasValidationErrors && (!isInitial && !hasChanges && !hasPending)}
            onClick={() => {
              if (hasValidationErrors) {
                setShowErrorFilter(true)
                return
              }
              const creates = pendingParams.map((p) => ({
                name: p.name,
                expression: buildPendingExpression(p),
                description: p.description,
                groupId: p.groupId,
              }))

              if (radiusModeChanged && !isInitial) {
                sendToPython("SET_RADIUS_MODE", { mode: radiusMode })
                setTimeout(() => {
                  applyParameterChanges()
                }, 200)
              } else {
                applyParameterChanges()
              }

              function applyParameterChanges() {
                if (isInitial) {
                  const changedParams: Record<string, string> = {}
                  for (const [name, displayVal] of Object.entries(finalDisplayValues)) {
                    const original = originalExpressions[name]
                    const isScaleModeChange = name === "ScaleLengthTreb" && scaleModeChanged
                    if (original === undefined || !expressionsEqual(displayVal, original) || isScaleModeChange) {
                      changedParams[name] = buildExpression(name, displayVal)
                    }
                  }

                  if (radiusModeChanged) {
                    const flatValue = isMetricUnit(payload?.documentUnit) ? '254000 mm' : '10000 in'
                    if (radiusMode === 'flat') {
                      changedParams['NutRadius'] = flatValue
                      changedParams['HeelRadius'] = flatValue
                    } else if (radiusMode === 'straight') {
                      changedParams['HeelRadius'] = 'NutRadius'
                    } else if (radiusMode === 'compound') {
                      if (!changedParams['NutRadius']) {
                        changedParams['NutRadius'] = originalExpressions['NutRadius'] || ''
                      }
                      if (!changedParams['HeelRadius']) {
                        changedParams['HeelRadius'] = originalExpressions['HeelRadius'] || ''
                      }
                    }
                  }

                  setHistory([])
                  setHistoryIndex(-1)
                  sendToPython("APPLY_PARAMS", { updates: changedParams, creates })
                } else {
                  const changed: Record<string, string> = {}
                  for (const [name, displayVal] of Object.entries(finalDisplayValues)) {
                    const original = originalExpressions[name]
                    const isScaleModeChange = name === "ScaleLengthTreb" && scaleModeChanged
                    if (original !== undefined && (!expressionsEqual(displayVal, original) || isScaleModeChange)) {
                      changed[name] = buildExpression(name, displayVal)
                    }
                  }
                  if (Object.keys(changed).length > 0 || creates.length > 0) {
                    sendToPython("APPLY_PARAMS", { updates: changed, creates })
                  }
                }
              }
            }}
          >
            {hasValidationErrors
              ? "Please Fix Input Out of Range"
              : isInitial
                ? initialChangeCount > 0
                  ? `Import & Apply ${initialChangeCount} change${initialChangeCount !== 1 ? "s" : ""}`
                  : "Quick Load Default"
                : hasChanges || hasPending
                  ? `Apply ${modifiedCount + pendingParams.length} change${(modifiedCount + pendingParams.length) !== 1 ? "s" : ""}${hasPending ? ` (${pendingParams.length} new)` : ""}`
                  : "Apply to Model"}
          </Button>

          <HistoryPopover
            history={history}
            historyIndex={historyIndex}
            direction="undo"
            disabled={!canUndo}
            onSelect={(idx) => handleUndoTo(idx)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canUndo}
              onClick={handleUndo}
            >
              <Undo2 size={14} />
            </Button>
          </HistoryPopover>

          <HistoryPopover
            history={history}
            historyIndex={historyIndex}
            direction="redo"
            disabled={!canRedo}
            onSelect={(idx) => handleRedoTo(idx)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canRedo}
              onClick={handleRedo}
            >
              <Redo2 size={14} />
            </Button>
          </HistoryPopover>
        </footer>
      </TooltipProvider>
    </div>
  )
}
