import { useState, type JSX } from "react"
import type { UserResponseData } from "@/types/api/users"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import clsx from "clsx"

import { Permission } from "@/models/Permission"
import { SlOptions } from "react-icons/sl"
import { FiRotateCcw } from "react-icons/fi"
import { MdDeleteForever, MdPersonOff } from "react-icons/md"
import { DarkWrapper } from "@/components/DarkWrapper"
import { AppTooltip } from "@/components/ui/AppTooltip"
import { SuspendUserModal } from "./SuspendUserModal"
import { DeleteUserModal } from "./DeleteUserModal"
import { UserPermissionsSubMenu } from "./UserPermissionsSubMenu"
import { UserDepartmentsSubMenu } from "./UserDepartmentsSubMenu"
import { useRetainedModalValue } from "@/hooks/useModalPresence"
import { usePermission } from "@/hooks/usePermission"
import { useSessionStore } from "@/stores/useSessionStore"
import { useTranslation } from "react-i18next"

import styles from "./UserActions.module.css"

type UserActionsProps = {
  user: UserResponseData
  className: string
}

type ModalType = "NONE" | "SUSPEND" | "DELETE"

export function UserActions({
  user,
  className
}: UserActionsProps): JSX.Element | null {
  const { t } = useTranslation()
  const [activeModal, setActiveModal] = useState<ModalType>("NONE")

  const hasManagePerms = usePermission(Permission.ManagePermissions)
  const hasManageDepartments = usePermission(Permission.ManageDepartments)
  const hasManageUsers = usePermission(Permission.ManageUsers)
  const hasDeleteUsers = usePermission(Permission.DeleteUsers)
  const hasPunishUsers = usePermission(Permission.PunishUsers)

  const self = useSessionStore((state) => state.user)
  const isSelf = user.id === self?.id
  const canModerateUser =
    (hasDeleteUsers || hasPunishUsers) &&
    !Permission.hasEffective(user.permissions, Permission.Administrator)

  const handleCloseModal = () => setActiveModal("NONE")
  const activeConfirmModal = activeModal === "NONE" ? null : activeModal
  const { renderedValue: renderedConfirmModal } =
    useRetainedModalValue(activeConfirmModal)

  return (
    <div className={clsx(styles.userActions, className)}>
      <DarkWrapper
        open={activeModal !== "NONE"}
        zIndex={50}
        animationPreset="pop"
      >
        {renderedConfirmModal === "SUSPEND" && (
          <SuspendUserModal user={user} onClose={handleCloseModal} />
        )}
        {renderedConfirmModal === "DELETE" && (
          <DeleteUserModal user={user} onClose={handleCloseModal} />
        )}
      </DarkWrapper>

      <DropdownMenu.Root>
        <AppTooltip label={t("menus.users.moderateUser")}>
          <DropdownMenu.Trigger asChild>
            <button className={styles.actionButton}>
              <SlOptions className={styles.actionIcon} size={"1.5em"} />
            </button>
          </DropdownMenu.Trigger>
        </AppTooltip>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.content}
            side="left"
            align="center"
            style={{ zIndex: 100 }}
          >
            {canModerateUser && !isSelf && (
              <>
                {hasPunishUsers && (
                  <DropdownMenu.Item
                    className={styles.item}
                    onSelect={() => setActiveModal("SUSPEND")}
                  >
                    <div className={styles.labelContainer}>
                      <span className={styles.optIcon}>
                        {user.suspended ? (
                          <FiRotateCcw size={"1.3em"} />
                        ) : (
                          <MdPersonOff size={"1.3em"} />
                        )}
                      </span>
                      <span className={styles.itemLabel}>
                        {user.suspended
                          ? t("menus.users.unsuspendUser")
                          : t("menus.users.suspendUser")}
                      </span>
                    </div>
                  </DropdownMenu.Item>
                )}

                {hasDeleteUsers && (
                  <DropdownMenu.Item
                    className={clsx(styles.item, styles.dangerItem)}
                    onSelect={() => setActiveModal("DELETE")}
                  >
                    <div className={styles.labelContainer}>
                      <span className={clsx(styles.optIcon, styles.dangerIcon)}>
                        <MdDeleteForever size={"1.3em"} />
                      </span>
                      <span className={styles.itemLabel}>
                        {t("menus.users.deleteUser")}
                      </span>
                    </div>
                  </DropdownMenu.Item>
                )}
              </>
            )}

            {hasManagePerms && <UserPermissionsSubMenu user={user} />}
            {hasManageDepartments && hasManageUsers && (
              <UserDepartmentsSubMenu user={user} />
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
