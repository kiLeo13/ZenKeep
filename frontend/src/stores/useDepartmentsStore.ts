import type {
  DepartmentData,
  DepartmentUsersData,
  ListDepartmentMembershipsResponseData,
  ListDepartmentsResponseData
} from "@/types/api/departments"
import type { ApiResponse } from "@/types/api/api"

import { create } from "zustand"
import { departmentService } from "@/services/departmentService"

export type DepartmentsStoreState = "NONE" | "LOADING" | "READY" | "ERROR"

type DepartmentsState = {
  departments: DepartmentData[]
  memberships: DepartmentUsersData
  state: DepartmentsStoreState
  membershipState: DepartmentsStoreState
  _fetchPromise: Promise<ApiResponse<ListDepartmentsResponseData> | void> | null
  _membershipFetchPromise: Promise<
    ApiResponse<ListDepartmentMembershipsResponseData> | void
  > | null

  ensureLoaded: () => Promise<ApiResponse<ListDepartmentsResponseData> | void>
  ensureMembershipsLoaded: () => Promise<
    ApiResponse<ListDepartmentMembershipsResponseData> | void
  >
  reload: () => Promise<void>
  reloadMemberships: () => Promise<void>

  addDepartment: (department: DepartmentData) => void
  updateDepartment: (department: DepartmentData) => void
  removeDepartment: (departmentId: string) => void
  getDepartmentById: (departmentId: string | null | undefined) => DepartmentData | null

  addMembership: (departmentId: string, userId: string) => void
  removeMembership: (departmentId: string, userId: string) => void
  setMemberships: (memberships: DepartmentUsersData) => void
}

export const useDepartmentsStore = create<DepartmentsState>((set, get) => ({
  departments: [],
  memberships: {},
  state: "NONE",
  membershipState: "NONE",
  _fetchPromise: null,
  _membershipFetchPromise: null,

  ensureLoaded() {
    const { state, _fetchPromise } = get()
    if (state === "READY") return Promise.resolve()
    if (_fetchPromise) return _fetchPromise

    const promise = (async () => {
      set({ state: "LOADING" })
      const resp = await departmentService.listDepartments()
      if (resp.success) {
        set({ departments: resp.data.departments, state: "READY" })
      } else {
        set({ state: "ERROR" })
      }
      return resp
    })()

    set({ _fetchPromise: promise.finally(() => set({ _fetchPromise: null })) })
    return promise
  },

  ensureMembershipsLoaded() {
    const { membershipState, _membershipFetchPromise } = get()
    if (membershipState === "READY") return Promise.resolve()
    if (_membershipFetchPromise) return _membershipFetchPromise

    const promise = (async () => {
      set({ membershipState: "LOADING" })
      const resp = await departmentService.listMemberships()
      if (resp.success) {
        set({ memberships: resp.data.departments, membershipState: "READY" })
      } else {
        set({ membershipState: "ERROR" })
      }
      return resp
    })()

    set({
      _membershipFetchPromise: promise.finally(() =>
        set({ _membershipFetchPromise: null })
      )
    })
    return promise
  },

  async reload() {
    set({ state: "LOADING" })
    try {
      const resp = await departmentService.listDepartments()
      if (resp.success) {
        set({ departments: resp.data.departments, state: "READY" })
        return
      }
      set({ state: "ERROR" })
    } catch (error) {
      console.error(error)
      set({ state: "ERROR" })
    }
  },

  async reloadMemberships() {
    set({ membershipState: "LOADING" })
    try {
      const resp = await departmentService.listMemberships()
      if (resp.success) {
        set({ memberships: resp.data.departments, membershipState: "READY" })
        return
      }
      set({ membershipState: "ERROR" })
    } catch (error) {
      console.error(error)
      set({ membershipState: "ERROR" })
    }
  },

  addDepartment(department) {
    set((state) => ({
      departments: state.departments.some((item) => item.id === department.id)
        ? state.departments.map((item) =>
            item.id === department.id ? department : item
          )
        : [...state.departments, department]
    }))
  },

  updateDepartment(department) {
    set((state) => ({
      departments: state.departments.map((item) =>
        item.id === department.id ? department : item
      )
    }))
  },

  removeDepartment(departmentId) {
    set((state) => ({
      departments: state.departments.filter((item) => item.id !== departmentId),
      memberships: withoutDepartmentMemberships(state.memberships, departmentId)
    }))
  },

  getDepartmentById(departmentId) {
    if (!departmentId) return null
    return get().departments.find((item) => item.id === departmentId) || null
  },

  addMembership(departmentId, userId) {
    set((state) => {
      const userIds = state.memberships[departmentId] ?? []
      if (userIds.includes(userId)) return state
      return {
        memberships: {
          ...state.memberships,
          [departmentId]: [...userIds, userId]
        }
      }
    })
  },

  removeMembership(departmentId, userId) {
    set((state) => ({
      memberships: withoutUserMembership(state.memberships, departmentId, userId)
    }))
  },

  setMemberships(memberships) {
    set({ memberships })
  }
}))

function withoutDepartmentMemberships(
  memberships: DepartmentUsersData,
  departmentId: string
): DepartmentUsersData {
  const remaining = { ...memberships }
  delete remaining[departmentId]
  return remaining
}

function withoutUserMembership(
  memberships: DepartmentUsersData,
  departmentId: string,
  userId: string
): DepartmentUsersData {
  const userIds = memberships[departmentId]
  if (!userIds) return memberships

  const remainingUserIds = userIds.filter((item) => item !== userId)
  if (remainingUserIds.length === 0) {
    return withoutDepartmentMemberships(memberships, departmentId)
  }

  return {
    ...memberships,
    [departmentId]: remainingUserIds
  }
}
