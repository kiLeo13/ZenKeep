import type { UserResponseData } from "@/types/api/users"
import type { BulkMoveTarget } from "./DepartmentActionsMenu"
import type {
  BulkMoveDepartmentNotesPayload,
  CreateDepartmentPayload,
  DepartmentData,
  DepartmentIconType,
  DepartmentUsersData,
  UpdateDepartmentPayload
} from "@/types/api/departments"

export const DEFAULT_DEPARTMENT_ICON_TYPE: DepartmentIconType = "NONE"
export const DEFAULT_DEPARTMENT_EMOJI = ""

export function sortDepartments(
  departments: DepartmentData[]
): DepartmentData[] {
  return [...departments].sort((a, b) => a.name.localeCompare(b.name))
}

export function sortUsers(users: UserResponseData[]): UserResponseData[] {
  return [...users].sort((a, b) => a.username.localeCompare(b.username))
}

export function getDepartmentUserPartitions(
  department: DepartmentData | null,
  memberships: DepartmentUsersData,
  users: UserResponseData[]
): { members: UserResponseData[]; nonMembers: UserResponseData[] } {
  if (!department) {
    return { members: [], nonMembers: [] }
  }

  const memberUserIds = new Set(memberships[department.id] ?? [])

  return {
    members: users.filter((user) => memberUserIds.has(user.id)),
    nonMembers: users.filter((user) => !memberUserIds.has(user.id))
  }
}

export function buildCreateDepartmentPayload(
  name: string,
  iconType: DepartmentIconType,
  emoji: string,
  iconFile: File | null,
  colorRGBA: number | null
): CreateDepartmentPayload {
  const normalizedIconType = normalizeDepartmentIconType(iconType, emoji, iconFile)

  return {
    name: name.trim(),
    icon_type: normalizedIconType,
    icon_value: normalizedIconType === "EMOJI" ? emoji.trim() : undefined,
    color_rgba: colorRGBA
  }
}

export function buildUpdateDepartmentPayload(
  name: string,
  iconType: DepartmentIconType,
  emoji: string,
  iconFile: File | null,
  colorRGBA: number | null
): UpdateDepartmentPayload {
  const normalizedIconType = normalizeDepartmentIconType(iconType, emoji, iconFile)

  return {
    name: name.trim(),
    icon_type: normalizedIconType,
    ...(normalizedIconType === "EMOJI" ? { icon_value: emoji.trim() } : {}),
    color_rgba: colorRGBA
  }
}

function normalizeDepartmentIconType(
  iconType: DepartmentIconType,
  emoji: string,
  iconFile: File | null
): DepartmentIconType {
  if (iconFile) return "IMAGE"
  if (iconType === "EMOJI" && emoji.trim()) return "EMOJI"
  if (iconType === "IMAGE") return "IMAGE"
  return "NONE"
}

export function buildBulkMovePayload(
  targetDepartmentId: string | null
): BulkMoveDepartmentNotesPayload {
  return {
    target_department_id: targetDepartmentId
  }
}

export function getBulkMoveTargets(
  department: DepartmentData,
  departments: DepartmentData[],
  generalName: string
): BulkMoveTarget[] {
  return [
    { id: null, name: generalName },
    ...departments
      .filter((target) => target.id !== department.id)
      .map((target) => ({ id: target.id, name: target.name }))
  ]
}
