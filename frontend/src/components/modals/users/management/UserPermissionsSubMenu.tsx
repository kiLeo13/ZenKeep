import { useEffect, useMemo, useState, type JSX } from "react"
import type { UserResponseData } from "@/types/api/users"

import { Permission } from "@/models/Permission"
import { MdSecurity } from "react-icons/md"
import { MultiSelectMenu, type MenuOption } from "@/components/ui/MultiSelectMenu"
import { useSessionStore } from "@/stores/useSessionStore"
import { useTranslation } from "react-i18next"
import { userService } from "@/services/userService"
import { toasts } from "@/utils/toastUtils"

type UserPermissionsSubMenuProps = {
  user: UserResponseData
}

export function UserPermissionsSubMenu({
  user
}: UserPermissionsSubMenuProps): JSX.Element {
  const { t } = useTranslation()
  const self = useSessionStore((state) => state.user)

  const [savedPermissions, setSavedPermissions] = useState<number>(
    user.permissions
  )
  const [isLoading, setIsLoading] = useState(false)

  const showSaveFooter = !Permission.hasEffective(
    user.permissions,
    Permission.Administrator
  )
  const allPermissions = useMemo(() => [...Permission.all], [])

  const [selectedOffsets, setSelectedOffsets] = useState<number[]>(() =>
    allPermissions
      .filter((p) => Permission.hasRaw(user.permissions, p))
      .map((p) => p.offset)
  )

  const currentMask = useMemo(() => {
    return selectedOffsets.reduce((acc, offset) => acc | (1 << offset), 0)
  }, [selectedOffsets])

  const isDirty = useMemo(
    () => currentMask !== savedPermissions,
    [currentMask, savedPermissions]
  )

  useEffect(() => {
    setSavedPermissions(user.permissions)
    setSelectedOffsets(
      allPermissions
        .filter((p) => Permission.hasRaw(user.permissions, p))
        .map((p) => p.offset)
    )
  }, [allPermissions, user.permissions])

  const menuOptions = useMemo(
    () =>
      getComputedOptions(
        savedPermissions,
        self?.permissions || 0,
        allPermissions,
        t
      ),
    [savedPermissions, self?.permissions, allPermissions, t]
  )

  const handleSelectedOffsetsChange = (values: (string | number)[]) => {
    setSelectedOffsets(values.filter((value): value is number => typeof value === "number"))
  }

  const handleSavePerms = async () => {
    if (!isDirty) return
    setIsLoading(true)
    const resp = await userService.updateUser(user.id, {
      permissions: currentMask
    })
    setIsLoading(false)

    if (resp.success) {
      setSavedPermissions(currentMask)
      user.permissions = currentMask
    } else {
      toasts.apiError(t("errors.userUpdate"), resp)
    }
  }

  return (
    <MultiSelectMenu
      variant="submenu"
      label={t("menus.users.perms.label")}
      icon={<MdSecurity size={"1.3em"} />}
      options={menuOptions}
      values={selectedOffsets}
      onChange={handleSelectedOffsetsChange}
      onSave={handleSavePerms}
      isLoading={isLoading}
      saveDisabled={!isDirty}
      showFooter={showSaveFooter}
    />
  )
}

function getComputedOptions(
  targetMask: number,
  viewerMask: number,
  allPerms: Permission[],
  t: (key: string) => string
): MenuOption[] {
  const isTargetAdmin = Permission.hasRaw(targetMask, Permission.Administrator)
  const isViewerAdmin = Permission.hasRaw(viewerMask, Permission.Administrator)
  const isViewerManager = Permission.hasEffective(
    viewerMask,
    Permission.ManagePermissions
  )

  return allPerms.map((p) => {
    let disabled = false

    if (p.raw === Permission.Administrator.raw) {
      disabled = true
    }

    if (isTargetAdmin && p.raw !== Permission.Administrator.raw) {
      disabled = true
    }

    if (p.raw === Permission.ManagePermissions.raw && !isViewerAdmin) {
      disabled = true
    }

    if (!isViewerManager && !isViewerAdmin) {
      disabled = true
    }

    return { id: p.offset, label: t(p.label), disabled }
  })
}
