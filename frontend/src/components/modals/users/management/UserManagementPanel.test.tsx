import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UserResponseData } from "@/types/api/users"

import { UserManagementPanel } from "./UserManagementPanel"
import { sortUsers } from "./UserManagementPanel.helpers"
import { Permission } from "@/models/Permission"
import { useUsersStore, type UsersStoreState } from "@/stores/useUsersStore"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "tooltips.labels.usersMng": "Manage users",
        "modals.usersMng.title": `Users (${options?.val ?? 0})`,
        "modals.usersMng.empty": "No users found.",
        "modals.usersMng.loadError": "Could not load users.",
        "modals.usersMng.retry": "Try again",
        "placeholders.search": "Search..."
      }

      return translations[key] ?? key
    }
  })
}))

vi.mock("./UserEntry", () => ({
  UserEntry: ({ user }: { user: UserResponseData }) => (
    <div data-testid="user-entry">{user.username}</div>
  )
}))

const usersStoreActions = {
  ensureLoaded: useUsersStore.getState().ensureLoaded,
  reload: useUsersStore.getState().reload,
  addUser: useUsersStore.getState().addUser,
  updateUser: useUsersStore.getState().updateUser,
  updatePresence: useUsersStore.getState().updatePresence,
  removeUser: useUsersStore.getState().removeUser,
  getById: useUsersStore.getState().getById
}

describe("UserManagementPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUsersState()
  })

  it("requests users on mount and shows skeleton rows while loading", async () => {
    const ensureLoaded = vi.fn().mockResolvedValue(undefined)
    setUsersState({ state: "LOADING", ensureLoaded })

    render(<UserManagementPanel />)

    await waitFor(() => {
      expect(ensureLoaded).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByTestId("user-management-skeleton-row")).toHaveLength(
      7
    )
  })

  it("renders sorted users and filters by username", () => {
    setUsersState({
      state: "READY",
      users: [
        makeUser("2", "Grace", 0),
        makeUser("1", "Ada", Permission.Administrator.raw)
      ]
    })

    render(<UserManagementPanel />)

    const entries = screen.getAllByTestId("user-entry")
    expect(entries.map((entry) => entry.textContent)).toEqual(["Ada", "Grace"])

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "Grace" }
    })

    expect(screen.getByText("Grace")).toBeInTheDocument()
    expect(screen.queryByText("Ada")).not.toBeInTheDocument()
  })

  it("shows a retryable error state", () => {
    const ensureLoaded = vi.fn().mockResolvedValue(undefined)
    setUsersState({ state: "ERROR", ensureLoaded })

    render(<UserManagementPanel />)

    fireEvent.click(screen.getByRole("button", { name: /try again/i }))

    expect(screen.getByText("Could not load users.")).toBeInTheDocument()
    expect(ensureLoaded).toHaveBeenCalledTimes(2)
  })

  it("shows an empty state when no ready users match", () => {
    setUsersState({ state: "READY", users: [] })

    render(<UserManagementPanel />)

    expect(screen.getByText("No users found.")).toBeInTheDocument()
  })

  it("sorts without mutating the store array", () => {
    const users = [
      makeUser("2", "Grace", 0),
      makeUser("1", "Ada", Permission.Administrator.raw)
    ]

    expect(sortUsers(users).map((user) => user.username)).toEqual([
      "Ada",
      "Grace"
    ])
    expect(users.map((user) => user.username)).toEqual(["Grace", "Ada"])
  })
})

function setUsersState(
  overrides: Partial<{
    users: UserResponseData[]
    state: UsersStoreState
    ensureLoaded: () => Promise<void>
  }> = {}
) {
  useUsersStore.setState({
    users: [],
    state: "NONE",
    _fetchPromise: null,
    ...usersStoreActions,
    ...overrides
  })
}

function makeUser(
  id: string,
  username: string,
  permissions: number
): UserResponseData {
  return {
    id,
    username,
    permissions,
    presence: "OFFLINE",
    isVerified: true,
    suspended: false,
    createdAt: "2026-04-21T10:00:00.000Z",
    updatedAt: "2026-04-21T10:00:00.000Z"
  }
}
