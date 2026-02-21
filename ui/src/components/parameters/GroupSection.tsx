import React, { useState } from "react"
import { ChevronDown, ChevronRight, LayoutGrid, X, Plus, AlertCircle, GripVertical } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { expressionsEqual } from "./helpers"
import { SchemaParamRow } from "./SchemaParamRow"
import { ExtraParamRow } from "./ExtraParamRow"
import { AddParamForm } from "./AddParamForm"
import type {
  GroupSectionProps,
  CustomCategorySectionProps,
  UncategorizedSectionProps,
} from "./types"

// ── Sortable group wrapper ─────────────────────────────────────────

export function SortableGroupItem({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => React.ReactNode }) {
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

export function GroupSection({
  group,
  displayValues,
  originalExpressions,
  onChange,
  onFocus,
  onBlur,
  defaultOpen,
  searchQuery,
  scaleMode,
  radiusMode,
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
}: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  // Filter parameters by search query, scale mode, and radius mode
  const filteredParams = group.parameters.filter((p) => {
    if (scaleMode === "single" && ["ScaleLengthTreb", "NeutralFret"].includes(p.name)) {
      return false
    }

    if (radiusMode === "straight" && p.name === "HeelRadius") {
      return false
    }
    if (radiusMode === "flat" && ["NutRadius", "HeelRadius"].includes(p.name)) {
      return false
    }

    if (p.name === "HeelCurveRadius") {
      const heelCurveVal = displayValues["HeelCurveRadius"] ?? ""
      const flatValueImperial = "10000"
      const flatValueMetric = "254000"
      if (heelCurveVal.includes(flatValueImperial) || heelCurveVal.includes(flatValueMetric)) {
        return false
      }
    }

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

  const filteredExtras = categorizedExtras.filter((p) => {
    if (errorFilter !== null) return false
    const query = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
  })

  const filteredPending = pendingParams.filter((p) => {
    if (errorFilter !== null) return false
    const query = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
  })

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
                radiusMode={radiusMode}
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

// ── Custom category section ────────────────────────────────────────

export function CustomCategorySection({
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
}: CustomCategorySectionProps) {
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

export function UncategorizedSection({
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
}: UncategorizedSectionProps) {
  const [open, setOpen] = useState(true)

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
