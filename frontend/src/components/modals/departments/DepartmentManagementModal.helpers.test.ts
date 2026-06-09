import type { DepartmentData, DepartmentUsersData } from "@/types/api/departments"
import type { UserResponseData } from "@/types/api/users"

import { describe, expect, it } from "vitest"

import {
  buildBulkMovePayload,
  buildCreateDepartmentPayload,
  buildUpdateDepartmentPayload,
  getBulkMoveTargets,
  getDepartmentUserPartitions,
  sortDepartments,
  sortUsers
} from "./DepartmentManagementModal.helpers"

describe("DepartmentManagementModal helpers", () => {
  it("sorts departments and users without mutating inputs", () => {
    const departments = [
      makeDepartment("department-b", "Support"),
      makeDepartment("department-a", "Billing")
    ]
    const users = [makeUser("user-b", "Grace"), makeUser("user-a", "Ada")]

    expect(sortDepartments(departments).map((department) => department.name)).toEqual([
      "Billing",
      "Support"
    ])
    expect(sortUsers(users).map((user) => user.username)).toEqual(["Ada", "Grace"])
    expect(departments.map((department) => department.name)).toEqual([
      "Support",
      "Billing"
    ])
    expect(users.map((user) => user.username)).toEqual(["Grace", "Ada"])
  })

  it("partitions users by department membership", () => {
    const department = makeDepartment("department-a", "Support")
    const users = [makeUser("user-a", "Ada"), makeUser("user-b", "Grace")]
    const memberships: DepartmentUsersData = {
      "department-a": ["user-b"]
    }

    expect(getDepartmentUserPartitions(department, memberships, users)).toEqual({
      members: [users[1]],
      nonMembers: [users[0]]
    })
  })

  it("builds department payloads from icon state", () => {
    expect(buildCreateDepartmentPayload(" Support ", "EMOJI", " 🧭 ", null, 0x6db9ffff)).toEqual({
      name: "Support",
      icon_type: "EMOJI",
      icon_value: "🧭",
      color_rgba: 0x6db9ffff
    })

    expect(buildUpdateDepartmentPayload(" Support ", "EMOJI", " 🧭 ", null, null)).toEqual({
      name: "Support",
      icon_type: "EMOJI",
      icon_value: "🧭",
      color_rgba: null
    })

    expect(buildCreateDepartmentPayload(" Support ", "NONE", "", null, null)).toEqual({
      name: "Support",
      icon_type: "NONE",
      icon_value: undefined,
      color_rgba: null
    })
  })

  it("builds image and bulk move payloads", () => {
    const file = new File(["icon"], "icon.png", { type: "image/png" })

    expect(buildCreateDepartmentPayload("Support", "NONE", "🧭", file, null)).toEqual({
      name: "Support",
      icon_type: "IMAGE",
      icon_value: undefined,
      color_rgba: null
    })
    expect(buildUpdateDepartmentPayload("Support", "NONE", "🧭", file, 0x9b59b6cc)).toEqual({
      name: "Support",
      icon_type: "IMAGE",
      color_rgba: 0x9b59b6cc
    })
    expect(buildBulkMovePayload(null)).toEqual({ target_department_id: null })
  })

  it("builds bulk move targets without the source department", () => {
    const source = makeDepartment("department-a", "Support")
    const targets = getBulkMoveTargets(
      source,
      [source, makeDepartment("department-b", "Billing")],
      "General"
    )

    expect(targets).toEqual([
      { id: null, name: "General" },
      { id: "department-b", name: "Billing" }
    ])
  })
})

function makeDepartment(id: string, name: string): DepartmentData {
  return {
    id,
    name,
    icon_type: "EMOJI",
    icon_value: "🏷️",
    color_rgba: null,
    note_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  }
}

function makeUser(id: string, username: string): UserResponseData {
  return {
    id,
    username,
    permissions: 0,
    presence: "OFFLINE",
    isVerified: true,
    suspended: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z"
  }
}
