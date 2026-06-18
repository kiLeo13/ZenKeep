import { renderHook } from "@testing-library/react"
import type { GatewayMessage } from "@/models/events/GatewayEvent"
import type { FullNoteResponseData, NoteResponseData } from "@/types/api/notes"
import type { UserResponseData } from "@/types/api/users"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useWebSocketManager } from "./useWebSocketManager"
import {
  handleNoteEvents,
  shouldApplyGatewayMessage
} from "./websocketMessageHandlers"
import { serverEvents } from "@/models/events/GatewayEvent"
import { noteService } from "@/services/noteService"
import { setLastSocketEventId } from "@/services/socketSession"
import { useNoteStore } from "@/stores/useNotesStore"
import { useSessionStore } from "@/stores/useSessionStore"

const websocketMock = vi.hoisted(() => ({
  useWebSocket: vi.fn()
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

vi.mock("react-use-websocket/dist/lib/use-websocket", () => ({
  useWebSocket: websocketMock.useWebSocket
}))

type MarkdownNote = {
  id: string
  name: string
  tags: string[]
  department_id: string | null
  note_type: "MARKDOWN"
  created_by_id: string
  content_size: number
  created_at: string
  updated_at: string
}

type FullMarkdownNote = MarkdownNote & {
  content: string
}

describe("useWebSocketManager", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    websocketMock.useWebSocket.mockReset()
    websocketMock.useWebSocket.mockReturnValue({
      lastJsonMessage: null,
      readyState: 0,
      sendJsonMessage: vi.fn()
    })
  })

  it("uses the named react-use-websocket hook for authenticated sessions", () => {
    window.localStorage.setItem("id_token", "session-token")
    window.sessionStorage.setItem("zenkeep.ws.session_id", "browser-session")

    renderHook(() => useWebSocketManager())

    expect(websocketMock.useWebSocket).toHaveBeenCalledWith(
      expect.stringContaining("token=session-token"),
      expect.objectContaining({
        share: true,
        reconnectAttempts: 1000,
        reconnectInterval: 3000
      })
    )
  })
})

describe("handleNoteEvents", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    useNoteStore.setState({
      notes: [],
      state: "READY",
      _fetchPromise: null,
      shownNote: null,
      isFetchingNote: false,
      isRendering: false
    })
    useSessionStore.setState({
      user: makeUser(0)
    })
    vi.restoreAllMocks()
  })

  it("refreshes the currently open text note when a newer update arrives", async () => {
    const updatedFullNote = makeFullNote({
      updated_at: "2026-04-21T11:00:00.000Z",
      content: "# refreshed"
    })

    useNoteStore.setState({
      notes: [makeNote()],
      shownNote: makeFullNote()
    })
    vi.spyOn(noteService, "fetchNote").mockResolvedValue({
      success: true,
      statusCode: 200,
      data: updatedFullNote
    })

    await handleNoteEvents(
      makeMessage(
        serverEvents.NoteUpdated.type,
        makeNote({ updated_at: "2026-04-21T11:00:00.000Z" })
      )
    )

    expect(noteService.fetchNote).toHaveBeenCalledWith("42")
    expect(useNoteStore.getState().shownNote?.content).toBe("# refreshed")
  })
})

describe("shouldApplyGatewayMessage", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("ignores replayable events that are not newer than the stored cursor", () => {
    setLastSocketEventId("10")

    expect(
      shouldApplyGatewayMessage(
        makeMessage(serverEvents.NoteDeleted.type, { id: "42" }, "10")
      )
    ).toBe(false)
    expect(
      shouldApplyGatewayMessage(
        makeMessage(serverEvents.NoteDeleted.type, { id: "42" }, "9")
      )
    ).toBe(false)
    expect(
      shouldApplyGatewayMessage(
        makeMessage(serverEvents.NoteDeleted.type, { id: "42" }, "11")
      )
    ).toBe(true)
  })
})

function makeMessage(
  type: GatewayMessage["type"],
  data: GatewayMessage["data"],
  eventId?: string
): GatewayMessage {
  return { type, data, event_id: eventId } as GatewayMessage
}

function makeUser(permissions: number): UserResponseData {
  return {
    id: "7",
    username: "tester",
    permissions,
    presence: "ONLINE",
    isVerified: true,
    suspended: false,
    createdAt: "2026-04-21T10:00:00.000Z",
    updatedAt: "2026-04-21T10:00:00.000Z"
  }
}

function makeNote(
  overrides: Partial<MarkdownNote> = {}
): NoteResponseData {
  const note: MarkdownNote = {
    id: "42",
    name: "Architecture",
    tags: ["docs"],
    department_id: null,
    note_type: "MARKDOWN",
    created_by_id: "7",
    content_size: 128,
    created_at: "2026-04-21T10:00:00.000Z",
    updated_at: "2026-04-21T10:00:00.000Z",
    ...overrides
  }
  return note
}

function makeFullNote(
  overrides: Partial<FullMarkdownNote> = {}
): FullNoteResponseData {
  const note: FullMarkdownNote = {
    id: "42",
    name: "Architecture",
    tags: ["docs"],
    department_id: null,
    note_type: "MARKDOWN",
    created_by_id: "7",
    content_size: 128,
    created_at: "2026-04-21T10:00:00.000Z",
    updated_at: "2026-04-21T10:00:00.000Z",
    content: "# still here",
    ...overrides
  }
  return note
}
