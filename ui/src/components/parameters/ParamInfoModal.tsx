import React, { useState } from "react"
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
import { ComboboxSelect } from "@/components/ui/combobox"
import { sendToPython } from "@/lib/fusion-bridge"
import { isMetricUnit } from "@/lib/units"
import { useIsMobile } from "@/hooks/use-mobile"
import type { ParamInfoModalProps, GroupSchemaRef } from "./types"

// ── Category combobox ─────────────────────────────────────────────

export function CategoryCombobox({
  value,
  onChange,
  options,
  onAddCategory: _onAddCategory,
  onRemoveCategory: _onRemoveCategory,
  disabled,
}: {
  value: string
  onChange: (val: string) => void
  options: GroupSchemaRef[]
  onAddCategory?: (id: string, label: string) => void
  onRemoveCategory?: (id: string) => void
  disabled?: boolean
}) {
  const filteredOptions = options.filter(
    (opt) => opt.label !== "Uncategorized" && opt.label !== "Metadata"
  )

  return (
    <ComboboxSelect
      value={value}
      onValueChange={onChange}
      options={filteredOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
      placeholder="Select category..."
      searchPlaceholder="Search categories..."
      emptyText="No category found."
      disabled={disabled}
    />
  )
}

// ── Shared modal shell ────────────────────────────────────────────

export function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

export function ParamInfoModal({
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
}: ParamInfoModalProps) {
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
          const isMetric = isMetricUnit(documentUnit) && param.unitKind === 'length'
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

      {/* Delete confirmation */}
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
