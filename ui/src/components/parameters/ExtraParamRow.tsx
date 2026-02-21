import { useState } from "react"
import { Pen } from "lucide-react"
import { filterNumericInput } from "./helpers"
import { ParamInfoModal } from "./ParamInfoModal"
import type { ExtraParamRowProps } from "./types"

export function ExtraParamRow({
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
}: ExtraParamRowProps) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div
        className="py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50/20 dark:bg-purple-950/10 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors group/row flex items-center"
      >
        <button
          onClick={() => setEditOpen(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100 transition-all px-2"
          title="Edit parameter"
        >
          <Pen size={14} />
        </button>
        <div
          className="flex-1 cursor-pointer pr-2"
          onClick={() => setEditOpen(true)}
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
