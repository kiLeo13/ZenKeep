import type { MenuOption } from "@/components/ui/MultiSelectMenu"

import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDepartmentsStore } from "@/stores/useDepartmentsStore"
import { UserDepartmentsSubMenu } from "./UserDepartmentsSubMenu"

const { multiSelectMenuMock, departmentServiceMock, toastsMock } = vi.hoisted(
  () => ({
    multiSelectMenuMock: vi.fn((_props: unknown) => null),
    departmentServiceMock: {
      addUser: vi.fn(),
      removeUser: vi.fn()
    },
    toastsMock: {
      apiError: vi.fn()
    }
  })
)

vi.mock("@/components/ui/MultiSelectMenu", () => ({
  MultiSelectMenu: multiSelectMenuMock
}))

vi.mock("@/services/departmentService", () => ({
  departmentService: departmentServiceMock
}))

vi.mock("@/utils/toastUtils", () => ({
  toasts: toastsMock
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

describe("UserDepartmentsSubMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDepartmentsStore.setState({
      departments: [
        makeDepartment("dept-b", "Support"),
        makeDepartment("dept-a", "Billing")
      ],
      memberships: [{ department_id: "dept-a", user_id: "user-a" }],
      state: "READY",
      membershipState: "READY",
      _fetchPromise: null,
      _membershipFetchPromise: null
    })
  })

  it("renders department options and selected memberships for the target user", async () => {
    render(<UserDepartmentsSubMenu user={makeUser("user-a")} />)

    await waitFor(() => {
      expect(multiSelectMenuMock).toHaveBeenCalled()
    })

    const props = getLastMenuProps()
    expect(props.options.map((option) => option.label)).toEqual([
      "Billing",
      "Support"
    ])
    expect(props.values).toEqual(["dept-a"])
    expect(props.showFooter).toBe(false)
  })

  it("adds and removes memberships immediately after successful mutations", async () => {
    departmentServiceMock.addUser.mockResolvedValue({ success: true })
    departmentServiceMock.removeUser.mockResolvedValue({ success: true })

    render(<UserDepartmentsSubMenu user={makeUser("user-a")} />)

    await waitFor(() => {
      expect(multiSelectMenuMock).toHaveBeenCalled()
    })

    let props = getLastMenuProps()
    await props.onItemToggle({ id: "dept-b", label: "Support" }, true, [
      "dept-a",
      "dept-b"
    ])

    expect(departmentServiceMock.addUser).toHaveBeenCalledWith("dept-b", "user-a")
    expect(useDepartmentsStore.getState().memberships).toContainEqual({
      department_id: "dept-b",
      user_id: "user-a"
    })

    props = getLastMenuProps()
    await props.onItemToggle({ id: "dept-a", label: "Billing" }, false, [
      "dept-b"
    ])

    expect(departmentServiceMock.removeUser).toHaveBeenCalledWith(
      "dept-a",
      "user-a"
    )
    expect(useDepartmentsStore.getState().memberships).not.toContainEqual({
      department_id: "dept-a",
      user_id: "user-a"
    })
  })

  it("keeps membership state unchanged when a mutation fails", async () => {
    const response = { success: false, statusCode: 500 }
    departmentServiceMock.addUser.mockResolvedValue(response)

    render(<UserDepartmentsSubMenu user={makeUser("user-a")} />)

    await waitFor(() => {
      expect(multiSelectMenuMock).toHaveBeenCalled()
    })

    const props = getLastMenuProps()
    await props.onItemToggle({ id: "dept-b", label: "Support" }, true, [
      "dept-a",
      "dept-b"
    ])

    expect(toastsMock.apiError).toHaveBeenCalledWith(
      "departments.toasts.membershipError",
      response
    )
    expect(useDepartmentsStore.getState().memberships).toEqual([
      { department_id: "dept-a", user_id: "user-a" }
    ])
  })
})

type CapturedMenuProps = {
  options: MenuOption[]
  values: (string | number)[]
  showFooter: boolean
  onItemToggle: (
    option: MenuOption,
    checked: boolean,
    nextValues: (string | number)[]
  ) => Promise<void>
}

function getLastMenuProps(): CapturedMenuProps {
  const calls = multiSelectMenuMock.mock.calls
  const lastCall = calls.at(-1)
  if (!lastCall) {
    throw new Error("MultiSelectMenu was not rendered")
  }
  return lastCall[0] as CapturedMenuProps
}

function makeUser(id: string) {
  return {
    id,
    username: "Ada",
    permissions: 0,
    presence: "OFFLINE" as const,
    isVerified: true,
    suspended: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z"
  }
}

function makeDepartment(id: string, name: string) {
  return {
    id,
    name,
    icon_type: "NONE" as const,
    icon_value: "",
    color_rgba: null,
    note_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  }
}
