import { useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
    DrawerClose,
} from "@/components/ui/drawer"
import { sendToPython, addMessageHandler } from "@/lib/fusion-bridge"
import type { GroupState } from "@/types"
import {
    Layers,
    ToggleLeft,
    ToggleRight,
    RefreshCw,
    AlertCircle,
    X,
    ArrowLeftRight,
    Zap,
    Eye,
    Circle,
} from "lucide-react"

interface OptionsPanelProps {
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

// ── Toggle items config ─────────────────────────────────────────────
//
// Each entry describes one group toggle shown in the Options drawer.
// Add new toggles here — no other code changes needed.

const TOGGLE_ITEMS = [
    { groupName: "Fret Slot Cuts", label: "Fret Slot Cuts" },
    { groupName: "Nut Slot",       label: "Nut Slot" },
    { groupName: "Fret Markers",   label: "Fret Markers" },
] as const

// ── Action buttons config ─────────────────────────────────────────────────────
//
// Each entry describes one button shown in the Options drawer footer area.
// Add new buttons here — no changes needed elsewhere in this file.

const ACTION_BUTTONS = [
    {
        id: "markerStyle",
        icon: <ArrowLeftRight size={13} />,
        label: (i: number) => `Markers: ${["Circles", "Offset"][i]}`,
        fusionAction: "REMAP_HOLE_TO_SELECTION_SET",
        buildPayload: (nextIndex: number, _currentIndex: number) => ({
            holeName: "Markers Top - Circles",
            selectionSetName: ["Markers Top - Circles", "Markers Top - Offset"][nextIndex],
        }),
        resultAction: "HOLE_POSITION_RESULT",
        states: [{ label: "Circles" }, { label: "Offset" }],
    },
    {
        id: "zeroFret",
        icon: <Zap size={13} />,
        label: (i: number) => `Zero Fret: ${["Off", "On"][i]}`,
        fusionAction: "TOGGLE_ZERO_FRET",
        buildPayload: (nextIndex: number, _currentIndex: number) => ({
            enabled: nextIndex === 1,
        }),
        resultAction: "ZERO_FRET_RESULT",
        states: [{ label: "Off" }, { label: "On" }],
    },
    {
        id: "blindFrets",
        icon: <Eye size={13} />,
        label: (i: number) => `Blind Frets: ${["Off", "On"][i]}`,
        fusionAction: "TOGGLE_BLIND_FRETS",
        buildPayload: (nextIndex: number, _currentIndex: number) => ({
            enabled: nextIndex === 1,
        }),
        resultAction: "BLIND_FRETS_RESULT",
        states: [{ label: "Off" }, { label: "On" }],
    },
    {
        id: "radiusCompound",
        icon: <Circle size={13} />,
        label: () => "Compound Radius",
        fusionAction: "SET_RADIUS_MODE",
        buildPayload: (_nextIndex: number, _currentIndex: number) => ({ mode: "compound" }),
        resultAction: "RADIUS_MODE_RESULT",
        states: [{ label: "Compound" }],
    },
    {
        id: "radiusStraight",
        icon: <Circle size={13} />,
        label: () => "Straight Radius",
        fusionAction: "SET_RADIUS_MODE",
        buildPayload: (_nextIndex: number, _currentIndex: number) => ({ mode: "straight" }),
        resultAction: "RADIUS_MODE_RESULT",
        states: [{ label: "Straight" }],
    },
    {
        id: "radiusFlat",
        icon: <Circle size={13} />,
        label: () => "Flat Radius",
        fusionAction: "SET_RADIUS_MODE",
        buildPayload: (_nextIndex: number, _currentIndex: number) => ({ mode: "flat" }),
        resultAction: "RADIUS_MODE_RESULT",
        states: [{ label: "Flat" }],
    },
    {
        id: "heelCurve",
        icon: <Circle size={13} />,
        label: (i: number) => `Heel Curve: ${["Off", "On"][i]}`,
        fusionAction: "TOGGLE_HEEL_CURVE",
        buildPayload: (nextIndex: number, _currentIndex: number) => ({
            enabled: nextIndex === 1,
        }),
        resultAction: "HEEL_CURVE_RESULT",
        states: [{ label: "Off" }, { label: "On" }],
    },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function OptionsPanel({ isOpen: controlledOpen, onOpenChange }: OptionsPanelProps) {
    const [groupStates, setGroupStates] = useState<Record<string, boolean>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [applyingGroups, setApplyingGroups] = useState<Set<string>>(new Set())
    const [internalOpen, setInternalOpen] = useState(false)

    // Action button state
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
    const [actionIndex, setActionIndex] = useState<Record<string, number>>(
        () => Object.fromEntries(ACTION_BUTTONS.map(a => {
            if (a.id === 'blindFrets') return [a.id, 1]
            if (a.id === 'heelCurve') return [a.id, 1]
            return [a.id, 0]
        }))
    )
    const [pendingActionId, setPendingActionId] = useState<string | null>(null)

    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
    const handleOpenChange = (open: boolean) => {
        setInternalOpen(open)
        onOpenChange?.(open)
    }

    const refreshGroupStates = useCallback(() => {
        setLoading(true)
        setError(null)
        sendToPython("GET_GROUP_STATES", {})
    }, [])

    const actionResultActions = useMemo(
        () => new Set<string>(ACTION_BUTTONS.map(a => a.resultAction)),
        []
    )

    useEffect(() => {
        return addMessageHandler((action: string, dataJson: string) => {
            const isKnown =
                action === "PUSH_GROUP_STATES" ||
                action === "TIMELINE_OPERATION_RESULT" ||
                actionResultActions.has(action)
            if (!isKnown) return
            try {
                const data = JSON.parse(dataJson)
                if (action === "PUSH_GROUP_STATES") {
                    const map: Record<string, boolean> = {}
                    for (const g of (data.groups ?? []) as GroupState[]) {
                        map[g.name] = g.suppressed
                    }
                    setGroupStates(map)
                    setLoading(false)
                } else if (action === "TIMELINE_OPERATION_RESULT") {
                    if (!data.success) {
                        setError(data.message || "Operation failed")
                        setTimeout(() => setError(null), 3000)
                    }
                    setApplyingGroups(new Set())
                    setTimeout(() => refreshGroupStates(), 150)
                } else if (actionResultActions.has(action)) {
                    if (pendingActionId) {
                        setActionLoading(prev => ({ ...prev, [pendingActionId]: false }))
                        setPendingActionId(null)
                    }
                    if (!data.success) {
                        setError(data.message || "Action failed")
                        setTimeout(() => setError(null), 4000)
                    }
                }
            } catch (e) {
                console.error("Options message parse error:", e)
            }
        })
    }, [refreshGroupStates, actionResultActions, pendingActionId])

    useEffect(() => {
        if (isOpen) refreshGroupStates()
    }, [isOpen, refreshGroupStates])

    // ── Handlers ──

    const handleToggle = (groupName: string) => {
        // Find the actual key in groupStates that matches this group prefix
        const key = Object.keys(groupStates).find(
            k => k === groupName || k.startsWith(groupName + ':')
        )
        if (!key) return

        setApplyingGroups(prev => new Set(prev).add(key))

        // Determine the new suppression state based on the group being toggled
        const newSuppressedState = !groupStates[key]

        // When toggling Fret Slot Cuts and Zero Fret is enabled, also toggle Zero Fret Slot Cut with the same state
        const changes: Array<{ name: string; type: string; suppressed: boolean }> = [
            { name: key, type: "Group", suppressed: newSuppressedState }
        ]

        if (groupName === "Fret Slot Cuts" && (actionIndex['zeroFret'] ?? 0) === 1) {
            const zeroFretSlotCutKey = Object.keys(groupStates).find(
                k => k === "Zero Fret Slot Cut" || k.startsWith("Zero Fret Slot Cut" + ':')
            )
            if (zeroFretSlotCutKey) {
                changes.push({
                    name: zeroFretSlotCutKey,
                    type: "Group",
                    suppressed: newSuppressedState
                })
                setApplyingGroups(prev => new Set(prev).add(zeroFretSlotCutKey))
            }
        }

        sendToPython("APPLY_TIMELINE_CHANGES", { changes })
    }

    const handleActionButton = (btn: typeof ACTION_BUTTONS[number]) => {
        setActionLoading(prev => ({ ...prev, [btn.id]: true }))
        setPendingActionId(btn.id)
        const nextIndex = (actionIndex[btn.id] ?? 0) + 1
        const currentIndex = actionIndex[btn.id] ?? 0
        const payload = btn.buildPayload(nextIndex, currentIndex)
        setActionIndex(prev => ({ ...prev, [btn.id]: nextIndex % btn.states.length }))
        sendToPython(btn.fusionAction, payload)
    }

    // ── Helpers ──

    const resolveGroupState = (groupName: string): { key: string | null; suppressed: boolean } => {
        const key = Object.keys(groupStates).find(
            k => k === groupName || k.startsWith(groupName + ':')
        )
        return { key: key ?? null, suppressed: key ? groupStates[key] : false }
    }

    // ── Render ──

    const drawerContent = (
        <div className="flex flex-col h-full">

            {/* ── Header ── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                <Layers size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-bold font-heading flex-1">Options</span>
                <button
                    onClick={refreshGroupStates}
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

            {/* ── Toggle list ── */}
            <div className="flex-1 px-3 pt-3 pb-3 space-y-1">
                {loading && Object.keys(groupStates).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <RefreshCw size={18} className="animate-spin text-muted-foreground/50" />
                        <p className="text-xs text-muted-foreground/60">Loading...</p>
                    </div>
                ) : (
                    TOGGLE_ITEMS.map(item => {
                        const { key, suppressed } = resolveGroupState(item.groupName)
                        const isApplying = key ? applyingGroups.has(key) : false
                        const isActive = key ? !suppressed : false

                        return (
                            <div
                                key={item.groupName}
                                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/40 transition-colors"
                            >
                                <span className={[
                                    "flex-1 text-xs font-medium",
                                    !key ? "text-muted-foreground/40" : isActive ? "text-foreground" : "text-muted-foreground",
                                ].join(" ")}>
                                    {item.label}
                                </span>
                                <button
                                    onClick={() => handleToggle(item.groupName)}
                                    disabled={isApplying || !key}
                                    className={[
                                        "flex items-center justify-center rounded-md transition-all duration-200 shrink-0 w-8 h-7",
                                        isApplying ? "opacity-40 cursor-wait" : !key ? "opacity-30" : "cursor-pointer",
                                        isActive
                                            ? "text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/10"
                                            : "text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground",
                                    ].join(" ")}
                                    title={!key ? "Group not found" : isActive ? "Suppress group" : "Enable group"}
                                >
                                    {isApplying
                                        ? <RefreshCw size={12} className="animate-spin" />
                                        : isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />
                                    }
                                </button>
                            </div>
                        )
                    })
                )}
            </div>

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
        </div>
    )

    return (
        <Drawer open={isOpen} onOpenChange={handleOpenChange} direction="right">
            <DrawerTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    title="Options"
                >
                    <Layers size={14} />
                    <span className="hidden sm:inline">Options</span>
                </Button>
            </DrawerTrigger>
            <DrawerContent className="flex flex-col w-[360px] p-0">
                {drawerContent}
            </DrawerContent>
        </Drawer>
    )
}
