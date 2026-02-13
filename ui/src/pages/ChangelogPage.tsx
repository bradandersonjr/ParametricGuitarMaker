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

          {/* Version 0.1.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.1.0</h2>
              <span className="text-xs text-muted-foreground">Current</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Initial release</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Parameter configuration interface with grouped controls</li>
              <li>Apply parameters directly to a live Fusion 360 design</li>
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
