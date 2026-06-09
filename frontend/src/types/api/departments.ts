import { z } from "zod"

export const DEPARTMENT_ICON_MAX_SIZE_BYTES = 256 * 1024

export const departmentIconTypeSchema = z.enum(["NONE", "EMOJI", "IMAGE"])
export type DepartmentIconType = z.infer<typeof departmentIconTypeSchema>

export interface CreateDepartmentPayload {
  name: string
  icon_type: DepartmentIconType
  icon_value?: string
  color_rgba?: number | null
}

export interface UpdateDepartmentPayload {
  name?: string
  icon_type?: DepartmentIconType
  icon_value?: string
  color_rgba?: number | null
}

export interface BulkMoveDepartmentNotesPayload {
  target_department_id: string | null
}

export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon_type: departmentIconTypeSchema,
  icon_value: z.string(),
  color_rgba: z.number().int().min(0).max(0xffffffff).nullable(),
  note_count: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string()
})

export const departmentUsersSchema = z.record(z.string(), z.array(z.string()))

export const listDepartmentsResponseSchema = z.object({
  departments: z.array(departmentSchema)
})

export const listDepartmentMembershipsResponseSchema = z.object({
  departments: departmentUsersSchema
})

export type DepartmentData = z.infer<typeof departmentSchema>
export type DepartmentUsersData = z.infer<typeof departmentUsersSchema>
export type ListDepartmentsResponseData = z.infer<
  typeof listDepartmentsResponseSchema
>
export type ListDepartmentMembershipsResponseData = z.infer<
  typeof listDepartmentMembershipsResponseSchema
>
