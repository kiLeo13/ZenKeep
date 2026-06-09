import { useEffect, useMemo, type JSX } from "react"
import type { UserResponseData } from "@/types/api/users"
import type { MenuOption } from "@/components/ui/MultiSelectMenu"

import { MdGroups } from "react-icons/md"
import { MultiSelectMenu } from "@/components/ui/MultiSelectMenu"
import { departmentService } from "@/services/departmentService"
import { useDepartmentsStore } from "@/stores/useDepartmentsStore"
import { useTranslation } from "react-i18next"
import { toasts } from "@/utils/toastUtils"

type UserDepartmentsSubMenuProps = {
  user: UserResponseData
}

export function UserDepartmentsSubMenu({
  user
}: UserDepartmentsSubMenuProps): JSX.Element {
  const { t } = useTranslation()

  const departments = useDepartmentsStore((state) => state.departments)
  const memberships = useDepartmentsStore((state) => state.memberships)
  const ensureDepartmentsLoaded = useDepartmentsStore((state) => state.ensureLoaded)
  const ensureMembershipsLoaded = useDepartmentsStore(
    (state) => state.ensureMembershipsLoaded
  )
  const addMembership = useDepartmentsStore((state) => state.addMembership)
  const removeMembership = useDepartmentsStore((state) => state.removeMembership)

  useEffect(() => {
    ensureDepartmentsLoaded()
    ensureMembershipsLoaded()
  }, [ensureDepartmentsLoaded, ensureMembershipsLoaded])

  const options = useMemo<MenuOption[]>(
    () =>
      [...departments]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((department) => ({
          id: department.id,
          label: department.name
        })),
    [departments]
  )

  const selectedDepartmentIds = useMemo(
    () => Object.entries(memberships).flatMap(([departmentId, userIds]) =>
      userIds.includes(user.id) ? [departmentId] : []
    ),
    [memberships, user.id]
  )

  const handleToggleDepartment = async (
    option: MenuOption,
    checked: boolean
  ): Promise<void> => {
    const departmentId = String(option.id)
    const resp = checked
      ? await departmentService.addUser(departmentId, user.id)
      : await departmentService.removeUser(departmentId, user.id)

    if (!resp.success) {
      toasts.apiError(t("departments.toasts.membershipError"), resp)
      return
    }

    if (checked) {
      addMembership(departmentId, user.id)
    } else {
      removeMembership(departmentId, user.id)
    }
  }

  return (
    <MultiSelectMenu
      variant="submenu"
      label={t("menus.users.departments.label")}
      icon={<MdGroups size={"1.3em"} />}
      options={options}
      values={selectedDepartmentIds}
      onItemToggle={handleToggleDepartment}
      showFooter={false}
      emptyMessage={t("menus.users.departments.empty")}
    />
  )
}
