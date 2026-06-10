import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MainPage } from "./MainPage"
import { userService } from "@/services/userService"
import { useNoteStore } from "@/stores/useNotesStore"

const navigateMock = vi.fn()

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock
}))

vi.mock("@/router/indexRouteApi", () => ({
  indexRouteApi: {
    useSearch: () => ({ id: undefined })
  }
}))

vi.mock("react-resizable-panels", () => ({
  Group: ({ children }: { children: ReactNode }) => (
    <div data-testid="workspace-group">{children}</div>
  ),
  Panel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Separator: () => <div data-testid="resize-handle" />,
  useDefaultLayout: () => ({
    defaultLayout: undefined,
    onLayoutChanged: vi.fn()
  })
}))

vi.mock("@/components/sidebar/Sidebar", () => ({
  Sidebar: ({
    isUserManagementOpen,
    onToggleUserManagement
  }: {
    isUserManagementOpen: boolean
    onToggleUserManagement: () => void
  }) => (
    <button
      type="button"
      aria-pressed={isUserManagementOpen}
      onClick={onToggleUserManagement}
    >
      Toggle users
    </button>
  )
}))

vi.mock("@/components/board/EmptyDisplay", () => ({
  EmptyDisplay: () => <div>Empty board</div>
}))

vi.mock("@/components/board/ContentBoard", () => ({
  ContentBoard: () => <div>Content board</div>
}))

vi.mock("@/components/LoaderContainer", () => ({
  LoaderContainer: () => <div>Loading</div>
}))

vi.mock("@/hooks/useWebSocketManager", () => ({
  useWebSocketManager: vi.fn()
}))

vi.mock("@/utils/createAsyncComponent", () => ({
  createAsyncComponent: () =>
    function AsyncUserManagementPanel() {
      return <div data-testid="user-management-panel-content">Users panel</div>
    }
}))

vi.mock("@/services/userService", () => ({
  userService: {
    getSelfUser: vi.fn()
  }
}))

vi.mock("@/utils/toastUtils", () => ({
  toasts: {
    apiError: vi.fn(),
    error: vi.fn()
  }
}))

describe("MainPage", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.mocked(userService.getSelfUser).mockResolvedValue({
      success: true,
      statusCode: 200,
      data: {
        id: "7",
        username: "Leonardo",
        permissions: 0,
        presence: "ONLINE",
        isVerified: true,
        suspended: false,
        createdAt: "2026-04-21T10:00:00.000Z",
        updatedAt: "2026-04-21T10:00:00.000Z"
      }
    })
    useNoteStore.setState({
      shownNote: null,
      isFetchingNote: false,
      isRendering: false
    })
  })

  it("mounts the lazy user management panel only after the rail toggle opens it", () => {
    render(<MainPage />)

    expect(
      screen.queryByTestId("user-management-panel-content")
    ).not.toBeInTheDocument()
    expect(document.getElementById("user-management-panel")).toBeNull()

    const toggle = screen.getByRole("button", { name: "Toggle users" })
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-pressed", "true")
    expect(document.getElementById("user-management-panel")).not.toBeNull()
    expect(screen.getByTestId("user-management-panel-content")).toBeInTheDocument()
  })

  it("keeps the user management panel mounted while the close animation runs", () => {
    vi.useFakeTimers()

    render(<MainPage />)

    const toggle = screen.getByRole("button", { name: "Toggle users" })
    fireEvent.click(toggle)
    fireEvent.click(toggle)

    const closingPanel = document.getElementById("user-management-panel")
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    expect(closingPanel).toHaveAttribute("data-state", "closing")
    expect(closingPanel).toHaveAttribute("aria-hidden", "true")

    act(() => {
      vi.advanceTimersByTime(240)
    })

    expect(document.getElementById("user-management-panel")).toBeNull()
  })
})
