import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
    DrawerClose,
} from "@/components/ui/drawer"
import { sendToPython, addMessageHandler } from "@/lib/fusion-bridge"
import type { TimelineItem, TimelineSummary } from "@/types"
import {
    ChevronDown,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    Layers,
    ToggleLeft,
    ToggleRight,
    FolderOpen,
    Folder,
    Search,
    X,
    Box,
    PencilLine,
    CuboidIcon,
    RotateCcw,
    Spline,
    Drill,
    Wrench,
    Slice,
    Copy,
    Minus,
    SquareDashed,
    Axis3D,
    Dot,
    Waves,
    ArrowLeftRight,
} from "lucide-react"

interface OptionsPanelProps {
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

// ── Feature type → icon + color mapping ──────────────────────────────────────

type FeatureIconDef = { icon: React.ReactNode; color: string }

const FEATURE_TYPE_ICONS: Record<string, FeatureIconDef> = {
    Sketch: { icon: <PencilLine size={12} />, color: "text-violet-500" },
    Extrude: { icon: <CuboidIcon size={12} />, color: "text-blue-500" },
    Revolve: { icon: <RotateCcw size={12} />, color: "text-blue-400" },
    Sweep: { icon: <Spline size={12} />, color: "text-cyan-500" },
    Loft: { icon: <Waves size={12} />, color: "text-cyan-400" },
    Hole: { icon: <Drill size={12} />, color: "text-orange-500" },
    Thread: { icon: <Wrench size={12} />, color: "text-orange-400" },
    Fillet: { icon: <Minus size={12} />, color: "text-emerald-500" },
    Chamfer: { icon: <Slice size={12} />, color: "text-emerald-400" },
    Shell: { icon: <Box size={12} />, color: "text-teal-500" },
    Pattern: { icon: <Copy size={12} />, color: "text-pink-500" },
    Mirror: { icon: <SquareDashed size={12} />, color: "text-pink-400" },
    Combine: { icon: <Layers size={12} />, color: "text-indigo-500" },
    Split: { icon: <Slice size={12} />, color: "text-red-400" },
    Offset: { icon: <CuboidIcon size={12} />, color: "text-blue-300" },
    Move: { icon: <Box size={12} />, color: "text-slate-400" },
    Surface: { icon: <Waves size={12} />, color: "text-sky-400" },
    Plane: { icon: <SquareDashed size={12} />, color: "text-amber-500" },
    Axis: { icon: <Axis3D size={12} />, color: "text-amber-400" },
    Point: { icon: <Dot size={12} />, color: "text-amber-300" },
    Body: { icon: <CuboidIcon size={12} />, color: "text-slate-500" },
    Form: { icon: <Waves size={12} />, color: "text-purple-400" },
    Fill: { icon: <Box size={12} />, color: "text-teal-400" },
    Edit: { icon: <Wrench size={12} />, color: "text-gray-400" },
    Thicken: { icon: <Layers size={12} />, color: "text-sky-500" },
    Scale: { icon: <CuboidIcon size={12} />, color: "text-blue-200" },
    Feature: { icon: <Box size={12} />, color: "text-muted-foreground/60" },
}

function getFeatureIconDef(featureType?: string | null): FeatureIconDef {
    if (!featureType) return FEATURE_TYPE_ICONS.Feature
    return FEATURE_TYPE_ICONS[featureType] ?? FEATURE_TYPE_ICONS.Feature
}

// ── Action buttons config ─────────────────────────────────────────────────────
//
// Each entry describes one button shown in the Options drawer footer area.
// Add new buttons here — no changes needed elsewhere in this file.
//
// type ActionButton = {
//   id: string                          — unique key, used for loading state
//   icon: React.ReactNode               — icon shown in button
//   label: (activeIndex: number) => string  — dynamic label
//   fusionAction: string                — message sent to Python
//   buildPayload: (activeIndex: number) => object  — data sent with message
//   resultAction: string                — Python response message to listen for
//   states: { label: string }[]        — the toggle states (min 2)
// }

const ACTION_BUTTONS = [
    {
        id: "markerStyle",
        icon: <ArrowLeftRight size={13} />,
        label: (i: number) => `Markers: ${["Circles", "Offset"][i]}`,
        fusionAction: "REMAP_HOLE_TO_SELECTION_SET",
        buildPayload: (nextIndex: number) => ({
            holeName: "Markers Top - Circles",
            selectionSetName: ["Markers Top - Circles", "Markers Top - Offset"][nextIndex],
        }),
        resultAction: "HOLE_POSITION_RESULT",
        states: [{ label: "Circles" }, { label: "Offset" }],
    },
    // Add more action buttons here:
    // {
    //   id: "myAction",
    //   icon: <SomeIcon size={13} />,
    //   label: (i) => `My Action: ${["State A", "State B"][i]}`,
    //   fusionAction: "MY_FUSION_ACTION",
    //   buildPayload: (nextIndex) => ({ someKey: nextIndex }),
    //   resultAction: "MY_RESULT_ACTION",
    //   states: [{ label: "State A" }, { label: "State B" }],
    // },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function OptionsPanel({ isOpen: controlledOpen, onOpenChange }: OptionsPanelProps) {
    const [items, setItems] = useState<TimelineItem[]>([])
    const [summary, setSummary] = useState<TimelineSummary | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [internalOpen, setInternalOpen] = useState(false)
    const [applyingItems, setApplyingItems] = useState<Set<string>>(new Set())

    // Search / state filter
    const [searchQuery, setSearchQuery] = useState("")
    const [stateFilter, setStateFilter] = useState<"all" | "active" | "suppressed">("all")
    // Action button state — keyed by action id
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
    const [actionIndex, setActionIndex] = useState<Record<string, number>>(
        () => Object.fromEntries(ACTION_BUTTONS.map(a => [a.id, 0]))
    )

    const searchInputRef = useRef<HTMLInputElement>(null)

    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
    const handleOpenChange = (open: boolean) => {
        setInternalOpen(open)
        onOpenChange?.(open)
    }

    // Autofocus search when drawer opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100)
        }
    }, [isOpen])

    const refreshTimeline = useCallback(() => {
        setLoading(true)
        setError(null)
        sendToPython("GET_TIMELINE_ITEMS", {})
        sendToPython("GET_TIMELINE_SUMMARY", {})
    }, [])

    const actionResultActions = useMemo(
        () => new Set<string>(ACTION_BUTTONS.map(a => a.resultAction)),
        []
    )

    useEffect(() => {
        return addMessageHandler((action: string, dataJson: string) => {
            const isKnown =
                action === "PUSH_TIMELINE_ITEMS" ||
                action === "PUSH_TIMELINE_SUMMARY" ||
                action === "TIMELINE_OPERATION_RESULT" ||
                actionResultActions.has(action)
            if (!isKnown) return
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
                    }
                    setApplyingItems(new Set())
                    setTimeout(() => refreshTimeline(), 150)
                } else if (actionResultActions.has(action)) {
                    // Clear loading for whichever action produced this result
                    const btn = ACTION_BUTTONS.find(a => a.resultAction === action)
                    if (btn) setActionLoading(prev => ({ ...prev, [btn.id]: false }))
                    if (!data.success) {
                        setError(data.message || "Action failed")
                        setTimeout(() => setError(null), 4000)
                    }
                }
            } catch (e) {
                console.error("Options message parse error:", e)
            }
        })
    }, [refreshTimeline, actionResultActions])

    useEffect(() => {
        if (isOpen) refreshTimeline()
    }, [isOpen, refreshTimeline])

    // ── Helpers ──

    const itemKey = (item: TimelineItem) => `${item.type}:${item.name}`

    const matchesSearch = (item: TimelineItem, query: string) =>
        !query || item.name.toLowerCase().includes(query.toLowerCase())

    const matchesState = (item: TimelineItem) => {
        if (stateFilter === "active") return !item.suppressed
        if (stateFilter === "suppressed") return item.suppressed
        return true
    }

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name); else next.add(name)
            return next
        })
    }

    const handleToggleItem = (item: TimelineItem, e: React.MouseEvent) => {
        e.stopPropagation()
        setApplyingItems(prev => new Set(prev).add(itemKey(item)))
        sendToPython("APPLY_TIMELINE_CHANGES", {
            changes: [{ name: item.name, type: item.type, suppressed: !item.suppressed }]
        })
    }

    const handleToggleAll = (suppress: boolean) => {
        setLoading(true)
        const changes: Array<{ name: string; type: "Feature" | "Group"; suppressed: boolean }> = []
        const collect = (item: TimelineItem) => {
            if (item.suppressed !== suppress)
                changes.push({ name: item.name, type: item.type, suppressed: suppress })
            item.children?.forEach(collect)
        }
        items.forEach(collect)
        if (changes.length === 0) { setLoading(false); return }
        sendToPython("APPLY_TIMELINE_CHANGES", { changes })
    }

    const handleActionButton = (btn: typeof ACTION_BUTTONS[number]) => {
        const current = actionIndex[btn.id] ?? 0
        const next = (current + 1) % btn.states.length
        setActionIndex(prev => ({ ...prev, [btn.id]: next }))
        setActionLoading(prev => ({ ...prev, [btn.id]: true }))
        sendToPython(btn.fusionAction, btn.buildPayload(next))
    }

    // ── Derived data ──

    const { filteredItems, hasActiveFilters, totalMatchCount } = useMemo(() => {
        const query = searchQuery.trim()
        const hasActiveFilters = query !== "" || stateFilter !== "all"

        let filtered = items.filter(item => {
            if (!matchesState(item)) return false
            if (item.type === "Group") {
                return matchesSearch(item, query) ||
                    (item.children ?? []).some(c => matchesSearch(c, query))
            }
            return matchesSearch(item, query)
        })

        // Narrow group children when searching
        filtered = filtered.map(item => {
            if (item.type !== "Group" || !query) return item
            if (matchesSearch(item, query)) return item
            return {
                ...item,
                children: (item.children ?? []).filter(c =>
                    matchesSearch(c, query) && matchesState(c)
                )
            }
        })

        return {
            filteredItems: filtered,
            hasActiveFilters,
            totalMatchCount: filtered.length,
        }
    }, [items, searchQuery, stateFilter])

    const clearAllFilters = () => {
        setSearchQuery("")
        setStateFilter("all")
    }

    // ── Render helpers ──

    const renderToggleButton = (item: TimelineItem) => {
        const key = itemKey(item)
        const isApplying = applyingItems.has(key)
        const isSuppressed = item.suppressed
        return (
            <button
                onClick={e => handleToggleItem(item, e)}
                disabled={isApplying}
                className={[
                    "flex items-center justify-center rounded-md transition-all duration-200 shrink-0 w-8 h-7",
                    isApplying ? "opacity-40 cursor-wait" : "cursor-pointer",
                    isSuppressed
                        ? "text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground"
                        : "text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/10",
                ].join(" ")}
                title={isSuppressed ? "Enable feature" : "Suppress feature"}
            >
                {isApplying
                    ? <RefreshCw size={12} className="animate-spin" />
                    : isSuppressed ? <ToggleLeft size={15} /> : <ToggleRight size={15} />
                }
            </button>
        )
    }

    const renderItem = (item: TimelineItem) => {
        const isGroup = item.type === "Group"
        const children = isGroup ? (item.children ?? []) : []
        const hasChildren = isGroup && children.length > 0
        const isExpanded = expandedGroups.has(item.name)
        const isSuppressed = item.suppressed
        const iconDef = getFeatureIconDef(item.featureType)

        return (
            <div key={`${item.type}-${item.name}-${item.index}`} className="group">
                {isGroup ? (
                    <div className={[
                        "rounded-r-lg border-l-2 transition-all duration-200 mb-0.5",
                        isSuppressed ? "border-l-border/40 opacity-60" : "border-l-border",
                    ].join(" ")}>
                        <div
                            className="flex items-center gap-2 pl-2 pr-1 py-2 cursor-pointer select-none hover:bg-muted/40 rounded-r-lg transition-colors"
                            onClick={() => toggleGroup(item.name)}
                        >
                            <span className="text-muted-foreground/60 shrink-0">
                                {hasChildren
                                    ? isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                                    : <div className="w-[13px]" />
                                }
                            </span>
                            <span className="text-muted-foreground shrink-0">
                                {isExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
                            </span>
                            <span className={[
                                "text-xs font-semibold font-heading flex-1 min-w-0 truncate",
                                isSuppressed ? "text-muted-foreground" : "text-foreground"
                            ].join(" ")}>
                                {item.name.replace(/:\d+$/, '')}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 font-medium">
                                {children.length}
                            </span>
                            {renderToggleButton(item)}
                        </div>

                        {isExpanded && hasChildren && (
                            <div className="pb-1">
                                {children.map(child => {
                                    const childIcon = getFeatureIconDef(child.featureType)
                                    return (
                                        <div
                                            key={`${child.type}-${child.name}-${child.index}`}
                                            className="group flex items-center gap-2 pl-8 pr-1 py-1.5 hover:bg-muted/30 rounded-r-lg transition-colors"
                                        >
                                            <span className={["shrink-0", childIcon.color].join(" ")}>
                                                {childIcon.icon}
                                            </span>
                                            <span className={[
                                                "flex-1 min-w-0 truncate text-xs",
                                                child.suppressed
                                                    ? "text-muted-foreground/50 line-through decoration-muted-foreground/30"
                                                    : "text-foreground/80"
                                            ].join(" ")}>
                                                {child.name}
                                            </span>
                                            {renderToggleButton(child)}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={[
                        "flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors",
                        isSuppressed ? "opacity-60" : ""
                    ].join(" ")}>
                        <span className={["shrink-0", iconDef.color].join(" ")}>
                            {iconDef.icon}
                        </span>
                        <span className={[
                            "flex-1 min-w-0 truncate text-xs",
                            isSuppressed
                                ? "text-muted-foreground/50 line-through decoration-muted-foreground/30"
                                : "text-foreground"
                        ].join(" ")}>
                            {item.name}
                        </span>
                        {renderToggleButton(item)}
                    </div>
                )}
            </div>
        )
    }

    const drawerContent = (
        <div className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                <Layers size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-bold font-heading flex-1">Options</span>
                <button
                    onClick={refreshTimeline}
                    disabled={loading}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                    title="Refresh"
                >
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                </button>
                <DrawerClose asChild>
                    <button className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <X size={14} />
                    </button>
                </DrawerClose>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mx-4 mt-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle size={12} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="shrink-0 hover:opacity-70">
                        <X size={11} />
                    </button>
                </div>
            )}

            {/* ── Filters ── */}
            <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">

                {/* State filter pills */}
                <div className="flex items-center gap-1">
                    {(["all", "active", "suppressed"] as const).map(f => {
                        const isActive = stateFilter === f
                        const count = f === "all" ? summary?.total_items
                            : f === "active" ? summary?.active_count
                                : summary?.suppressed_count
                        const label = f === "all" ? "All" : f === "active" ? "Active" : "Off"
                        return (
                            <button
                                key={f}
                                onClick={() => setStateFilter(f)}
                                className={[
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                                    isActive
                                        ? f === "active" ? "bg-emerald-500 text-white shadow-sm"
                                            : f === "suppressed" ? "bg-amber-500 text-white shadow-sm"
                                                : "bg-foreground text-background shadow-sm"
                                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                ].join(" ")}
                            >
                                <span>{label}</span>
                                {count !== undefined && (
                                    <span className={["text-[10px] tabular-nums font-semibold leading-none", isActive ? "opacity-80" : "opacity-60"].join(" ")}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Search bar */}
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search options..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 transition-shadow"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>

                {/* Active filter indicator */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                            {totalMatchCount} result{totalMatchCount !== 1 ? "s" : ""}
                        </span>
                        <button
                            onClick={clearAllFilters}
                            className="text-[10px] text-muted-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* ── Feature list ── */}
            <ScrollArea className="flex-1">
                <div className="px-3 pt-1 pb-3 space-y-px">
                    {filteredItems.length === 0 ? (
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <RefreshCw size={18} className="animate-spin text-muted-foreground/50" />
                                <p className="text-xs text-muted-foreground/60">Loading features...</p>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <Layers size={22} className="text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground/60">No matching features found in timeline</p>
                                <p className="text-[10px] text-muted-foreground/40">Fret Markers, Nut Slot, Fret Slot Cuts</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <Search size={18} className="text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground/60">No matches</p>
                                <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">
                                    Clear filters
                                </button>
                            </div>
                        )
                    ) : (
                        filteredItems.map(item => renderItem(item))
                    )}
                </div>
            </ScrollArea>

            {/* ── Action buttons ── */}
            <div className="px-4 py-2.5 border-t border-border shrink-0 flex flex-col gap-1.5">
                {ACTION_BUTTONS.map(btn => {
                    const isLoading = actionLoading[btn.id] ?? false
                    const idx = actionIndex[btn.id] ?? 0
                    return (
                        <button
                            key={btn.id}
                            onClick={() => handleActionButton(btn)}
                            disabled={isLoading}
                            className={[
                                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                                isLoading
                                    ? "opacity-50 cursor-wait bg-muted text-muted-foreground"
                                    : "bg-muted hover:bg-accent text-foreground cursor-pointer",
                            ].join(" ")}
                        >
                            {isLoading ? <RefreshCw size={13} className="animate-spin" /> : btn.icon}
                            <span>
                                {(() => {
                                    const lbl = btn.label(idx)
                                    const sep = lbl.indexOf(': ')
                                    if (sep === -1) return lbl
                                    return <>{lbl.slice(0, sep + 2)}<strong>{lbl.slice(sep + 2)}</strong></>
                                })()}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* ── Footer (bulk actions) ── */}
            {items.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-background shrink-0 flex items-center gap-1 rounded-bl-[10px]">
                    <button
                        onClick={() => handleToggleAll(false)}
                        disabled={loading}
                        className="text-[11px] font-medium text-muted-foreground hover:text-emerald-500 transition-colors px-2 py-1 rounded-md hover:bg-muted disabled:opacity-40"
                    >
                        Show All
                    </button>
                    <span className="text-muted-foreground/30 text-xs select-none">·</span>
                    <button
                        onClick={() => handleToggleAll(true)}
                        disabled={loading}
                        className="text-[11px] font-medium text-muted-foreground hover:text-amber-500 transition-colors px-2 py-1 rounded-md hover:bg-muted disabled:opacity-40"
                    >
                        Hide All
                    </button>
                    <div className="flex-1" />
                    {hasActiveFilters && (
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                            {totalMatchCount} of {items.length}
                        </span>
                    )}
                </div>
            )}
        </div>
    )

    return (
        <Drawer open={isOpen} onOpenChange={handleOpenChange} direction="right">
            <DrawerTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    title={`Options (${summary?.active_count ?? 0}/${summary?.total_items ?? 0})`}
                >
                    <Layers size={14} />
                    {!summary && <span className="hidden sm:inline">Options</span>}
                    {summary && (
                        <span className="text-xs px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground tabular-nums">
                            {summary.active_count}/{summary.total_items}
                        </span>
                    )}
                </Button>
            </DrawerTrigger>
            <DrawerContent className="flex flex-col w-[360px] p-0">
                {drawerContent}
            </DrawerContent>
        </Drawer>
    )
}
