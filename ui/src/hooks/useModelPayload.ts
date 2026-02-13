import { useEffect, useState } from "react"
import { onMessageFromPython, sendToPython, signalReady } from "@/lib/fusion-bridge"
import type { ModelPayload, TemplateListPayload } from "@/types"

export function useModelPayload() {
  const [payload, setPayload] = useState<ModelPayload | null>(null)
  const [connected, setConnected] = useState(false)
  const [templateList, setTemplateList] = useState<TemplateListPayload | null>(null)

  useEffect(() => {
    onMessageFromPython((action, dataJson) => {
      if (action === "PUSH_MODEL_STATE") {
        try {
          const data: ModelPayload = JSON.parse(dataJson)
          setPayload(data)
          setConnected(true)
        } catch {
          // Silently ignore malformed payloads
        }
      } else if (action === "PUSH_TEMPLATES") {
        try {
          const data: TemplateListPayload = JSON.parse(dataJson)
          setTemplateList(data)
        } catch {
          // Silently ignore malformed payloads
        }
      }
    })
    signalReady()
  }, [])

  function refreshPayload() {
    sendToPython("GET_MODEL_STATE")
  }

  return { payload, connected, refreshPayload, templateList }
}
