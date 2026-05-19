import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import type { NoteResponseData } from "@/types/api/notes"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarNote } from "./SidebarNote"
import { noteService } from "@/services/noteService"
import { toasts } from "@/utils/toastUtils"
import { copyTextToClipboard, downloadNoteToDevice } from "@/utils/noteDownloads"
import { usePermission } from "@/hooks/usePermission"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "menus.notes.opts.download": "Baixar",
        "menus.notes.opts.edit": "Editar",
        "menus.notes.opts.delete": "Excluir",
        "sidebar.notes.options": "Opções",
        "sidebar.notes.toasts.copyIdSuccess": "ID copiado",
        "sidebar.notes.toasts.copyIdError": "Erro ao copiar",
        "sidebar.notes.toasts.downloadError": "Erro ao baixar"
      }

      if (key === "menus.notes.opts.copyId") {
        return `Copiar ID (#${options?.id})`
      }

      return translations[key] ?? key
    }
  })
}))

vi.mock("../ui/ActionMenu", () => ({
  ActionMenu: ({
    children,
    items
  }: {
    children: ReactNode
    items: Array<{
      label: string
      onClick: () => void
      separatorBefore?: boolean
      variant?: string
    }>
  }) => (
    <>
      {children}
      <div role="menu">
        {items.map((item) => (
          <button
            key={item.label}
            data-separator-before={item.separatorBefore ? "true" : undefined}
            data-variant={item.variant}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}))

vi.mock("../ui/AppTooltip", () => ({
  AppTooltip: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock("../DarkWrapper", () => ({
  DarkWrapper: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock("../modals/notes/updates/UpdateNoteModal", () => ({
  UpdateNoteModal: () => null
}))

vi.mock("../modals/shared/ConfirmModal", () => ({
  ConfirmModal: () => null
}))

vi.mock("../ui/effects/Ripple", () => ({
  Ripple: () => null
}))

vi.mock("@/hooks/usePermission", () => ({
  usePermission: vi.fn(() => false)
}))

vi.mock("@/stores/useNotesStore", () => ({
  useNoteStore: (selector: (state: { shownNote: null }) => unknown) =>
    selector({ shownNote: null })
}))

vi.mock("@/services/noteService", () => ({
  noteService: {
    fetchNote: vi.fn(),
    deleteNote: vi.fn()
  }
}))

vi.mock("@/utils/toastUtils", () => ({
  toasts: {
    success: vi.fn(),
    error: vi.fn(),
    apiError: vi.fn()
  }
}))

vi.mock("@/utils/noteDownloads", () => ({
  copyTextToClipboard: vi.fn(),
  downloadNoteToDevice: vi.fn()
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

describe("SidebarNote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps copy and download inside the options menu", () => {
    render(<SidebarNote note={makeNote()} />)

    expect(screen.getByLabelText("Opções")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Baixar" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Copiar ID (#42)" })
    ).toBeInTheDocument()
  })

  it("copies the note ID from the options menu and shows a success toast", async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(undefined)

    render(<SidebarNote note={makeNote()} />)

    fireEvent.click(screen.getByRole("button", { name: "Copiar ID (#42)" }))

    await waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith("42")
      expect(toasts.success).toHaveBeenCalledWith("ID copiado")
    })
  })

  it("downloads the note through the shared helper from the options menu", async () => {
    vi.mocked(downloadNoteToDevice).mockResolvedValue({
      success: true,
      fileName: "Architecture.md"
    })

    const note = makeNote()
    render(<SidebarNote note={note} />)

    fireEvent.click(screen.getByRole("button", { name: "Baixar" }))

    await waitFor(() => {
      expect(downloadNoteToDevice).toHaveBeenCalledWith(
        note,
        noteService.fetchNote
      )
    })
  })

  it("orders destructive actions after utility actions", () => {
    vi.mocked(usePermission).mockReturnValue(true)

    render(<SidebarNote note={makeNote()} />)

    const menuItems = within(screen.getByRole("menu")).getAllByRole("button")

    expect(menuItems.map((item) => item.textContent)).toEqual([
      "Editar",
      "Baixar",
      "Copiar ID (#42)",
      "Excluir"
    ])
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveAttribute(
      "data-separator-before",
      "true"
    )
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveAttribute(
      "data-variant",
      "danger"
    )
  })
})

function makeNote(): NoteResponseData {
  return {
    id: "42",
    name: "Architecture",
    tags: [],
    department_id: null,
    note_type: "MARKDOWN",
    created_by_id: "7",
    content_size: 256,
    created_at: "2026-04-21T10:00:00.000Z",
    updated_at: "2026-04-21T10:00:00.000Z"
  }
}
