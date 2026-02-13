import { ScrollArea } from "@/components/ui/scroll-area"
import { openUrl } from "@/lib/fusion-bridge"

export function HelpPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Help & Support</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get help using Parametric Guitar: Fretboard Maker.
        </p>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">

          {/* Getting Started */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Getting Started</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Parametric Guitar: Fretboard Maker lets you design custom guitar fretboards
                directly in Autodesk Fusion with precise parameter control.
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open the add-in from the Fusion toolbar</li>
                <li>Load a preset from the Templates page, or start from current parameters</li>
                <li>Adjust parameters on the Parameters page</li>
                <li>Click "Apply" to push changes into your Fusion design</li>
                <li>View calculated specs in the Reports page</li>
                <li>Iterate — re-adjust and apply as many times as needed</li>
              </ol>
            </div>
          </section>

          {/* Parameters */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Parameters</h2>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Scale Length</p>
                <p>Distance from nut to bridge. Standard is 25.5" (bass side). Directly affects fret spacing and intonation across the neck.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Fret Count</p>
                <p>Total number of frets. Standard guitars have 20–24 frets; extended-range instruments may have up to 36.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">String Count</p>
                <p>Number of strings. 6-string is standard; 7- and 8-string extend the lower range.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Multi-Scale</p>
                <p>Set independent scale lengths for the bass and treble sides. Improves intonation and ergonomics on extended-range instruments. The Neutral Fret determines where the fret runs perpendicular to the strings.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Search &amp; Undo</p>
                <p>Use the search bar to filter parameters by name. Undo and redo buttons track changes within the current session.</p>
              </div>
            </div>
          </section>

          {/* Templates */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Templates</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                The Templates page lets you save and load full parameter sets as named templates.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium text-foreground">Presets</span> — Built-in read-only templates for common guitar types (e.g. standard 6-string, baritone, multi-scale)</li>
                <li><span className="font-medium text-foreground">User Templates</span> — Save your own parameter sets for reuse across different designs</li>
                <li><span className="font-medium text-foreground">Load</span> — Applying a template overwrites the current parameter values; click Apply on the Parameters page to push them into Fusion</li>
                <li><span className="font-medium text-foreground">Open Folder</span> — Access the templates folder directly to add, edit, or back up template files</li>
              </ul>
            </div>
          </section>

          {/* Reports */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Reports</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                The Reports page shows calculated specs derived from your current parameters:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium text-foreground">Scale Length</span> — Bass and treble scale lengths, effective fretboard span</li>
                <li><span className="font-medium text-foreground">Fret Positions</span> — Distance from nut and spacing for every fret</li>
                <li><span className="font-medium text-foreground">String Layout</span> — String spacing and nut width</li>
                <li><span className="font-medium text-foreground">Dimensions</span> — Overall guitar body, neck, and headstock measurements</li>
              </ul>
              <p>Use the precision slider to control how many decimal places are shown (3–9).</p>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Timeline Panel</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                The Timeline panel (accessible from the Parameters page) lets you control which Fusion features are active in your design.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Click the eye icon next to any feature or group to toggle its suppression state locally</li>
                <li>Click <span className="font-medium text-foreground">Submit</span> to apply all pending changes to Fusion at once</li>
                <li>Suppressed features are excluded from Fusion's model computation, which is useful for isolating parts of the fretboard</li>
                <li>Groups can be expanded to toggle individual features within them</li>
              </ul>
            </div>
          </section>

          {/* Fingerprint & Reset */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Design Reset</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                When you first apply parameters to a Fusion design, the add-in embeds a hidden fingerprint parameter to track that the design was created with this tool.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>On subsequent opens, the fingerprint is detected and the UI loads your saved parameter values automatically</li>
                <li>If the design has no fingerprint (e.g. it was created manually or with an older version), the UI will offer to reset parameters to template defaults</li>
                <li>Resetting does not modify your Fusion model — it only resets the values shown in the UI until you click Apply</li>
              </ul>
            </div>
          </section>

          {/* Troubleshooting */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Troubleshooting</h2>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">"Connecting..." status persists</p>
                <p>Ensure Fusion is running and the add-in is properly installed. Try closing and reopening the palette from the Fusion toolbar.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Parameters won't apply</p>
                <p>Make sure all values are within their specified ranges. On first use, a template must be loaded before applying for the first time.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Unexpected fret spacing</p>
                <p>Verify your scale length is correct. Fret positions use 12-TET (equal temperament) math and require an accurate scale length.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Timeline changes not showing</p>
                <p>Remember to click Submit in the Timeline panel — toggling the eye icon is a local preview only and doesn't update the Fusion model until submitted.</p>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Tips</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Save your current parameters as a user template before experimenting with new values</li>
                <li>Multi-scale designs improve intonation and ergonomics, especially for extended-range guitars</li>
                <li>Use the Reports page to verify fret positions before committing to a build</li>
                <li>Use Timeline suppression to hide construction geometry or isolate features while modeling</li>
              </ul>
            </div>
          </section>

          {/* Resources */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Resources</h2>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => openUrl("https://github.com/bradandersonjr/ParametricGuitarFretboardMaker")}
                className="block w-full text-left px-3 py-2 rounded border border-border hover:bg-muted transition-colors text-primary hover:text-primary/80"
              >
                → View on GitHub
              </button>
              <button
                onClick={() => openUrl("https://github.com/bradandersonjr/ParametricGuitarFretboardMaker/issues")}
                className="block w-full text-left px-3 py-2 rounded border border-border hover:bg-muted transition-colors text-primary hover:text-primary/80"
              >
                → Report an Issue
              </button>
            </div>
          </section>

        </div>
      </ScrollArea>
    </div>
  )
}
