import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { filterNumericInput } from "./helpers"
import { ParamInfoModal } from "./ParamInfoModal"
import type { SchemaParamRowProps } from "./types"

export function SchemaParamRow({
  param,
  displayValue,
  displayUnit,
  modified,
  hasError,
  errorMessage,
  scaleMode,
  radiusMode,
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
}: SchemaParamRowProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const label =
    scaleMode === "single" && param.name === "ScaleLengthBass"
      ? "Scale Length"
      : radiusMode === "straight" && param.name === "NutRadius"
        ? "Fretboard Radius"
        : param.label

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="px-2 py-2 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer group/row"
            onClick={() => setModalOpen(true)}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (!editStartValues.hasOwnProperty(param.name)) {
                        onFocus(param.name)
                      }
                      const val = parseInt(displayValue ?? "0")
                      const newVal = Math.max(parseInt(param.min?.toString() ?? "0"), val - 1).toString()
                      onChange(param.name, newVal)
                      setTimeout(() => onBlur(param.name, newVal), 0)
                    }}
                    className="p-0.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Minus size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Decrease</TooltipContent>
              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (!editStartValues.hasOwnProperty(param.name)) {
                        onFocus(param.name)
                      }
                      const val = parseInt(displayValue ?? "0")
                      const newVal = Math.min(parseInt(param.max?.toString() ?? "999"), val + 1).toString()
                      onChange(param.name, newVal)
                      setTimeout(() => onBlur(param.name, newVal), 0)
                    }}
                    className="p-0.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Increase</TooltipContent>
              </Tooltip>
            ) : (
              <span className="w-[19px] shrink-0 text-xs text-muted-foreground text-center">
                {displayUnit}
              </span>
            )}
          </div>
        </div>
        {hasError && <div className="text-xs text-red-500 px-2 mt-1">{errorMessage}</div>}
          </div>
        </TooltipTrigger>
        <TooltipContent>Click to edit</TooltipContent>
      </Tooltip>
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
