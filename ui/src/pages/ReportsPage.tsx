import { useState, useMemo, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { buildGuitarReport } from "@/lib/guitar-math"
import type { ModelPayload } from "@/types"
import { ChevronDown, ChevronRight, Ruler, Music, Guitar, Triangle } from "lucide-react"

// ── Collapsible section ────────────────────────────────────────────

function ReportSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: typeof Ruler
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted-foreground">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <Icon size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold font-heading">{title}</span>
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  )
}

// ── Value row ──────────────────────────────────────────────────────

function ValRow({ label, value, unit = "in", precision = 4 }: { label: string; value: number | null; unit?: string; precision?: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs tabular-nums font-medium">
        {value != null ? `${value.toFixed(precision)} ${unit}` : "—"}
      </span>
    </div>
  )
}

// ── Precision Slider ────────────────────────────────────────────────

function PrecisionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 rounded-md">
      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Precision:
      </label>
      <input
        type="range"
        min="3"
        max="9"
        step="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 h-1.5 bg-muted rounded-full accent-primary cursor-pointer"
      />
      <span className="text-xs font-medium tabular-nums w-6 text-right">{value}</span>
    </div>
  )
}

// ── Reports page ───────────────────────────────────────────────────

export function ReportsPage({ payload }: { payload: ModelPayload | null }) {
  const [precision, setPrecisionState] = useState(() => {
    const stored = localStorage.getItem("reportsPrecision")
    return stored ? parseInt(stored) : 4
  })
  const report = useMemo(() => (payload ? buildGuitarReport(payload) : null), [payload])

  const setPrecision = (value: number) => {
    setPrecisionState(value)
    localStorage.setItem("reportsPrecision", value.toString())
  }

  useEffect(() => {
    const stored = localStorage.getItem("reportsPrecision")
    if (stored) {
      setPrecisionState(parseInt(stored))
    }
  }, [])

  if (!report) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading report data...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Reports</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Computed specifications from your guitar parameters.
        </p>
        <div className="mt-3">
          <PrecisionSlider value={precision} onChange={setPrecision} />
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">

          {/* Scale Length & Multi-Scale */}
          <ReportSection title="Scale Length" icon={Ruler}>
            <div className="space-y-1">
              <ValRow label="Bass side" value={report.scaleLengthBass} precision={precision} />
              <ValRow label="Treble side" value={report.scaleLengthTreble} precision={precision} />
              {report.isMultiScale && (
                <>
                  <div className="border-t border-border/50 my-1.5" />
                  <ValRow label="Scale difference" value={report.scaleDifference} precision={precision} />
                  <ValRow label="Neutral fret" value={report.neutralFret} unit="" precision={0} />
                  <ValRow label="Fretboard length (bass)" value={report.fretboardLengthBass} precision={precision} />
                  <ValRow label="Fretboard length (treble)" value={report.fretboardLengthTreble} precision={precision} />
                </>
              )}
              {!report.isMultiScale && (
                <>
                  <div className="border-t border-border/50 my-1.5" />
                  <ValRow label="Fretboard length" value={report.fretboardLengthBass} precision={precision} />
                  <div className="text-xs text-muted-foreground/70 italic mt-1">
                    Single-scale (straight frets)
                  </div>
                </>
              )}
            </div>
          </ReportSection>

          {/* Fret Position Table */}
          <ReportSection title={`Fret Positions (${report.fretCount} frets)`} icon={Music}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pr-2 text-left text-muted-foreground font-medium">Fret</th>
                    {report.isMultiScale ? (
                      <>
                        <th className="py-1 px-2 text-right text-muted-foreground font-medium">Dist (B)</th>
                        <th className="py-1 px-2 text-right text-muted-foreground font-medium">Dist (T)</th>
                        <th className="py-1 px-2 text-right text-muted-foreground font-medium">Spc (B)</th>
                        <th className="py-1 pl-2 text-right text-muted-foreground font-medium">Spc (T)</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1 px-2 text-right text-muted-foreground font-medium">Distance</th>
                        <th className="py-1 pl-2 text-right text-muted-foreground font-medium">Spacing</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.fretPositions.map((fp) => (
                    <tr
                      key={fp.fret}
                      className={[
                        "border-b border-border/30",
                        fp.fret === 12 ? "bg-primary/5 font-medium" : "",
                      ].join(" ")}
                    >
                      <td className="py-0.5 pr-2 tabular-nums">{fp.fret}</td>
                      {report.isMultiScale ? (
                        <>
                          <td className="py-0.5 px-2 text-right tabular-nums">{fp.distanceBass.toFixed(precision)}</td>
                          <td className="py-0.5 px-2 text-right tabular-nums">{fp.distanceTreble.toFixed(precision)}</td>
                          <td className="py-0.5 px-2 text-right tabular-nums text-muted-foreground">{fp.spacingBass.toFixed(precision)}</td>
                          <td className="py-0.5 pl-2 text-right tabular-nums text-muted-foreground">{fp.spacingTreble.toFixed(precision)}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-0.5 px-2 text-right tabular-nums">{fp.distanceBass.toFixed(precision)}</td>
                          <td className="py-0.5 pl-2 text-right tabular-nums text-muted-foreground">{fp.spacingBass.toFixed(precision)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          {/* String Layout */}
          <ReportSection title={`String Layout (${report.stringCount} strings)`} icon={Guitar}>
            <div className="space-y-1">
              {report.strings
                .filter((s) => s.gauge > 0)
                .map((s) => (
                  <div key={s.number} className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-muted-foreground">String {s.number}</span>
                    <span className="text-xs tabular-nums font-medium">{s.gauge.toFixed(precision)} in</span>
                  </div>
                ))}
              <div className="border-t border-border/50 my-1.5" />
              <ValRow label="String action" value={report.stringAction} precision={precision} />
              <ValRow label="Nut slot spacing" value={report.nutSlotSpacing} precision={precision} />
              <ValRow label="Nut spacing (total)" value={report.nutSpacing} precision={precision} />
            </div>
          </ReportSection>

          {/* Dimensions */}
          <ReportSection title="Dimensions" icon={Triangle} defaultOpen={false}>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground mt-1 mb-0.5">Overall</div>
              <ValRow label="Length" value={report.guitarLength} precision={precision} />
              <ValRow label="Width" value={report.guitarWidth} precision={precision} />
              <ValRow label="Thickness" value={report.guitarThickness} precision={precision} />

              <div className="border-t border-border/50 my-1.5" />
              <div className="text-xs font-semibold text-muted-foreground mb-0.5">Body</div>
              <ValRow label="Length" value={report.bodyLength} precision={precision} />
              <ValRow label="Width" value={report.bodyWidth} precision={precision} />
              <ValRow label="Thickness" value={report.bodyThickness} precision={precision} />

              <div className="border-t border-border/50 my-1.5" />
              <div className="text-xs font-semibold text-muted-foreground mb-0.5">Neck</div>
              <ValRow label="Thickness @ 1st fret" value={report.neckThickness1st} precision={precision} />
              <ValRow label="Thickness @ 12th fret" value={report.neckThickness12th} precision={precision} />
              <ValRow label="Width @ 1st fret" value={report.neckWidth1st} precision={precision} />
              <ValRow label="Width @ 12th fret" value={report.neckWidth12th} precision={precision} />

              <div className="border-t border-border/50 my-1.5" />
              <div className="text-xs font-semibold text-muted-foreground mb-0.5">Headstock</div>
              <ValRow label="Length" value={report.headstockLength} precision={precision} />
              <ValRow label="Width" value={report.headstockWidth} precision={precision} />
              <ValRow label="Thickness" value={report.headstockThickness} precision={precision} />
            </div>
          </ReportSection>

        </div>
      </ScrollArea>
    </div>
  )
}
