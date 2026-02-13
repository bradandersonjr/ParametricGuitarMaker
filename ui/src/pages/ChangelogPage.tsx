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

          {/* Version 0.5.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.5.0</h2>
              <span className="text-xs text-muted-foreground">Current</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Timeline panel and fingerprint system</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Added Timeline panel to view and toggle feature suppression in Fusion</li>
              <li>Batch suppress/unsuppress timeline items with a single Submit action</li>
              <li>Implemented fingerprint system to identify designs created by this add-in</li>
              <li>Reset to template defaults for existing designs using smart fingerprint detection</li>
              <li>Fingerprint stored as a hidden Fusion parameter for reliable tracking</li>
            </ul>
          </div>

          {/* Version 0.4.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.4.0</h2>
              <span className="text-xs text-muted-foreground">Released</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Responsive sidebar and project rename</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Responsive sidebar collapses to icon-only mode below 680px width</li>
              <li>Project renamed to "Parametric Guitar: Fretboard Maker"</li>
              <li>Improved mobile UX with collapsible sidebar navigation</li>
              <li>Community page added with Discord, YouTube, and Facebook group links</li>
              <li>Support page added with Ko-fi and GitHub sponsorship</li>
              <li>Fixed Reports page unit conversion (was showing 2.54× values)</li>
              <li>Neutral Fret now displays as whole number in Reports</li>
              <li>Removed redundant Connected status from Parameters header</li>
              <li>Improved sidebar icon mode centering for connection indicator</li>
            </ul>
          </div>

          {/* Version 0.3.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.3.0</h2>
              <span className="text-xs text-muted-foreground">Released</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Templates system and save/load support</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Templates page for loading built-in presets and user-created templates</li>
              <li>Save current parameters as a named custom template</li>
              <li>Delete user templates with confirmation</li>
              <li>Open templates folder in Explorer/Finder</li>
              <li>Template cards display key specs (frets, strings, scale lengths)</li>
              <li>Type safety improvements and codebase cleanup throughout</li>
            </ul>
          </div>

          {/* Version 0.2.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.2.0</h2>
              <span className="text-xs text-muted-foreground">Released</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Reports page and multi-scale support</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Reports page with detailed fretboard specifications</li>
              <li>Multi-scale fretboard calculations (separate bass/treble scale lengths)</li>
              <li>Fret position and spacing tables</li>
              <li>String layout details and guitar dimension summaries</li>
              <li>Adjustable precision (3–9 decimal places) in Reports</li>
            </ul>
          </div>

          {/* Version 0.1.0 */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold font-heading">v0.1.0</h2>
              <span className="text-xs text-muted-foreground">Initial Release</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Foundation and core features</p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc list-inside">
              <li>Parameter configuration interface with grouped controls</li>
              <li>Apply parameters directly to a live Fusion 360 design</li>
              <li>Undo/redo support and parameter search</li>
              <li>About, Help, and Changelog pages</li>
            </ul>
          </div>

        </div>
      </ScrollArea>
    </div>
  )
}
