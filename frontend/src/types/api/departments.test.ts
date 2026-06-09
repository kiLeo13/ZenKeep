import { describe, expect, it } from "vitest"

import { departmentSchema, listDepartmentMembershipsResponseSchema } from "./departments"

describe("department API schemas", () => {
  it("requires the backend note count on department responses", () => {
    const parsed = departmentSchema.parse({
      id: "42",
      name: "Support",
      icon_type: "EMOJI",
      icon_value: "#",
      color_rgba: null,
      note_count: 3,
      created_at: "2026-05-03T10:00:00.000Z",
      updated_at: "2026-05-03T10:00:00.000Z"
    })

    expect(parsed.note_count).toBe(3)
  })

  it("rejects department responses without a note count", () => {
    const result = departmentSchema.safeParse({
      id: "42",
      name: "Support",
      icon_type: "EMOJI",
      icon_value: "#",
      color_rgba: null,
      created_at: "2026-05-03T10:00:00.000Z",
      updated_at: "2026-05-03T10:00:00.000Z"
    })

    expect(result.success).toBe(false)
  })

  it("parses department memberships grouped by department ID", () => {
    const parsed = listDepartmentMembershipsResponseSchema.parse({
      departments: {
        "1": ["10", "11"],
        "2": ["12"]
      }
    })

    expect(parsed.departments["1"]).toEqual(["10", "11"])
  })

  it("rejects row-shaped department memberships", () => {
    const result = listDepartmentMembershipsResponseSchema.safeParse({
      memberships: [{ department_id: "1", user_id: "10" }]
    })

    expect(result.success).toBe(false)
  })
})
