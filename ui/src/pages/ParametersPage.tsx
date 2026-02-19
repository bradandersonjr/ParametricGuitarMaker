import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { sendToPython } from "@/lib/fusion-bridge"
import type { ModelPayload, ParameterGroup, Parameter, PendingParam } from "@/types"
import { ChevronDown, ChevronRight, LayoutGrid, X, Search, Undo2, Redo2, Plus, Minus, AlertCircle, RefreshCw, RotateCcw, Check, GripVertical } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { HistoryPopover, IconTooltip } from "@/components/HistoryPopover"
import { TimelinePanel } from "@/components/TimelinePanel"
import { useIsMobile } from "@/hooks/use-mobile"
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ── Helpers ────────────────────────────────────────────────────────

/** Filter input to valid numeric characters.
 *  integerOnly=true: digits only.  integerOnly=false: digits + single decimal point. */
function filterNumericInput(raw: string, integerOnly: boolean): string {
  if (integerOnly) return raw.replace(/[^0-9]/g, "")
  // Allow digits and at most one decimal point
  let result = ""
  let hasDot = false
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") { result += ch }
    else if (ch === "." && !hasDot) { result += ch; hasDot = true }
  }
  return result
}

/** Compare two parameter expressions, treating numerically-equal strings as equal.
 *  "27.00" == "27", "25.400" == "25.4" — falls back to string equality for formulas. */
function expressionsEqual(a: string, b: string): boolean {
  if (a === b) return true
  const na = parseFloat(a)
  const nb = parseFloat(b)
  // Only do numeric comparison if both sides are purely numeric (no formula chars)
  const isNumeric = (s: string) => s.trim() !== "" && !isNaN(Number(s))
  if (isNumeric(a) && isNumeric(b)) return na === nb
  return false
}

// ── Custom category section ────────────────────────────────────────

function CustomCategorySection({
  category,
  extraParams,
  displayValues,
  originalExpressions,
  onChange,
  onFocus,
  onBlur,
  searchQuery,
  parameterMap,
  groupSchemas,
  allParamNames,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  documentUnit,
  isAddFormOpen,
  onOpenAddForm,
  onCloseAddForm,
}: {
  category: { id: string; label: string }
  extraParams: Parameter[]
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  searchQuery: string
  parameterMap: Record<string, { unit: string }>
  groupSchemas: { id: string; label: string }[]
  allParamNames: Set<string>
  customCategories: { id: string; label: string }[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit: string
  isAddFormOpen: boolean
  onOpenAddForm: () => void
  onCloseAddForm: () => void
}) {
  const [open, setOpen] = useState(true)

  const filteredParams = extraParams.filter((param) => {
    const query = searchQuery.toLowerCase()
    return (
      param.name.toLowerCase().includes(query) ||
      param.description.toLowerCase().includes(query)
    )
  })

  if (filteredParams.length === 0 && !isAddFormOpen) {
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
        <span className="text-xs font-semibold font-heading">{category.label}</span>
        <span className="text-xs text-muted-foreground font-normal">
          ({filteredParams.length} parameter{filteredParams.length !== 1 ? "s" : ""})
        </span>
        <span
          role="button"
          aria-label={`Add parameter to ${category.label}`}
          title={`Add parameter to ${category.label}`}
          className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-[11px] font-medium"
          onClick={(e) => { e.stopPropagation(); if (!open) setOpen(true); onOpenAddForm() }}
        >
          <Plus size={11} />
          New Parameter
        </span>
      </button>
      {open && (
        <div className="px-3 py-3 space-y-2">
          {filteredParams.map((param) => {
            const modified = !expressionsEqual(displayValues[param.name] ?? "", originalExpressions[param.name] ?? "")
            const unit = parameterMap[param.name]?.unit || ""
            return (
              <ExtraParamRow
                key={param.name}
                param={param}
                currentGroupId={category.id}
                groupSchemas={groupSchemas}
                displayValue={displayValues[param.name] ?? ""}
                modified={modified}
                unit={unit}
                allParamNames={allParamNames}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                customCategories={customCategories}
                onAddCustomCategory={onAddCustomCategory}
                onRemoveCustomCategory={onRemoveCustomCategory}
                documentUnit={documentUnit}
              />
            )
          })}
          {isAddFormOpen && (
            <AddParamForm
              groupId={category.id}
              documentUnit={documentUnit}
              allParamNames={allParamNames}
              onCancel={onCloseAddForm}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Uncategorized section ──────────────────────────────────────────

function UncategorizedSection({
  extraParams,
  displayValues,
  originalExpressions,
  onChange,
  onFocus,
  onBlur,
  searchQuery,
  parameterMap,
  groupSchemas,
  allParamNames,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  documentUnit,
}: {
  extraParams: Parameter[]
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  searchQuery: string
  parameterMap: Record<string, { unit: string }>
  groupSchemas: { id: string; label: string }[]
  allParamNames: Set<string>
  customCategories: { id: string; label: string }[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
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
            const modified = !expressionsEqual(displayValues[param.name] ?? "", originalExpressions[param.name] ?? "")
            const unit = parameterMap[param.name]?.unit || ""
            return (
              <ExtraParamRow
                key={param.name}
                param={param}
                currentGroupId=""
                groupSchemas={groupSchemas}
                displayValue={displayValues[param.name] ?? ""}
                modified={modified}
                unit={unit}
                allParamNames={allParamNames}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                customCategories={customCategories}
                onAddCustomCategory={onAddCustomCategory}
                onRemoveCustomCategory={onRemoveCustomCategory}
                documentUnit={documentUnit}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Category combobox ─────────────────────────────────────────────

function CategoryCombobox({
  value,
  onChange,
  options,
  onAddCategory,
  onRemoveCategory,
  disabled,
}: {
  value: string
  onChange: (val: string) => void
  options: { id: string; label: string }[]
  onAddCategory?: (id: string, label: string) => void
  onRemoveCategory?: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  )

  const selectedLabel =
    options.find((opt) => opt.id === value)?.label || "Select category..."

  // Check if search text is a new category (not in options and not empty)
  const canCreateNew = search.trim().length > 0 && !options.some((opt) => opt.label.toLowerCase() === search.toLowerCase())

  const handleCreateNew = () => {
    const normalized = search.trim()
    if (normalized.length === 0) return

    // Capitalize first letter
    const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1)
    const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    onAddCategory?.(newId, capitalized)
    onChange(newId)
    setOpen(false)
    setSearch("")
  }

  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? search : selectedLabel}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canCreateNew && !disabled) {
            e.preventDefault()
            handleCreateNew()
          }
        }}
        disabled={disabled}
        placeholder="Select or type..."
        className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30"
      />
      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed z-50 mt-1 rounded-lg border border-border bg-popover shadow-md py-1 max-h-48 overflow-y-auto" style={{
            top: inputRef.current ? `${inputRef.current.getBoundingClientRect().bottom}px` : '0',
            left: inputRef.current ? `${inputRef.current.getBoundingClientRect().left}px` : '0',
            width: inputRef.current ? `${inputRef.current.getBoundingClientRect().width}px` : '0',
          }}>
            {/* Create new category option */}
            {canCreateNew && (
              <button
                onClick={handleCreateNew}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-muted text-green-700 dark:text-green-400 font-medium border-b border-border/50"
              >
                + Create "{search.trim()}"
              </button>
            )}

            {filtered.length === 0 && !canCreateNew ? (
              <div className="px-3 py-1.5 text-xs text-muted-foreground">
                No results found
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.id}
                  className="flex items-center w-full group/item"
                >
                  <button
                    onClick={() => {
                      onChange(opt.id)
                      setOpen(false)
                      setSearch("")
                    }}
                    className={[
                      "flex-1 text-left px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                      value === opt.id ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-medium" : "text-foreground",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                  {/* Delete button for custom categories */}
                  {opt.id.startsWith("custom-") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveCategory?.(opt.id)
                      }}
                      className="px-2 py-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all shrink-0"
                      title="Delete category"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared modal shell ────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-sm">{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto space-y-3">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Unified parameter info / edit modal ───────────────────────────
// isSchema=true  → name is read-only, no category picker, no delete
// isSchema=false → full edit: rename, description, category, delete

function ParamInfoModal({
  param,
  currentGroupId,
  groupSchemas,
  allParamNames,
  displayValue,
  unit,
  isSchema,
  onClose,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  documentUnit,
  isInitial,
}: {
  param: Parameter
  currentGroupId: string
  groupSchemas: { id: string; label: string }[]
  allParamNames: Set<string>
  displayValue: string
  unit: string
  isSchema: boolean
  onClose: () => void
  customCategories: { id: string; label: string }[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
  isInitial: boolean
}) {
  const [name, setName] = useState(param.name)
  const [description, setDescription] = useState(param.description || "")
  const [groupId, setGroupId] = useState(currentGroupId)
  const [nameError, setNameError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  function validateName(n: string): string {
    if (!n) return "Name is required."
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) return "Letters, numbers, underscores only. Must start with a letter or underscore."
    if (n !== param.name && allParamNames.has(n)) return "A parameter with this name already exists."
    return ""
  }

  const hasChanges = name !== param.name || description !== (param.description || "") || groupId !== currentGroupId
  const isValid = name.length > 0 && !nameError

  function handleSave() {
    if (isSchema) {
      // Only save description for schema params
      sendToPython("EDIT_PARAM", { oldName: param.name, newName: param.name, description, groupId: "" })
    } else {
      const err = validateName(name)
      if (err) { setNameError(err); return }
      sendToPython("EDIT_PARAM", { oldName: param.name, newName: name, description, groupId })
    }
    onClose()
  }

  function handleDelete() {
    sendToPython("DELETE_PARAM", { name: param.name })
    onClose()
  }

  const label = (isSchema ? (param.label || param.name) : param.name)

  return (
    <ModalShell title={label} onClose={onClose}>

      {/* Initial mode notice */}
      {isInitial && (
        <div className="rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs space-y-1">
          <p className="text-blue-800 dark:text-blue-200 font-medium">Design Not Loaded</p>
          <p className="text-blue-700 dark:text-blue-300">Load a template or create a design to edit parameters.</p>
        </div>
      )}

      {/* Current value pill */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Current value</p>
          <p className="text-sm font-mono font-semibold text-foreground tabular-nums">
            {displayValue}{unit ? <span className="text-muted-foreground font-normal text-xs"> {unit}</span> : null}
          </p>
        </div>
        {(() => {
          const isMetric = documentUnit === 'mm' && param.unitKind === 'length'
          const displayMin = isMetric ? (param.minMetric ?? param.min) : param.min
          const displayMax = isMetric ? (param.maxMetric ?? param.max) : param.max
          return (displayMin != null || displayMax != null) ? (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Range</p>
              <p className="text-xs font-mono text-muted-foreground tabular-nums">
                {displayMin ?? "—"} – {displayMax ?? "—"}{unit ? ` ${unit}` : ""}
              </p>
            </div>
          ) : null
        })()}
      </div>

      {/* Name */}
      <div>
        <label className="block text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
          Parameter Name
        </label>
        {isSchema ? (
          <div className="flex items-center h-8 px-2.5 rounded-lg border border-input bg-muted/30">
            <span className="text-xs font-mono text-foreground">{param.name}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">read-only</span>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(validateName(e.target.value)) }}
              onKeyDown={(e) => { if (e.key === "Enter" && isValid && !isInitial) handleSave() }}
              autoFocus={!isInitial}
              disabled={isInitial}
              className={[
                "w-full h-8 px-2.5 text-xs font-mono rounded-lg border bg-background focus:outline-none focus:ring-1",
                isInitial ? "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30" : "",
                nameError ? "border-red-500 ring-red-500/50" : "border-input focus:ring-ring",
              ].join(" ")}
            />
            {nameError && <p className="text-[10px] text-red-500 mt-0.5">{nameError}</p>}
          </>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && hasChanges && !isInitial) handleSave() }}
          placeholder="Add a description…"
          autoFocus={isSchema && !isInitial}
          disabled={isInitial}
          className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30"
        />
      </div>

      {/* Category — user params only */}
      {!isSchema && (
        <div>
          <label className="block text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
            Category
          </label>
          <CategoryCombobox
            value={groupId}
            onChange={setGroupId}
            options={[{ id: "", label: "Uncategorized" }, ...groupSchemas, ...customCategories]}
            onAddCategory={onAddCustomCategory}
            onRemoveCategory={onRemoveCustomCategory}
            disabled={isInitial}
          />
        </div>
      )}

      {/* Delete confirmation (user params only) */}
      {!isSchema && confirmDelete && (
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 text-xs space-y-2">
          <p className="text-red-800 dark:text-red-200">Delete <strong>{param.name}</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="h-6 px-2.5 rounded-md border border-red-300 dark:border-red-700 bg-background hover:bg-muted transition-colors text-xs">
              Cancel
            </button>
            <button onClick={handleDelete} className="h-6 px-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors font-medium text-xs">
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {isInitial ? (
        <div className="flex justify-end pt-3 border-t border-border">
          <button onClick={onClose} className="h-7 px-3 text-xs rounded-lg border border-input bg-background hover:bg-muted transition-colors">
            Close
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-3 pb-1 border-t border-border">
          {!isSchema ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="h-7 px-3 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="h-7 px-3 text-xs rounded-lg border border-input bg-background hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || (!isSchema && !isValid)}
              className="h-7 px-3 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

// ── Schema param row (built-in, click to edit description) ──────────

function SchemaParamRow({
  param,
  displayValue,
  displayUnit,
  modified,
  hasError,
  errorMessage,
  scaleMode,
  editStartValues,
  groupSchemas,
  allParamNames,
  onChange,
  onFocus,
  onBlur,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  documentUnit,
  isInitial,
}: {
  param: Parameter
  displayValue: string
  displayUnit: string
  modified: boolean
  hasError: boolean
  errorMessage?: string
  scaleMode: "single" | "multi"
  editStartValues: Record<string, string>
  groupSchemas: { id: string; label: string }[]
  allParamNames: Set<string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  customCategories: { id: string; label: string }[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
  isInitial: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const label = scaleMode === "single" && param.name === "ScaleLengthBass" ? "Scale Length" : param.label

  return (
    <>
      <div
        className="px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer group/row"
        onClick={() => setModalOpen(true)}
        title="Click to edit"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground mb-0.5">{label}</p>
            <p className="text-xs text-muted-foreground">{param.description}</p>
          </div>
          <div
            className="flex items-center justify-center gap-1 shrink-0 w-[130px]"
            onClick={(e) => e.stopPropagation()}
          >
            {!displayUnit ? (
              <button
                onClick={() => {
                  // If not focused yet, set the start value
                  if (!editStartValues.hasOwnProperty(param.name)) {
                    onFocus(param.name)
                  }
                  const val = parseInt(displayValue ?? "0")
                  const newVal = Math.max(parseInt(param.min?.toString() ?? "0"), val - 1).toString()
                  onChange(param.name, newVal)
                  // Trigger blur immediately to record this change to history using the calculated new value
                  setTimeout(() => onBlur(param.name, newVal), 0)
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
              value={displayValue}
              onChange={(e) => onChange(param.name, filterNumericInput(e.target.value, param.step === 1))}
              onFocus={() => onFocus(param.name)}
              onBlur={() => onBlur(param.name)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              placeholder={param.default}
              className={[
                "h-7 px-2 text-xs text-center tabular-nums rounded-lg w-20 shrink-0",
                "border bg-background focus:outline-none",
                "placeholder:text-muted-foreground/50",
                hasError
                  ? "border-red-500 ring-1 ring-red-500/50"
                  : modified
                    ? "border-amber-500 ring-1 ring-amber-500/50"
                    : "border-input focus:ring-1 focus:ring-ring",
              ].join(" ")}
            />
            {!displayUnit ? (
              <button
                onClick={() => {
                  // If not focused yet, set the start value
                  if (!editStartValues.hasOwnProperty(param.name)) {
                    onFocus(param.name)
                  }
                  const val = parseInt(displayValue ?? "0")
                  const newVal = Math.min(parseInt(param.max?.toString() ?? "999"), val + 1).toString()
                  onChange(param.name, newVal)
                  // Trigger blur immediately to record this change to history using the calculated new value
                  setTimeout(() => onBlur(param.name, newVal), 0)
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
        {hasError && <div className="text-xs text-red-500 px-2 mt-1">{errorMessage}</div>}
      </div>
      {modalOpen && (
        <ParamInfoModal
          param={param}
          currentGroupId=""
          groupSchemas={groupSchemas}
          allParamNames={allParamNames}
          displayValue={displayValue}
          unit={displayUnit}
          isSchema={true}
          onClose={() => setModalOpen(false)}
          customCategories={customCategories}
          onAddCustomCategory={onAddCustomCategory}
          onRemoveCustomCategory={onRemoveCustomCategory}
          documentUnit={documentUnit}
          isInitial={isInitial}
        />
      )}
    </>
  )
}

// ── Extra param row (user param, full edit) ───────────────────────

function ExtraParamRow({
  param,
  currentGroupId,
  groupSchemas,
  displayValue,
  modified,
  unit,
  allParamNames,
  onChange,
  onFocus,
  onBlur,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  documentUnit,
}: {
  param: Parameter
  currentGroupId: string
  groupSchemas: { id: string; label: string }[]
  displayValue: string
  modified: boolean
  unit: string
  allParamNames: Set<string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  customCategories: { id: string; label: string }[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
}) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div
        className="px-2 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50/20 dark:bg-purple-950/10 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors cursor-pointer"
        onClick={() => setEditOpen(true)}
        title="Click to edit parameter"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{param.name}</p>
            {param.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{param.description}</p>
            )}
          </div>
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-[19px] shrink-0" />
            <input
              id={`param-${param.name}`}
              type="text"
              value={displayValue}
              onChange={(e) => onChange(param.name, filterNumericInput(e.target.value, false))}
              onFocus={() => onFocus(param.name)}
              onBlur={() => onBlur(param.name)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              className={[
                "h-7 w-20 px-2 text-xs text-center tabular-nums rounded-lg",
                "border bg-background focus:outline-none",
                modified
                  ? "border-amber-500 ring-1 ring-amber-500/50"
                  : "border-input focus:ring-1 focus:ring-ring",
              ].join(" ")}
            />
            <span className="w-[19px] shrink-0 text-xs text-muted-foreground text-center">
              {unit}
            </span>
          </div>
        </div>
      </div>
      {editOpen && (
        <ParamInfoModal
          param={param}
          currentGroupId={currentGroupId}
          groupSchemas={groupSchemas}
          allParamNames={allParamNames}
          displayValue={displayValue}
          unit={unit}
          isSchema={false}
          onClose={() => setEditOpen(false)}
          customCategories={customCategories}
          onAddCustomCategory={onAddCustomCategory}
          onRemoveCustomCategory={onRemoveCustomCategory}
          documentUnit={documentUnit}
          isInitial={false}
        />
      )}
    </>
  )
}

// ── Add parameter inline form ──────────────────────────────────────

function AddParamForm({
  groupId,
  documentUnit,
  allParamNames,
  onCancel,
}: {
  groupId: string
  documentUnit: string
  allParamNames: Set<string>
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [unitKind, setUnitKind] = useState<"length" | "angle" | "unitless">("length")
  const [description, setDescription] = useState("")
  const [nameError, setNameError] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  function validateName(n: string): string {
    if (!n) return ""
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) {
      return "Letters, numbers, underscores only. Must start with a letter or underscore."
    }
    if (allParamNames.has(n)) {
      return "A parameter with this name already exists."
    }
    return ""
  }

  function handleNameChange(n: string) {
    setName(n)
    setNameError(validateName(n))
  }

  const isValid = name.length > 0 && value.length > 0 && !nameError

  function buildExpression(displayVal: string): string {
    const unit = unitKind === "length" ? documentUnit : unitKind === "angle" ? "deg" : ""
    return unit ? `${displayVal} ${unit}` : displayVal
  }

  function handleAdd() {
    if (!isValid || isCreating) return
    const err = validateName(name)
    if (err) { setNameError(err); return }

    setIsCreating(true)

    // Send directly to Python to create the parameter immediately
    const creates = [{
      name,
      expression: buildExpression(value),
      description,
      groupId,
    }]

    sendToPython("APPLY_PARAMS", { updates: {}, creates })

    // Clear form and close
    setName("")
    setValue("")
    setUnitKind("length")
    setDescription("")
    setNameError("")
    setIsCreating(false)
    onCancel()
  }

  const unitDisplay = unitKind === "length" ? documentUnit : unitKind === "angle" ? "deg" : ""

  return (
    <div className="mt-2 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 space-y-2">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Add Parameter</p>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Name (e.g. MyParam)"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleAdd() }}
            className={[
              "w-full h-7 px-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1",
              nameError ? "border-red-500 ring-red-500/50" : "border-input focus:ring-ring",
            ].join(" ")}
            autoFocus
          />
          {nameError && <p className="text-[10px] text-red-500 mt-0.5">{nameError}</p>}
        </div>
        <select
          value={unitKind}
          onChange={(e) => setUnitKind(e.target.value as "length" | "angle" | "unitless")}
          onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleAdd() }}
          className="h-7 px-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
        >
          <option value="length">Length ({documentUnit})</option>
          <option value="angle">Angle (deg)</option>
          <option value="unitless">Unitless</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleAdd() }}
            className="h-7 w-20 px-2 text-xs text-center tabular-nums rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {unitDisplay && <span className="text-xs text-muted-foreground">{unitDisplay}</span>}
        </div>
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleAdd() }}
          className="flex-1 h-7 px-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={isCreating}
          className="h-6 px-2.5 text-xs rounded-md border border-input bg-background hover:bg-muted disabled:opacity-40 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!isValid || isCreating}
          className="h-6 px-2.5 text-xs rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors font-medium"
        >
          {isCreating ? "Creating..." : "Add"}
        </button>
      </div>
    </div>
  )
}

// ── Sortable group wrapper ─────────────────────────────────────────

function SortableGroupItem({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// ── Group section ──────────────────────────────────────────────────

function GroupSection({
  group,
  displayValues,
  originalExpressions,
  onChange,
  onFocus,
  onBlur,
  defaultOpen,
  searchQuery,
  scaleMode,
  documentUnit,
  validationErrors,
  editStartValues,
  errorFilter,
  pendingParams,
  categorizedExtras,
  groupSchemas,
  isAddFormOpen,
  onOpenAddForm,
  onCloseAddForm,
  onRemovePendingParam,
  onPendingParamChange,
  allParamNames,
  showAddButton,
  customCategories,
  onAddCustomCategory,
  onRemoveCustomCategory,
  isInitial,
  disabled,
  dragHandleProps,
}: {
  group: ParameterGroup
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  defaultOpen: boolean
  searchQuery: string
  scaleMode: "single" | "multi"
  documentUnit: string
  validationErrors: Record<string, string>
  editStartValues: Record<string, string>
  errorFilter: Set<string> | null
  pendingParams: PendingParam[]
  categorizedExtras: Parameter[]
  groupSchemas: { id: string; label: string }[]
  isAddFormOpen: boolean
  onOpenAddForm: () => void
  onCloseAddForm: () => void
  onRemovePendingParam: (id: string) => void
  onPendingParamChange: (id: string, value: string) => void
  allParamNames: Set<string>
  showAddButton: boolean
  customCategories: { id: string; label: string }[]
  onAddCustomCategory: (id: string, label: string) => void
  onRemoveCustomCategory: (id: string) => void
  isInitial: boolean
  disabled?: boolean
  dragHandleProps?: Record<string, unknown>
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Filter parameters by search query and scale mode
  const filteredParams = group.parameters.filter((p) => {
    // Hide multiscale-only params in single mode
    if (scaleMode === "single" && ["ScaleLengthTreb", "NeutralFret"].includes(p.name)) {
      return false
    }

    // If showing error filter, only show errored params
    if (errorFilter !== null) {
      return errorFilter.has(p.name)
    }

    const query = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(query) ||
      p.label.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    )
  })

  // Filter categorized extra params by search query
  const filteredExtras = categorizedExtras.filter((p) => {
    if (errorFilter !== null) return false
    const query = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
  })

  // Filter pending params by search query
  const filteredPending = pendingParams.filter((p) => {
    if (errorFilter !== null) return false // pending params have no validation errors
    const query = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
  })

  // Only show group if it has matching parameters or pending params or the add form is open
  if (filteredParams.length === 0 && filteredExtras.length === 0 && filteredPending.length === 0 && !isAddFormOpen) {
    return null
  }

  const totalCount = filteredParams.length + filteredExtras.length + filteredPending.length

  return (
    <div className={`border rounded-lg overflow-hidden ${disabled ? "border-border/50 opacity-60" : "border-border"}`}>
      <div className={`w-full flex items-center gap-0 transition-colors text-left rounded-t-lg group/header ${disabled ? "bg-muted/20" : "bg-muted/40 hover:bg-muted/70"}`}>
        {dragHandleProps && !searchQuery && (
          <span
            {...dragHandleProps}
            className="flex items-center justify-center px-1 py-2 cursor-grab active:cursor-grabbing text-muted-foreground/50 group-hover/header:text-muted-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} />
          </span>
        )}
        <button
          className={`flex-1 flex items-center gap-2 px-2 py-2 transition-colors text-left ${!dragHandleProps || searchQuery ? "pl-3" : ""} ${disabled ? "hover:bg-muted/30" : "bg-transparent"}`}
          onClick={() => setOpen((o) => !o)}
        >
        <span className="text-muted-foreground">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <LayoutGrid size={13} className="text-muted-foreground shrink-0" />
        <span className={`text-xs font-semibold font-heading ${disabled ? "text-muted-foreground" : ""}`}>{group.label}</span>
        <span className="text-xs text-muted-foreground font-normal">
          ({totalCount} parameter{totalCount !== 1 ? "s" : ""})
        </span>
        {disabled && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            Coming soon
          </span>
        )}
        {!disabled && showAddButton && (
          <span
            role="button"
            aria-label={`Add parameter to ${group.label}`}
            title={`Add parameter to ${group.label}`}
            className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-[11px] font-medium"
            onClick={(e) => { e.stopPropagation(); if (!open) setOpen(true); onOpenAddForm() }}
          >
            <Plus size={11} />
            New Parameter
          </span>
        )}
        </button>
      </div>
      {open && (
        <div className="px-3 py-3 space-y-2">
          {filteredParams.map((param) => {
            const modified = !expressionsEqual(displayValues[param.name] ?? "", originalExpressions[param.name] ?? "")
            const displayUnit = param.unit || (param.unitKind === "length" ? documentUnit : param.unitKind === "angle" ? "deg" : "")
            const hasError = !!validationErrors[param.name]
            return (
              <SchemaParamRow
                key={param.name}
                param={param}
                displayValue={displayValues[param.name] ?? ""}
                displayUnit={displayUnit}
                modified={modified}
                hasError={hasError}
                errorMessage={validationErrors[param.name]}
                scaleMode={scaleMode}
                editStartValues={editStartValues}
                groupSchemas={groupSchemas}
                allParamNames={allParamNames}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                customCategories={customCategories}
                onAddCustomCategory={onAddCustomCategory}
                onRemoveCustomCategory={onRemoveCustomCategory}
                documentUnit={documentUnit}
                isInitial={isInitial}
              />
            )
          })}

          {/* Categorized extra params (user-created, assigned to this group) */}
          {filteredExtras.map((param) => {
            const modified = !expressionsEqual(displayValues[param.name] ?? "", originalExpressions[param.name] ?? "")
            const unit = param.unit || ""
            return (
              <ExtraParamRow
                key={param.name}
                param={param}
                currentGroupId={group.id}
                groupSchemas={groupSchemas}
                displayValue={displayValues[param.name] ?? ""}
                modified={modified}
                unit={unit}
                allParamNames={allParamNames}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                customCategories={customCategories}
                onAddCustomCategory={onAddCustomCategory}
                onRemoveCustomCategory={onRemoveCustomCategory}
                documentUnit={documentUnit}
              />
            )
          })}

          {/* Pending (staged) params for this group */}
          {filteredPending.map((p) => {
            const unitDisplay = p.unitKind === "length" ? documentUnit : p.unitKind === "angle" ? "deg" : ""
            return (
              <div
                key={p.id}
                className="px-2 py-2 rounded-lg border-l-2 border-amber-400 bg-amber-50/40 dark:bg-amber-950/10"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{p.name}</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium leading-none">
                        New
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-[19px] shrink-0" />
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) => onPendingParamChange(p.id, e.target.value)}
                      className="h-7 w-20 px-2 text-xs text-center tabular-nums rounded-lg border border-amber-400 bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="w-[19px] shrink-0 text-xs text-muted-foreground text-center">
                      {unitDisplay}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemovePendingParam(p.id)}
                    className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                    title="Remove staged parameter"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Inline add form */}
          {isAddFormOpen && (
            <AddParamForm
              groupId={group.id}
              documentUnit={documentUnit}
              allParamNames={allParamNames}
              onCancel={onCloseAddForm}
            />
          )}
        </div>
      )}
    </div>
  )
}

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
  const [baselineSet, setBaselineSet] = useState(false)
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false)
  const [editStartValues, setEditStartValues] = useState<Record<string, string>>({})
  const [showErrorFilter, setShowErrorFilter] = useState(false)
  const [pendingParams, setPendingParams] = useState<PendingParam[]>([])
  const [activeAddFormGroupId, setActiveAddFormGroupId] = useState<string | null>(null)
  const [activeAddFormCustomCategoryId, setActiveAddFormCustomCategoryId] = useState<string | null>(null)
  const [customCategories, setCustomCategories] = useState<{ id: string; label: string }[]>([])
  const [refreshError, setRefreshError] = useState(false)
  const refreshErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track previous mode and documentUnit to detect when they change
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
    // Append any new groups not in saved order
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

  // All known parameter names (schema + extra from design + pending) — used for duplicate validation
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

  // Reset local state when payload changes
  useEffect(() => {
    if (!payload) return

    const baseline: Record<string, string> = {}
    const display: Record<string, string> = {}
    const paramMap: Record<string, { unit: string; unitKind?: string; min?: number; max?: number; minMetric?: number; maxMetric?: number; step?: number; stepMetric?: number }> = {}

    for (const group of payload.groups) {
      for (const param of group.parameters) {
        // For metric documents, prefer defaultMetric if expression is not available
        const isMetric = documentUnit === 'mm' && param.unitKind === 'length'
        const defaultVal = isMetric && param.defaultMetric ? param.defaultMetric : param.default ?? ""
        const expr = param.expression ?? defaultVal ?? ""
        // If expression is a bare parameter reference (e.g. "ScaleLengthBass"), keep it as-is
        const isParamRef = /^[A-Za-z_][A-Za-z0-9_]*$/.test(expr)
        const numericMatch = expr.match(/^([\d.]+)/)
        // If expression doesn't start with a number (e.g. fraction like "( 3 / 16 ) * 1 in"),
        // fall back to the schema default which is the decimal equivalent.
        // Always use only the numeric part — never include the unit suffix.
        const displayVal = isParamRef
          ? expr
          : numericMatch
            ? numericMatch[1]
            : (defaultVal?.match(/^([\d.]+)/)?.[1] ?? expr)

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

    // Graduate pending params that now exist in Fusion (they were just created)
    if (pendingParams.length > 0) {
      const newlyCreated = new Set(payload.extra)
      setPendingParams((prev) => prev.filter((p) => !newlyCreated.has(p.name)))
    }

    // Resolve parameter reference display values: if a param's display value is another
    // param's name (e.g. ScaleLengthTreb = "ScaleLengthBass"), show the referenced value instead.
    for (const key of Object.keys(display)) {
      const val = display[key]
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(val) && display[val] !== undefined) {
        display[key] = display[val]
        baseline[key] = display[val]
      }
    }

    // Derive scale mode from payload
    const trebVal = display["ScaleLengthTreb"] ?? ""

    // If the raw expression for ScaleLengthTreb is a parameter reference, it's single-scale
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
        const treb = parseFloat(trebVal)
        const isMulti = Math.abs(bass - treb) > 0.001
        return isMulti ? "multi" : "single"
      })()

    setScaleMode(derivedScaleMode)

    // Detect mode changes (e.g. switching from live doc to fresh doc)
    const modeChanged = payload?.mode !== previousModeRef.current
    const docUnitChanged = documentUnit !== previousDocUnitRef.current

    // Reset baseline when:
    // - First load (no baseline yet)
    // - After apply refresh in live mode — design values are the new truth
    // - When mode changes (e.g. switching from live doc to fresh doc), BUT not when loading a template/import
    //   (we want to preserve the live/initial baseline to show diffs against the loaded template)
    // - When documentUnit changes (e.g. imperial defaults loaded first, then metric arrives)
    const shouldResetBaseline = !baselineSet || payload.mode === 'live' || docUnitChanged || (modeChanged && payload.mode !== 'template' && payload.mode !== 'imported')

    if (shouldResetBaseline) {
      setOriginalExpressions(baseline)
      setOriginalScaleMode(derivedScaleMode)
      setBaselineSet(true)
    }
    previousDocUnitRef.current = documentUnit
    setParameterMap(paramMap)
    setDisplayValues(display)
    setEditStartValues({})
    setValidationErrors({})
    // Only clear history on mode changes, not on every refresh
    // This allows undo/redo to work even when the payload updates from Fusion
    if (modeChanged) {
      setHistory([])
      setHistoryIndex(-1)
      previousModeRef.current = payload?.mode
    }
  }, [payload, documentUnit])

  // Re-validate all fields whenever displayValues or parameterMap changes
  useEffect(() => {
    const newErrors: Record<string, string> = {}

    for (const [name, value] of Object.entries(displayValues)) {
      if (!value) continue // Allow empty strings

      const limits = parameterMap[name]
      if (!limits) {
        continue // No limits defined
      }

      // Try to parse the numeric part (handle optional minus sign, digits, optional decimal)
      const numericMatch = value.match(/^-?\d*\.?\d+/)
      if (!numericMatch) continue // Can't parse as number

      const numValue = parseFloat(numericMatch[0])
      if (isNaN(numValue)) continue

      // Use metric limits for mm documents, imperial for others
      const isLengthInMm = limits.unitKind === 'length' && documentUnit === 'mm'
      const minVal = isLengthInMm ? limits.minMetric : limits.min
      const maxVal = isLengthInMm ? limits.maxMetric : limits.max

      if (minVal == null && maxVal == null) {
        continue // No limits defined for this unit system
      }

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
  }, [displayValues, parameterMap, documentUnit])


  const finalDisplayValues = useMemo(() => {
    const next = { ...displayValues }
    if (scaleMode === "single") {
      const bassVal = displayValues["ScaleLengthBass"] ?? ""
      next["ScaleLengthTreb"] = bassVal
    }
    return next
  }, [displayValues, scaleMode])

  const modifiedCount = payload
    ? Object.entries(finalDisplayValues).filter(([name, val]) => {
      const original = originalExpressions[name]
      return original !== undefined && !expressionsEqual(val, original)
    }).length
    : 0

  const scaleModeChanged = scaleMode !== originalScaleMode
  const initialChangeCount = isInitial ? (modifiedCount || (scaleModeChanged ? 1 : 0)) : 0
  const hasChanges = modifiedCount > 0 || scaleModeChanged
  const hasPending = pendingParams.length > 0
  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1
  const hasValidationErrors = Object.keys(validationErrors).length > 0

  function handleParamChange(name: string, newVal: string) {
    // Just update display value immediately (for responsive UI)
    // Validation will happen via useEffect watching displayValues
    setDisplayValues((prev) => {
      const next = { ...prev, [name]: newVal }
      if (scaleMode === "single" && name === "ScaleLengthBass") {
        next["ScaleLengthTreb"] = newVal
      }
      return next
    })
  }

  function handleParamBlur(name: string, currentValOverride?: string) {
    const currentVal = currentValOverride ?? displayValues[name] ?? ""
    const startVal = editStartValues[name] ?? originalExpressions[name] ?? ""

    // If no change, don't add to history
    if (expressionsEqual(currentVal, startVal)) {
      setEditStartValues((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      return
    }

    // Commit this edit to history as a single entry
    const trimmed = history.slice(0, historyIndex + 1)
    trimmed.push({ name, oldVal: startVal, newVal: currentVal })

    // In single mode, also handle the mirrored scale
    if (scaleMode === "single" && name === "ScaleLengthBass") {
      const trebStart = editStartValues["ScaleLengthTreb"] ?? originalExpressions["ScaleLengthTreb"] ?? ""
      const trebCurrent = displayValues["ScaleLengthTreb"] ?? ""
      if (!expressionsEqual(trebCurrent, trebStart)) {
        trimmed.push({ name: "ScaleLengthTreb", oldVal: trebStart, newVal: trebCurrent })
      }
    }

    const maxHistory = 50
    const capped = trimmed.length > maxHistory ? trimmed.slice(-maxHistory) : trimmed
    setHistory(capped)
    setHistoryIndex(capped.length - 1)

    // Clear the edit start value for this field
    setEditStartValues((prev) => {
      const next = { ...prev }
      delete next[name]
      if (name === "ScaleLengthBass") {
        delete next["ScaleLengthTreb"]
      }
      return next
    })
  }

  function handleParamFocus(name: string) {
    // Record the starting value when field is focused
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
    // Undo multiple steps
    // relativeIndex is 0-based index from the dropdown list.
    // The list is displayed as: history.slice(0, current + 1).reverse()
    // So relativeIndex 0 is the most recent (current).
    // We want to undo everything UP TO and INCLUDING that item.

    // Example: History [A, B, C, D], Index = 3 (D)
    // List shows: D, C, B, A
    // Click C (relative index 1)
    // We want to undo D and C.
    // New index should be 1 (B).

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
    // Redo multiple steps
    // relativeIndex is 0-based index from the dropdown list.
    // The list is displayed as history.slice(current + 1)
    // So relativeIndex 0 is the next immediate item.

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

    // In single scale mode, ScaleLengthTreb is always linked to ScaleLengthBass by reference
    if (scaleMode === "single" && name === "ScaleLengthTreb") return "ScaleLengthBass"

    // If displayVal is a parameter reference (e.g., "ScaleLengthBass"), don't add unit suffix
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
        <div className="relative flex items-center justify-center py-2 px-2">
          <div className="inline-flex bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => {
                if (scaleMode === "multi") {
                  // Just switch mode — don't modify values yet
                  // Values only change on Import & Apply
                  setScaleMode("single")
                }
              }}
              className={[
                "px-6 py-1.5 text-xs font-medium rounded-lg transition-colors",
                scaleMode === "single"
                  ? `bg-background text-foreground shadow-sm ${scaleMode !== originalScaleMode ? "ring-2 ring-amber-400" : ""}`
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
                  ? `bg-background text-foreground shadow-sm ${scaleMode !== originalScaleMode ? "ring-2 ring-amber-400" : ""}`
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Multi-scale
            </button>
          </div>
          {!isInitial && (
            <div className="absolute right-2">
              <TimelinePanel isOpen={timelineSheetOpen} onOpenChange={setTimelineSheetOpen} />
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

        {/* Error filter banner */}
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

        {/* Status banners */}
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

        {/* Status banners */}
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

              {/* Custom category sections — one per custom category */}
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

              {/* Uncategorized section — only extra params with no group assignment */}
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
        {refreshError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs">
            <AlertCircle size={13} className="shrink-0" />
            No fretboard detected in the current document.
          </div>
        )}
        <footer className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card shrink-0">
          <IconTooltip label="Refresh from Fusion">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              if (isInitial) {
                setRefreshError(true)
                if (refreshErrorTimerRef.current) clearTimeout(refreshErrorTimerRef.current)
                refreshErrorTimerRef.current = setTimeout(() => setRefreshError(false), 4000)
              } else {
                sendToPython("GET_MODEL_STATE")
              }
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

              if (isInitial) {
                const changedParams: Record<string, string> = {}
                for (const [name, displayVal] of Object.entries(finalDisplayValues)) {
                  const original = originalExpressions[name]
                  const isScaleModeChange = name === "ScaleLengthTreb" && scaleModeChanged
                  if (original === undefined || !expressionsEqual(displayVal, original) || isScaleModeChange) {
                    changedParams[name] = buildExpression(name, displayVal)
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
            }}
          >
            {hasValidationErrors
              ? "Please Fix Input Out of Range"
              : isInitial
                ? initialChangeCount > 0
                  ? `Import & Apply ${initialChangeCount} change${initialChangeCount !== 1 ? "s" : ""}`
                  : "Import & Apply"
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
