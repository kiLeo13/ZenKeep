import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { NoteResponseData } from "@/types/api/notes"
import type { DepartmentData } from "@/types/api/departments"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Sidebar } from "./Sidebar"
import { noteService } from "@/services/noteService"
import { usePermission } from "@/hooks/usePermission"
import { useDepartmentsStore } from "@/stores/useDepartmentsStore"
import { useNoteStore } from "@/stores/useNotesStore"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "departments.general": "General",
        "departments.unknown": "Unknown department",
        "sidebar.notes.manyFound": `${options?.val ?? 0} notes`,
        "sidebar.notes.toasts.moveError": "Move failed",
        "sidebar.notes.noResults": "No notes",
        "sidebar.notes.oneFound": "1 note",
        "sidebar.notes.search": "Search notes",
        "sidebar.notes.title": "Notes"
      }

      return translations[key] ?? key
    }
  })
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn()
}))

vi.mock("./SidebarRail", () => ({
  SidebarRail: () => null
}))

vi.mock("../notes/SidebarNote", () => ({
  SidebarNote: ({
    note,
    onClick
  }: {
    note: NoteResponseData
    onClick?: () => void
  }) => (
    <div onClick={onClick} role="listitem">
      {note.name}
    </div>
  )
}))

vi.mock("@/hooks/usePermission", () => ({
  usePermission: vi.fn(() => false)
}))

vi.mock("@/services/noteService", () => ({
  noteService: {
    updateNote: vi.fn()
  }
}))

vi.mock("@/utils/toastUtils", () => ({
  toasts: {
    success: vi.fn(),
    apiError: vi.fn()
  }
}))

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePermission).mockReturnValue(false)
    useNoteStore.setState({
      notes: [
        makeNote("1", "General Policy", null),
        makeNote("2", "Refund Script", "department-a")
      ],
      state: "READY",
      _fetchPromise: null,
      shownNote: null
    })
    useDepartmentsStore.setState({
      departments: [
        makeDepartment("department-a", "Reclame Aqui", 0x6db9ffff),
        makeDepartment("department-b", "Social")
      ],
      memberships: {},
      state: "READY",
      membershipState: "READY",
      _fetchPromise: null,
      _membershipFetchPromise: null
    })
  })

  it("keeps empty department groups visible when not searching", () => {
    render(<Sidebar />)

    expect(screen.getByText("General")).toBeInTheDocument()
    expect(screen.getByText("Reclame Aqui")).toBeInTheDocument()
    expect(screen.getByText("Reclame Aqui")).toHaveStyle({
      color: "rgba(109, 185, 255, 1)"
    })
    expect(screen.getByText("Social")).toBeInTheDocument()
    expect(screen.getByText("General Policy")).toBeInTheDocument()
    expect(screen.getByText("Refund Script")).toBeInTheDocument()
  })

  it("hides only department groups without matches while searching", () => {
    render(<Sidebar />)

    fireEvent.change(screen.getByPlaceholderText("Search notes"), {
      target: { value: "refund" }
    })

    expect(screen.getByText("Reclame Aqui")).toBeInTheDocument()
    expect(screen.getByText("Refund Script")).toBeInTheDocument()
    expect(screen.queryByText("General")).not.toBeInTheDocument()
    expect(screen.queryByText("Social")).not.toBeInTheDocument()
    expect(screen.queryByText("General Policy")).not.toBeInTheDocument()
  })

  it("collapses and expands category notes from the department header", () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByRole("button", { name: "General" }))

    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(screen.queryByText("General Policy")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "General" }))

    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByText("General Policy")).toBeInTheDocument()
  })

  it("moves a Ctrl-dragged note to the dropped category when the user can edit notes", async () => {
    vi.mocked(usePermission).mockReturnValue(true)
    vi.mocked(noteService.updateNote).mockResolvedValue({
      success: true,
      statusCode: 200,
      data: makeNote("2", "Refund Script", "department-b")
    })

    render(<Sidebar />)

    fireEvent.keyDown(window, { key: "Control", ctrlKey: true })

    const dataTransfer = createDataTransfer()
    const draggedNote = screen
      .getByText("Refund Script")
      .closest("[draggable='true']")
    expect(draggedNote).not.toBeNull()

    fireEvent.dragStart(draggedNote!, { dataTransfer })
    fireEvent.dragOver(screen.getByRole("button", { name: "Social" }), {
      dataTransfer
    })
    fireEvent.drop(screen.getByRole("button", { name: "Social" }), {
      dataTransfer
    })

    await waitFor(() => {
      expect(noteService.updateNote).toHaveBeenCalledWith("2", {
        department_id: "department-b"
      })
    })
    expect(useNoteStore.getState().getNoteById("2")?.department_id).toBe(
      "department-b"
    )
  })
})

function createDataTransfer(): DataTransfer {
  const data = new Map<string, string>()

  return {
    dropEffect: "none",
    effectAllowed: "all",
    getData: (format: string) => data.get(format) ?? "",
    setData: (format: string, value: string) => {
      data.set(format, value)
    }
  } as DataTransfer
}

function makeNote(
  id: string,
  name: string,
  departmentID: string | null
): NoteResponseData {
  return {
    id,
    name,
    tags: [],
    department_id: departmentID,
    note_type: "MARKDOWN",
    created_by_id: "7",
    content_size: 256,
    created_at: "2026-04-21T10:00:00.000Z",
    updated_at: "2026-04-21T10:00:00.000Z"
  }
}

function makeDepartment(
  id: string,
  name: string,
  colorRGBA: number | null = null
): DepartmentData {
  return {
    id,
    name,
    icon_type: "EMOJI",
    icon_value: "#",
    color_rgba: colorRGBA,
    note_count: 0,
    created_at: "2026-04-21T10:00:00.000Z",
    updated_at: "2026-04-21T10:00:00.000Z"
  }
}
