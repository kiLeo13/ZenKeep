import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarRail } from "./SidebarRail"
import { Permission } from "@/models/Permission"
import { usePermission } from "@/hooks/usePermission"
import { userService } from "@/services/userService"
import { toasts } from "@/utils/toastUtils"

const navigateMock = vi.fn()
const grantedPermissions = new Set<Permission>()
const darkWrapperMock = vi.hoisted(() => vi.fn())

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "tooltips.labels.createNote": "Criar nota",
        "tooltips.labels.usersMng": "Gerenciar usuÃ¡rios",
        "tooltips.labels.algoCalc": "Calculadora",
        "tooltips.labels.companyLookup": "Consultar empresa",
        "tooltips.labels.textPdf": "Gerar PDF",
        "tooltips.labels.auditLogs": "Logs de auditoria",
        "tooltips.labels.departments": "Departamentos",
        "tooltips.labels.settings": "ConfiguraÃ§Ãµes",
        "menus.settings.signout": "Sair",
        "menus.notes.optText": "Nota markdown",
        "menus.notes.optFlowchart": "Fluxograma",
        "menus.notes.optFile": "Arquivo",
        "warnings.noAccessToken": "Sem token",
        "errors.logout": "Erro ao sair"
      }

      return translations[key] ?? key
    }
  })
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock
}))

vi.mock("../ui/ActionMenu", () => ({
  ActionMenu: ({
    children,
    items
  }: {
    children: ReactNode
    items: Array<{ label: string; onClick: () => void }>
  }) => (
    <>
      {children}
      <div>
        {items.map((item) => (
          <button key={item.label} onClick={item.onClick}>
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
  DarkWrapper: (props: {
    children: ReactNode
    open?: boolean
    isolateMouseDownEvents?: boolean
  }) => {
    darkWrapperMock(props)
    return <>{props.children}</>
  }
}))

vi.mock("../modals/departments/DepartmentManagementModal", () => ({
  DepartmentManagementModal: () => null
}))

vi.mock("../modals/global/pdf/TextPDFModal", () => ({
  TextPDFModal: () => null
}))

vi.mock("../ui/effects/Ripple", () => ({
  Ripple: () => null
}))

vi.mock("../ui/buttons/Button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode
  }) => <button {...props}>{children}</button>
}))

vi.mock("@/hooks/usePermission", () => ({
  usePermission: vi.fn((permission: Permission) =>
    grantedPermissions.has(permission)
  )
}))

vi.mock("@/services/userService", () => ({
  userService: {
    logout: vi.fn()
  }
}))

vi.mock("@/utils/toastUtils", () => ({
  toasts: {
    warning: vi.fn(),
    apiError: vi.fn()
  }
}))

describe("SidebarRail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    darkWrapperMock.mockClear()
    grantedPermissions.clear()
    localStorage.clear()
  })

  it("renders gated utility actions when the user has the required permissions", () => {
    grantedPermissions.add(Permission.CreateNotes)
    grantedPermissions.add(Permission.ManageUsers)
    grantedPermissions.add(Permission.PerformLookup)
    grantedPermissions.add(Permission.ReadAuditLogs)
    grantedPermissions.add(Permission.ManageDepartments)
    grantedPermissions.add(Permission.GeneratePDFs)

    render(<SidebarRail />)

    expect(screen.getByRole("button", { name: "Criar nota" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Gerenciar usuÃ¡rios" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Consultar empresa" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gerar PDF" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Logs de auditoria" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Departamentos" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Calculadora" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ConfiguraÃ§Ãµes" })).toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Nota markdown" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fluxograma" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Arquivo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument()
  })

  it("hides permission-gated actions when the user does not have access", () => {
    render(<SidebarRail />)

    expect(
      screen.queryByRole("button", { name: "Criar nota" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Gerenciar usuÃ¡rios" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Consultar empresa" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Gerar PDF" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Logs de auditoria" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Departamentos" })
    ).not.toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Calculadora" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ConfiguraÃ§Ãµes" })).toBeInTheDocument()
  })

  it("toggles the user management panel and exposes pressed state", () => {
    const onToggleUserManagement = vi.fn()
    grantedPermissions.add(Permission.ManageUsers)

    render(
      <SidebarRail
        isUserManagementOpen
        onToggleUserManagement={onToggleUserManagement}
      />
    )

    const usersButton = screen.getByRole("button", { name: /Gerenciar/ })

    expect(usersButton).toHaveAttribute("aria-pressed", "true")
    expect(usersButton).toHaveAttribute(
      "aria-controls",
      "user-management-panel"
    )

    fireEvent.click(usersButton)

    expect(onToggleUserManagement).toHaveBeenCalledTimes(1)
  })

  it("signs out from the settings menu, clears local tokens, and redirects to login", async () => {
    localStorage.setItem("access_token", "access")
    localStorage.setItem("id_token", "id")
    vi.mocked(userService.logout).mockResolvedValue({
      success: true,
      data: undefined,
      statusCode: 200
    })

    render(<SidebarRail />)

    fireEvent.click(screen.getByRole("button", { name: "Sair" }))

    await waitFor(() => {
      expect(userService.logout).toHaveBeenCalledWith({
        access_token: "access"
      })
      expect(localStorage.getItem("access_token")).toBeNull()
      expect(localStorage.getItem("id_token")).toBeNull()
      expect(navigateMock).toHaveBeenCalledWith({ to: "/login" })
    })
  })

  it("warns and redirects immediately when sign out has no access token available", async () => {
    render(<SidebarRail />)

    fireEvent.click(screen.getByRole("button", { name: "Sair" }))

    await waitFor(() => {
      expect(toasts.warning).toHaveBeenCalledWith("Sem token")
      expect(userService.logout).not.toHaveBeenCalled()
      expect(navigateMock).toHaveBeenCalledWith({ to: "/login" })
    })
  })

  it("keeps the permission hook wired to the current permission set", () => {
    render(<SidebarRail />)

    expect(usePermission).toHaveBeenCalledWith(Permission.CreateNotes)
    expect(usePermission).toHaveBeenCalledWith(Permission.ManageUsers)
    expect(usePermission).toHaveBeenCalledWith(Permission.PerformLookup)
    expect(usePermission).toHaveBeenCalledWith(Permission.ReadAuditLogs)
    expect(usePermission).toHaveBeenCalledWith(Permission.ManageDepartments)
    expect(usePermission).toHaveBeenCalledWith(Permission.GeneratePDFs)
  })

  it("lets editor modal mouse down events reach native drag listeners", () => {
    grantedPermissions.add(Permission.CreateNotes)

    render(<SidebarRail />)

    fireEvent.click(screen.getByRole("button", { name: "Fluxograma" }))

    const editorWrapperCall = darkWrapperMock.mock.calls
      .map(([props]) => props)
      .find(
        (props) =>
          props.open === true && props.isolateMouseDownEvents === false
      )

    expect(editorWrapperCall).toBeDefined()
  })
})
