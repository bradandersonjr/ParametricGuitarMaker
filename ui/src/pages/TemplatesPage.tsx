import { useState, useEffect, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sendToPython } from "@/lib/fusion-bridge"
import type { GuitarTemplate, TemplateListPayload, ModelPayload } from "@/types"
import { BookMarked, Trash2, Download, Save, Lock, ChevronDown, ChevronRight, FolderOpen } from "lucide-react"

interface TemplatesPageProps {
  payload: ModelPayload | null
  templateList: TemplateListPayload | null
  onTemplateLoaded: () => void
}

function getDisplayParams(params: Record<string, string>) {
  const keys = ["FretCount", "StringCount", "ScaleLengthBass", "ScaleLengthTreb", "NeutralFret"]
  const labels: Record<string, string> = {
    FretCount: "Frets",
    StringCount: "Strings",
    ScaleLengthBass: "Bass scale",
    ScaleLengthTreb: "Treble scale",
    NeutralFret: "Neutral fret",
  }
  return keys
    .filter((k) => params[k] !== undefined)
    .map((k) => `${labels[k]}: ${params[k]}`)
}

function TemplateCard({
  template,
  onLoad,
  onDelete,
}: {
  template: GuitarTemplate
  onLoad: (t: GuitarTemplate) => void
  onDelete?: (t: GuitarTemplate) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const hints = getDisplayParams(template.parameters)

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {template.readonly && (
              <Lock className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs font-semibold truncate">{template.name}</span>
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {template.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!template.readonly && onDelete && (
            confirming ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 text-xs px-2"
                  onClick={() => { onDelete(template); setConfirming(false) }}
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => setConfirming(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirming(true)}
                title="Delete template"
              >
                <Trash2 className="size-3" />
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 hover:bg-muted"
            onClick={() => onLoad(template)}
          >
            <Download className="size-3 mr-1" />
            Load
          </Button>
        </div>
      </div>
      {hints.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hints.map((hint) => (
            <span
              key={hint}
              className="inline-block text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5"
            >
              {hint}
            </span>
          ))}
        </div>
      )}
      {template.createdAt && (
        <p className="text-[10px] text-muted-foreground">{template.createdAt}</p>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section>
      <button
        className="flex items-center gap-1 w-full text-left mb-2"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
        <h2 className="text-xs font-semibold font-heading">{title}</h2>
        <span className="text-xs text-muted-foreground ml-1">({count})</span>
      </button>
      {open && children}
    </section>
  )
}

export function TemplatesPage({ payload, templateList, onTemplateLoaded }: TemplatesPageProps) {
  const presets = templateList?.presets ?? []
  const userTemplates = templateList?.userTemplates ?? []
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveDesc, setSaveDesc] = useState("")
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [waitingForLoad, setWaitingForLoad] = useState(false)

  // Request template list on mount
  useEffect(() => {
    sendToPython("GET_TEMPLATES")
  }, [])

  // Navigate to Parameters once the payload updates after a load request
  useEffect(() => {
    if (waitingForLoad && payload) {
      setWaitingForLoad(false)
      onTemplateLoaded()
    }
  }, [payload, waitingForLoad, onTemplateLoaded])

  const handleLoad = useCallback(
    (template: GuitarTemplate) => {
      setLoadedId(template.id)
      setWaitingForLoad(true)
      sendToPython("LOAD_TEMPLATE", { id: template.id, readonly: template.readonly })
    },
    []
  )

  const handleDelete = useCallback((template: GuitarTemplate) => {
    sendToPython("DELETE_TEMPLATE", { id: template.id })
  }, [])

  const handleSave = () => {
    if (!saveName.trim()) return

    // Collect current parameter expressions from payload
    const parameters: Record<string, string> = {}
    if (payload) {
      for (const group of payload.groups) {
        for (const param of group.parameters) {
          if (param.expression !== undefined && param.expression !== null) {
            parameters[param.name] = String(param.expression)
          }
        }
      }
    }

    sendToPython("SAVE_TEMPLATE", {
      name: saveName.trim(),
      description: saveDesc.trim(),
      schemaVersion: payload?.schemaVersion ?? "0.3.0",
      parameters,
    })

    setSaveName("")
    setSaveDesc("")
    setSaving(false)
  }

  const hasPayload = payload && payload.groups.length > 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Templates</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Load a preset or save your current parameters as a template.
        </p>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">

          {/* Save current params */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold font-heading">Save Current Parameters</h2>
              {!saving && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2 hover:bg-muted"
                  disabled={!hasPayload}
                  onClick={() => setSaving(true)}
                >
                  <Save className="size-3 mr-1" />
                  Save as Template
                </Button>
              )}
            </div>

            {saving && (
              <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                <Input
                  placeholder="Template name (required)"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                    if (e.key === "Escape") setSaving(false)
                  }}
                />
                <Input
                  placeholder="Description (optional)"
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                    if (e.key === "Escape") setSaving(false)
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-6 text-xs px-3"
                    disabled={!saveName.trim()}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-3"
                    onClick={() => { setSaving(false); setSaveName(""); setSaveDesc("") }}
                  >
                    Cancel
                  </Button>
                </div>
                {!hasPayload && (
                  <p className="text-[10px] text-muted-foreground">
                    Load parameters from Fusion first to save them.
                  </p>
                )}
              </div>
            )}

            {!saving && !hasPayload && (
              <p className="text-xs text-muted-foreground">
                Open a design in Fusion to enable saving current parameters.
              </p>
            )}
          </section>

          {/* Built-in presets */}
          <CollapsibleSection title="Built-in Presets" count={presets.length}>
            {presets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No presets found.</p>
            ) : (
              <div className="space-y-2">
                {presets.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onLoad={handleLoad}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* User templates */}
          <div className="flex items-center justify-between">
            <span />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 hover:bg-muted"
              onClick={() => sendToPython("OPEN_TEMPLATES_FOLDER")}
              title="Open templates folder in Explorer"
            >
              <FolderOpen className="size-3 mr-1" />
              Open folder
            </Button>
          </div>
          <CollapsibleSection title="My Templates" count={userTemplates.length} defaultOpen={true}>
            {userTemplates.length === 0 ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>No saved templates yet.</p>
                <p>Configure your parameters and click "Save as Template" above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onLoad={handleLoad}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {loadedId && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BookMarked className="size-3" />
              Template loaded — switch to Parameters to review and apply.
            </p>
          )}

        </div>
      </ScrollArea>
    </div>
  )
}
