import { ScrollArea } from "@/components/ui/scroll-area"

export function ChangelogPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Changelog</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Version history and recent updates.
        </p>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">

          {/* Version 0.3.2 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.3.2</h2>
              <span className="text-xs text-muted-foreground">Current</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Follows Fusion's UI theme</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>The palette now matches Fusion's theme: Light Gray, Dark Blue, and the hidden Dark Gray</li>
              <li>Colors are read from Fusion's own theme files, so a docked palette matches the panels beside it</li>
              <li>Fixed: Dark Gray rendered as Dark Blue</li>
              <li>Fixed: a grey box below the scrollbar thumb in every theme</li>
            </ul>
          </div>

          {/* Version 0.3.1 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.3.1</h2>
              <span className="text-xs text-muted-foreground">2026-03-08</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Expanded parameter limits for more instrument types</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>FretCount minimum reduced to 4 (supports ukuleles, mandolins, travel guitars)</li>
              <li>StringCount expanded to 1–18 (ukulele, bass, extended-range, harp guitars)</li>
              <li>Scale length range expanded: 10–45 in (ukulele through long-scale bass)</li>
              <li>String gauge maximum doubled to 0.2 in for heavy bass strings</li>
              <li>Nut, saddle, neck, headstock, and body dimensions expanded throughout</li>
            </ul>
          </div>

          {/* Version 0.3.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.3.0</h2>
              <span className="text-xs text-muted-foreground">2026-03-07</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Options drawer, toggles, and user preferences</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Customization Options drawer: toggle Fret Slot Cuts, Nut Slot, Fret Markers, and Heel Curve Fillet</li>
              <li>Zero Fret, Blind Frets, and Heel Curve action buttons</li>
              <li>Fret marker style switch: Circles or Offset hole positions</li>
              <li>Radius mode redesigned as three independent buttons: Compound, Straight, Flat</li>
              <li>Draggable group reordering in the Parameters page</li>
              <li>Persistent user preferences synced between Python backend and UI</li>
              <li>Beta disclaimer "Don't show again" checkbox, version-aware</li>
              <li>CSV template import infrastructure (Coming Soon)</li>
            </ul>
          </div>

          {/* Version 0.2.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.2.0</h2>
              <span className="text-xs text-muted-foreground">2026-02-17</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Units, validation, and custom categories</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Unified imperial/metric unit system with schema-stored dual values</li>
              <li>Input validation with min/max limits enforced in UI and backend</li>
              <li>Custom parameter categories: create, delete, and assign user-defined groups</li>
              <li>Auto-apply new parameters immediately on creation</li>
              <li>Batched undo/redo treats entire edits as single actions</li>
              <li>History popover on undo/redo buttons showing past/future changes</li>
              <li>Unit indicator badge and fretboard detection indicator</li>
              <li>Unified preset files with dual imperial/metric values</li>
              <li>Smart template loading with unit-correct value selection</li>
              <li>Added a Share page to easily share designs with others via a text string</li>
            </ul>
          </div>

          {/* Version 0.1.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.1.0</h2>
              <span className="text-xs text-muted-foreground">2026-02-13</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Initial release</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Parameter configuration interface with grouped controls</li>
              <li>Apply parameters directly to a live Autodesk Fusion design</li>
              <li>Undo/redo support and parameter search</li>
              <li>Reports page with detailed fretboard specifications</li>
              <li>Templates system for saving and loading user presets</li>
              <li>Timeline panel to view and toggle feature suppression in Fusion</li>
              <li>Fingerprint system to identify designs created by this add-in</li>
              <li>Responsive sidebar navigation</li>
              <li>Community and Support pages</li>
            </ul>
          </div>

        </div>
      </ScrollArea>
    </div>
  )
}
