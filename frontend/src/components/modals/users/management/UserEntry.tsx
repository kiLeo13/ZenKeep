import { useEffect, useState, type JSX } from "react"
import type { UserResponseData } from "@/types/api/users"

import clsx from "clsx"

import { IoPerson } from "react-icons/io5"
import { RiErrorWarningLine } from "react-icons/ri"
import { UserActions } from "./UserActions"
import { EditableText } from "@/components/ui/inputs/EditableText"
import { LoaderContainer } from "@/components/LoaderContainer"
import { AppTooltip } from "@/components/ui/AppTooltip"
import { Permission } from "@/models/Permission"
import { FaUserSlash } from "react-icons/fa"
import { formatTimestamp } from "@/utils/utils"
import { useSessionStore } from "@/stores/useSessionStore"
import { useTranslation } from "react-i18next"
import { userService } from "@/services/userService"
import { toasts } from "@/utils/toastUtils"

import styles from "./UserEntry.module.css"

type UserCapabilities = {
  canEditProfile: boolean
  shouldRenderActions: boolean
}

type UserEntryProps = {
  user: UserResponseData
}

export function UserEntry({ user }: UserEntryProps): JSX.Element {
  const { t } = useTranslation()

  const [draftName, setDraftName] = useState(user.username)
  const [isLoading, setIsLoading] = useState(false)

  const self = useSessionStore((state) => state.user)
  const isSelf = user.id === self?.id
  const isOnline = user.presence === "ONLINE" || user.id == self?.id

  const { canEditProfile, shouldRenderActions } = getUserCapabilities(
    self,
    user
  )

  useEffect(() => {
    setDraftName(user.username)
  }, [user.username])

  const handleSave = async (val: string) => {
    const trimmed = val.trim()
    if (trimmed === user.username) {
      setDraftName(user.username)
      return
    }

    setIsLoading(true)
    const resp = await userService.updateUser(user.id, { username: trimmed })
    setIsLoading(false)

    if (!resp.success) {
      // Rollback the UI if API rejects the request
      setDraftName(user.username)
      toasts.apiError(t("menus.users.actions.update.error"), resp)
    } else {
      // Just to be sure both sides don't disagree with the info
      user.username = resp.data.username
      setDraftName(resp.data.username)
    }
  }

  return (
    <div className={styles.userRow}>
      <div className={styles.left}>
        <div className={styles.userIcon}>
          <IoPerson size={"1.3em"} color="#1e1724" />
          <div className={clsx(styles.presence, isOnline && styles.online)} />
        </div>

        <div className={styles.userData}>
          <div className={styles.userTop}>
            {isLoading && (
              <LoaderContainer className={styles.loader} scale={0.6} />
            )}
            <EditableText
              value={draftName}
              onChange={setDraftName}
              minLength={2}
              maxLength={80}
              onSave={handleSave}
              editable={canEditProfile}
              className={clsx(
                styles.username,
                canEditProfile && styles.editable
              )}
              onCancel={() => setDraftName(user.username)}
            />

            {/* Suspended? */}
            {user.suspended && (
              <AppTooltip label={t("labels.suspended")}>
                <FaUserSlash color="#eb5e5e" cursor="pointer" />
              </AppTooltip>
            )}

            {/* User Verification Status */}
            <AppTooltip label={t("labels.unverified")}>
              {!user.isVerified && (
                <RiErrorWarningLine
                  size={"0.9em"}
                  color="#c2af72"
                  cursor="pointer"
                />
              )}
            </AppTooltip>
            {isSelf && <span className={styles.you}>{t("labels.you")}</span>}
          </div>
          <span className={styles.timestamp}>
            {formatTimestamp(user.createdAt)}
          </span>
        </div>
      </div>

      {shouldRenderActions && (
        <UserActions user={user} className={styles.actions} />
      )}
    </div>
  )
}

function getUserCapabilities(
  self: UserResponseData | null,
  target: UserResponseData
): UserCapabilities {
  if (!self) {
    return {
      canEditProfile: false,
      shouldRenderActions: false
    }
  }

  const isSelf = self.id === target.id

  // Target states
  const targetIsAdmin = Permission.hasEffective(
    target.permissions,
    Permission.Administrator
  )
  const targetHasManagePerms = Permission.hasEffective(
    target.permissions,
    Permission.ManagePermissions
  )

  // Actor (Self) capabilities
  const hasManageUsers = Permission.hasEffective(
    self.permissions,
    Permission.ManageUsers
  )
  const hasManagePerms = Permission.hasEffective(
    self.permissions,
    Permission.ManagePermissions
  )
  const hasManageDepartments = Permission.hasEffective(
    self.permissions,
    Permission.ManageDepartments
  )
  const hasDeleteUsers = Permission.hasEffective(
    self.permissions,
    Permission.DeleteUsers
  )
  const hasPunishUsers = Permission.hasEffective(
    self.permissions,
    Permission.PunishUsers
  )

  // Profile Editing: Needs `ManageUsers`. Target cannot be Admin, unless it is self.
  const canEditProfile = hasManageUsers && (!targetIsAdmin || isSelf)

  // Manage Permissions: Needs `ManagePerms`. Target cannot be Admin at all.
  const canManagePerms = hasManagePerms && !targetIsAdmin

  // Manage department memberships: needs both department and user management.
  const canManageDepartmentMemberships = hasManageDepartments && hasManageUsers

  // Delete Users: Needs `DeleteUsers`. Cannot delete self. Target cannot be Admin.
  const canDelete = hasDeleteUsers && !isSelf && !targetIsAdmin

  // Punish Users: Needs `PunishUsers`. Cannot punish self. Target cannot be Admin OR have ManagePerms.
  const canPunish =
    hasPunishUsers && !isSelf && !targetIsAdmin && !targetHasManagePerms

  // If the user can do at least one action, we should mount the UserActions component
  const shouldRenderActions =
    canManagePerms || canManageDepartmentMemberships || canDelete || canPunish

  return { canEditProfile, shouldRenderActions }
}
