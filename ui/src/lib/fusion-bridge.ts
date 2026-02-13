/**
 * Fusion Palette ↔ React bridge.
 *
 * In production the global `adsk.fusionSendData(action, json)` is injected by
 * Fusion's Chromium host.  In dev (browser) we stub it to console so the app
 * doesn't crash.
 *
 * Communication contract (must match entry.py):
 *   JS → Python actions : "ready" | "GET_MODEL_STATE" | "APPLY_PARAMS" | "cancel"
 *   Python → JS actions : "PUSH_MODEL_STATE" | "response" (internal ack, ignored)
 */

import schemaJson from "../../../schema/parameters.schema.json"

// ── Types ──────────────────────────────────────────────────────────

declare global {
  interface Window {
    adsk?: { fusionSendData: (action: string, data: string) => void }
    fusionJavaScriptHandler?: { handle: (action: string, data: string) => string }
  }
}

export type IncomingAction = "PUSH_MODEL_STATE" | "PUSH_TEMPLATES" | "COMPUTING" | "response" | "PUSH_TIMELINE_ITEMS" | "PUSH_TIMELINE_SUMMARY" | "TIMELINE_OPERATION_RESULT"
export type OutgoingAction = "ready" | "GET_MODEL_STATE" | "APPLY_PARAMS" | "cancel" | "OPEN_URL" | "GET_TEMPLATES" | "LOAD_TEMPLATE" | "SAVE_TEMPLATE" | "DELETE_TEMPLATE" | "OPEN_TEMPLATES_FOLDER" | "GET_TIMELINE_ITEMS" | "GET_TIMELINE_SUMMARY" | "APPLY_TIMELINE_CHANGES"

type MessageHandler = (action: string, dataJson: string) => void

// ── State ──────────────────────────────────────────────────────────

let handler: MessageHandler | null = null

// Secondary handlers (e.g. TimelinePanel) that receive all Python messages
const secondaryHandlers = new Set<MessageHandler>()

/** Register an additional handler for messages from Python. Returns an unsubscribe function. */
export function addMessageHandler(cb: MessageHandler): () => void {
  secondaryHandlers.add(cb)
  return () => secondaryHandlers.delete(cb)
}
const _isFusion = () => typeof window.adsk !== "undefined" && !!window.adsk.fusionSendData
const _isDev = () => window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"

/** True when running inside Fusion OR in a local dev server. */
export const isFusion = () => _isFusion() || _isDev()

// ── Public API ─────────────────────────────────────────────────────

/** Send a message to Python (or log in dev). */
export function sendToPython(action: OutgoingAction, data: Record<string, unknown> = {}) {
  const json = JSON.stringify(data)
  if (_isFusion()) {
    window.adsk!.fusionSendData(action, json)
  } else {
    // Dev mode: simulate Python responses for template actions
    if (action === "GET_TEMPLATES") {
      setTimeout(() => {
        if (handler) handler("PUSH_TEMPLATES", JSON.stringify(buildDevTemplatePayload()))
      }, 100)
    } else if (action === "LOAD_TEMPLATE") {
      setTimeout(() => {
        if (handler) handler("PUSH_MODEL_STATE", JSON.stringify({ ...buildDevPayload(), mode: "template" }))
      }, 200)
    }
  }
}

/** Open a URL using the system default browser (or new tab in dev). */
export function openUrl(url: string) {
  if (_isFusion()) {
    sendToPython("OPEN_URL", { url })
  } else {
    window.open(url, "_blank")
  }
}

/**
 * Register a callback for messages arriving from Python.
 * Call once at app startup — it wires up `window.fusionJavaScriptHandler`.
 */
export function onMessageFromPython(cb: MessageHandler) {
  handler = cb

  window.fusionJavaScriptHandler = {
    handle(action: string, dataJson: string): string {
      // Ignore Fusion's internal acknowledgment
      if (action === "response") return ""

      if (handler) handler(action, dataJson)
      secondaryHandlers.forEach(h => h(action, dataJson))
      return "" // Fusion expects a return value
    },
  }
}

// ── Dev mock payload (built from schema) ───────────────────────────

const UNIT_FOR_KIND: Record<string, string> = {
  length: "in",
  angle: "deg",
  unitless: "",
}

interface SchemaParam {
  name: string
  label?: string
  unitKind?: string
  controlType?: string
  default?: string
  min?: number
  max?: number
  step?: number
  description?: string
  editable?: boolean
}

interface SchemaGroup {
  id: string
  label: string
  order?: number
  parameters: SchemaParam[]
}

interface Schema {
  schemaVersion?: string
  templateVersion?: string
  groups: SchemaGroup[]
}

function buildDevPayload() {
  const schema = schemaJson as Schema
  const groups = schema.groups
    .map((group) => {
      const parameters = group.parameters
        .filter((p) => p.editable !== false)
        .map((p) => {
          const unit = UNIT_FOR_KIND[p.unitKind ?? "length"] ?? ""
          const defaultStr = p.default ?? ""
          // Strip unit suffix from default (e.g. "25.5 in" → "25.5") for numeric value
          const numericStr = defaultStr.replace(/\s*(in|deg|mm|cm)\s*$/, "").trim()
          const value = numericStr !== "" ? parseFloat(numericStr) : null
          return {
            name: p.name,
            label: p.label ?? p.name,
            unitKind: p.unitKind ?? "length",
            controlType: p.controlType ?? "number",
            default: defaultStr,
            min: p.min,
            max: p.max,
            step: p.step,
            description: p.description ?? "",
            expression: defaultStr,
            value,
            unit,
          }
        })
      return { id: group.id, label: group.label, order: group.order ?? 0, parameters }
    })
    .filter((g) => g.parameters.length > 0)
    .sort((a, b) => a.order - b.order)

  return {
    schemaVersion: schema.schemaVersion ?? "unknown",
    templateVersion: schema.templateVersion ?? "unknown",
    groups,
    missing: [],
    extra: [],
    mode: "initial" as const,
    documentUnit: "in",
  }
}

function buildDevTemplatePayload() {
  return {
    presets: [
      {
        id: "standard_guitar",
        name: "Standard 6-String Guitar",
        description: "Classic 25.5\" single-scale, 22-fret electric guitar",
        createdAt: "2026-02-12",
        schemaVersion: "0.3.0",
        readonly: true,
        parameters: { FretCount: "22", StringCount: "6", ScaleLengthBass: "25.50", ScaleLengthTreb: "25.50" },
      },
      {
        id: "bass_guitar",
        name: "Standard 4-String Bass",
        description: "34\" long-scale 4-string bass guitar, 21 frets",
        createdAt: "2026-02-12",
        schemaVersion: "0.3.0",
        readonly: true,
        parameters: { FretCount: "21", StringCount: "4", ScaleLengthBass: "34.00", ScaleLengthTreb: "34.00" },
      },
      {
        id: "multiscale_7string",
        name: "Multiscale 7-String",
        description: "Fan-fret 7-string: 27\" bass / 25.5\" treble, 24 frets, neutral fret 7",
        createdAt: "2026-02-12",
        schemaVersion: "0.3.0",
        readonly: true,
        parameters: { FretCount: "24", StringCount: "7", ScaleLengthBass: "27.00", ScaleLengthTreb: "25.50", NeutralFret: "7" },
      },
    ],
    userTemplates: [],
  }
}

/**
 * Signal to Python that the UI is ready to receive data.
 * In dev mode, synthesizes a mock payload from the schema file.
 */
export function signalReady() {
  if (_isFusion()) {
    sendToPython("ready")
  } else {
    setTimeout(() => {
      if (handler) {
        handler("PUSH_MODEL_STATE", JSON.stringify(buildDevPayload()))
      }
    }, 500)
  }
}
