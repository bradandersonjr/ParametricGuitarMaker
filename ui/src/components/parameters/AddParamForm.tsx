import { useState } from "react"
import { ComboboxSelect } from "@/components/ui/combobox"
import { sendToPython } from "@/lib/fusion-bridge"
import type { AddParamFormProps } from "./types"

export function AddParamForm({
  groupId,
  documentUnit,
  allParamNames,
  onCancel,
}: AddParamFormProps) {
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

    const creates = [{
      name,
      expression: buildExpression(value),
      description,
      groupId,
    }]

    sendToPython("APPLY_PARAMS", { updates: {}, creates })

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
        <ComboboxSelect
          value={unitKind}
          onValueChange={(val) => setUnitKind(val as "length" | "angle" | "unitless")}
          options={[
            { value: "length", label: `Length (${documentUnit})` },
            { value: "angle", label: "Angle (deg)" },
            { value: "unitless", label: "Unitless" },
          ]}
          placeholder="Select unit..."
          className="h-7 px-2 text-xs w-32 shrink-0"
          showSearch={false}
        />
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
