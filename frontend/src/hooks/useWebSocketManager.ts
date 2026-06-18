import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ReadyState } from "react-use-websocket/dist/lib/constants"
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket"

import { gatewayMessageSchema } from "../models/events/GatewayEvent"
import {
  buildSocketUrl,
  getLastSocketEventId,
  getOrCreateSocketSessionId
} from "@/services/socketSession"
import { useSessionStore } from "@/stores/useSessionStore"
import {
  persistGatewayCursor,
  routeServerMessage,
  shouldApplyGatewayMessage
} from "./websocketMessageHandlers"

const WS_URL = import.meta.env.VITE_WS_URL
const PING_INTERVAL_MS = 60_000

export function useWebSocketManager() {
  const { t } = useTranslation()
  const { getIdToken, logout } = useSessionStore()
  const token = getIdToken()
  const isFatal = useRef(false)
  const socketSessionId = useRef<string | null>(null)
  const processingQueue = useRef(Promise.resolve())

  if (token && socketSessionId.current === null) {
    socketSessionId.current = getOrCreateSocketSessionId()
  }

  if (!token) {
    socketSessionId.current = null
  }

  const socketUrl =
    token && socketSessionId.current
      ? buildSocketUrl(
          WS_URL,
          token,
          socketSessionId.current,
          getLastSocketEventId()
        )
      : null

  const { lastJsonMessage, readyState, sendJsonMessage } = useWebSocket(
    socketUrl,
    {
      share: true,
      shouldReconnect: () => !isFatal.current && !!token,
      reconnectAttempts: 1000,
      reconnectInterval: 3000,
      onOpen: () => {
        console.log("[WS] Connected")
        isFatal.current = false
      },
      onClose: (event) => {
        if (isFatal.current || !token) {
          return
        }

        console.warn(
          `[WS] Closed. Code: ${event.code}. Reason: ${event.reason || "unspecified"}`
        )
      },
      onError: (event) => console.error("[WS] Error:", event)
    }
  )

  useEffect(() => {
    if (!lastJsonMessage) {
      return
    }

    const parsedMessage = gatewayMessageSchema.safeParse(lastJsonMessage)
    if (!parsedMessage.success) {
      console.error("[WS] Invalid message received:", parsedMessage.error)
      return
    }

    processingQueue.current = processingQueue.current
      .then(async () => {
        if (!shouldApplyGatewayMessage(parsedMessage.data)) {
          return
        }

        await routeServerMessage(parsedMessage.data, isFatal, logout, t)
        persistGatewayCursor(parsedMessage.data)
      })
      .catch((error) => {
        console.error("[WS] Failed to process message:", error)
      })
  }, [lastJsonMessage, logout, t])

  useEffect(() => {
    if (!token) {
      return
    }

    const ping = () => {
      if (document.visibilityState !== "visible" || readyState !== ReadyState.OPEN) {
        return
      }

      sendJsonMessage({ type: "ping" }, false)
    }

    ping()

    const pingInterval = window.setInterval(ping, PING_INTERVAL_MS)
    const handleVisibilityChange = () => ping()

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(pingInterval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [readyState, sendJsonMessage, token])

  return { readyState }
}
