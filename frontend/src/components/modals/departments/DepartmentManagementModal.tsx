import { useCallback, useEffect, useMemo, useState, type JSX } from "react"
import type { DepartmentData, DepartmentIconType } from "@/types/api/departments"
import type { UserResponseData } from "@/types/api/users"
import type { BulkMoveTarget } from "./DepartmentActionsMenu"

import { IoMdClose } from "react-icons/io"
import { DarkWrapper } from "@/components/DarkWrapper"
import { ConfirmModal } from "@/components/modals/shared/ConfirmModal"
import { DepartmentDetailsForm } from "./DepartmentDetailsForm"
import { DepartmentMembersPanel } from "./DepartmentMembersPanel"
import { DepartmentSidebar } from "./DepartmentSidebar"
import { Permission } from "@/models/Permission"
import { departmentService } from "@/services/departmentService"
import { useDepartmentsStore } from "@/stores/useDepartmentsStore"
import { usePermission } from "@/hooks/usePermission"
import { useTranslation } from "react-i18next"
import { useUsersStore } from "@/stores/useUsersStore"
import { toasts } from "@/utils/toastUtils"
import {
  DEFAULT_DEPARTMENT_EMOJI,
  DEFAULT_DEPARTMENT_ICON_TYPE,
  buildBulkMovePayload,
  buildCreateDepartmentPayload,
  buildUpdateDepartmentPayload,
  getBulkMoveTargets as buildBulkMoveTargets,
  getDepartmentUserPartitions,
  sortDepartments,
  sortUsers
} from "./DepartmentManagementModal.helpers"

import styles from "./DepartmentManagementModal.module.css"

type ConfirmDialogState = {
  open: boolean
  title: string
  description: string
  onConfirm: () => Promise<void> | void
}

const INITIAL_CONFIRM: ConfirmDialogState = {
  open: false,
  title: "",
  description: "",
  onConfirm: () => { }
}

type DepartmentManagementModalProps = {
  onClose: () => void
}

export function DepartmentManagementModal({
  onClose
}: DepartmentManagementModalProps): JSX.Element {
  const { t } = useTranslation()
  const canManageUsers = usePermission(Permission.ManageUsers)

  const departments = useDepartmentsStore((state) => state.departments)
  const memberships = useDepartmentsStore((state) => state.memberships)
  const ensureDepartmentsLoaded = useDepartmentsStore((state) => state.ensureLoaded)
  const ensureMembershipsLoaded = useDepartmentsStore(
    (state) => state.ensureMembershipsLoaded
  )
  const addDepartment = useDepartmentsStore((state) => state.addDepartment)
  const updateDepartment = useDepartmentsStore((state) => state.updateDepartment)
  const removeDepartment = useDepartmentsStore((state) => state.removeDepartment)
  const addMembership = useDepartmentsStore((state) => state.addMembership)
  const removeMembership = useDepartmentsStore((state) => state.removeMembership)

  const users = useUsersStore((state) => state.users)
  const ensureUsersLoaded = useUsersStore((state) => state.ensureLoaded)

  const sortedDepartments = useMemo(() => sortDepartments(departments), [departments])
  const sortedUsers = useMemo(() => sortUsers(users), [users])

  const [selectedDepartmentId, setSelectedDepartmentId] = useState("")
  const selectedDepartment =
    sortedDepartments.find((d) => d.id === selectedDepartmentId) ??
    sortedDepartments[0] ??
    null

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newIconType, setNewIconType] = useState<DepartmentIconType>(
    DEFAULT_DEPARTMENT_ICON_TYPE
  )
  const [newEmoji, setNewEmoji] = useState(DEFAULT_DEPARTMENT_EMOJI)
  const [newIconFile, setNewIconFile] = useState<File | null>(null)
  const [newColorRGBA, setNewColorRGBA] = useState<number | null>(null)

  const [editName, setEditName] = useState("")
  const [editIconType, setEditIconType] = useState<DepartmentIconType>(
    DEFAULT_DEPARTMENT_ICON_TYPE
  )
  const [editEmoji, setEditEmoji] = useState("")
  const [editIconFile, setEditIconFile] = useState<File | null>(null)
  const [editColorRGBA, setEditColorRGBA] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [showAddUserMenu, setShowAddUserMenu] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM)
  const closeConfirm = useCallback(() => setConfirmDialog(INITIAL_CONFIRM), [])

  useEffect(() => {
    ensureDepartmentsLoaded()
    if (canManageUsers) {
      ensureUsersLoaded()
      ensureMembershipsLoaded()
    }
  }, [
    canManageUsers,
    ensureDepartmentsLoaded,
    ensureMembershipsLoaded,
    ensureUsersLoaded
  ])

  useEffect(() => {
    if (!selectedDepartment) return
    setSelectedDepartmentId(selectedDepartment.id)
    setEditName(selectedDepartment.name)
    setEditEmoji(
      selectedDepartment.icon_type === "EMOJI" ? selectedDepartment.icon_value : ""
    )
    setEditIconType(selectedDepartment.icon_type)
    setEditIconFile(null)
    setEditColorRGBA(selectedDepartment.color_rgba)
  }, [selectedDepartment])

  const { members: departmentMembers, nonMembers: nonMemberUsers } = useMemo(() => {
    return getDepartmentUserPartitions(selectedDepartment, memberships, sortedUsers)
  }, [memberships, selectedDepartment, sortedUsers])

  const handleCreate = async () => {
    if (!newName.trim()) return

    setIsSaving(true)
    const resp = await departmentService.createDepartment(
      buildCreateDepartmentPayload(
        newName,
        newIconType,
        newEmoji,
        newIconFile,
        newColorRGBA
      ),
      newIconFile
    )
    setIsSaving(false)

    if (!resp.success) {
      toasts.apiError(t("departments.toasts.createError"), resp)
      return
    }

    addDepartment(resp.data)
    setSelectedDepartmentId(resp.data.id)
    setNewName("")
    setNewIconType(DEFAULT_DEPARTMENT_ICON_TYPE)
    setNewEmoji(DEFAULT_DEPARTMENT_EMOJI)
    setNewIconFile(null)
    setNewColorRGBA(null)
    setShowCreateForm(false)
    toasts.success(t("departments.toasts.createSuccess"))
  }

  const handleUpdate = async () => {
    if (!selectedDepartment || !editName.trim()) return

    setIsSaving(true)
    const resp = await departmentService.updateDepartment(
      selectedDepartment.id,
      buildUpdateDepartmentPayload(
        editName,
        editIconType,
        editEmoji,
        editIconFile,
        editColorRGBA
      ),
      editIconFile
    )
    setIsSaving(false)

    if (!resp.success) {
      toasts.apiError(t("departments.toasts.updateError"), resp)
      return
    }

    updateDepartment(resp.data)
    toasts.success(t("departments.toasts.updateSuccess"))
  }

  const requestDeleteDepartment = () => {
    if (!selectedDepartment) return
    setConfirmDialog({
      open: true,
      title: t("departments.confirm.deleteTitle"),
      description: t("departments.confirm.delete", { name: selectedDepartment.name }),
      onConfirm: async () => {
        const resp = await departmentService.deleteDepartment(selectedDepartment.id)
        if (!resp.success) {
          if (resp.statusCode === 409) {
            toasts.warning(t("departments.toasts.deleteBlocked"))
          } else {
            toasts.apiError(t("departments.toasts.deleteError"), resp)
          }
          return
        }
        removeDepartment(selectedDepartment.id)
        setSelectedDepartmentId("")
        toasts.success(t("departments.toasts.deleteSuccess"))
        closeConfirm()
      }
    })
  }

  const requestBulkMove = (
    sourceDept: DepartmentData,
    targetId: string | null,
    targetName: string
  ) => {
    setConfirmDialog({
      open: true,
      title: t("departments.confirm.bulkMoveTitle"),
      description: t("departments.confirm.bulkMove", {
        name: sourceDept.name,
        target: targetName
      }),
      onConfirm: async () => {
        const resp = await departmentService.bulkMoveNotes(
          sourceDept.id,
          buildBulkMovePayload(targetId)
        )
        if (resp.success) {
          toasts.success(t("departments.toasts.bulkMoveSuccess"))
        } else {
          toasts.apiError(t("departments.toasts.bulkMoveError"), resp)
        }
        closeConfirm()
      }
    })
  }

  const requestBulkDelete = (dept: DepartmentData) => {
    setConfirmDialog({
      open: true,
      title: t("departments.confirm.bulkDeleteTitle"),
      description: t("departments.confirm.bulkDelete", { name: dept.name }),
      onConfirm: async () => {
        const resp = await departmentService.bulkDeleteNotes(dept.id)
        if (resp.success) {
          toasts.success(t("departments.toasts.bulkDeleteSuccess"))
        } else {
          toasts.apiError(t("departments.toasts.bulkDeleteError"), resp)
        }
        closeConfirm()
      }
    })
  }

  const handleAddMember = async (user: UserResponseData) => {
    if (!selectedDepartment) return
    const resp = await departmentService.addUser(selectedDepartment.id, user.id)
    if (!resp.success) {
      toasts.apiError(t("departments.toasts.membershipError"), resp)
      return
    }
    addMembership(selectedDepartment.id, user.id)
  }

  const requestRemoveMember = (user: UserResponseData) => {
    if (!selectedDepartment) return
    setConfirmDialog({
      open: true,
      title: t("departments.confirm.removeMemberTitle"),
      description: t("departments.confirm.removeMember", {
        user: user.username,
        dept: selectedDepartment.name
      }),
      onConfirm: async () => {
        const resp = await departmentService.removeUser(selectedDepartment.id, user.id)
        if (!resp.success) {
          toasts.apiError(t("departments.toasts.membershipError"), resp)
          return
        }
        removeMembership(selectedDepartment.id, user.id)
        closeConfirm()
      }
    })
  }

  const getBulkMoveTargets = (dept: DepartmentData): BulkMoveTarget[] => {
    return buildBulkMoveTargets(dept, sortedDepartments, t("departments.general"))
  }

  const handleNewEmojiChange = (emoji: string) => {
    setNewIconType("EMOJI")
    setNewEmoji(emoji)
    setNewIconFile(null)
  }

  const handleNewFileChange = (file: File | null) => {
    setNewIconType(file ? "IMAGE" : DEFAULT_DEPARTMENT_ICON_TYPE)
    setNewEmoji(DEFAULT_DEPARTMENT_EMOJI)
    setNewIconFile(file)
  }

  const handleNewRemoveIcon = () => {
    setNewIconType(DEFAULT_DEPARTMENT_ICON_TYPE)
    setNewEmoji(DEFAULT_DEPARTMENT_EMOJI)
    setNewIconFile(null)
  }

  const handleEditEmojiChange = (emoji: string) => {
    setEditIconType("EMOJI")
    setEditEmoji(emoji)
    setEditIconFile(null)
  }

  const handleEditFileChange = (file: File | null) => {
    setEditIconType(file ? "IMAGE" : DEFAULT_DEPARTMENT_ICON_TYPE)
    setEditEmoji("")
    setEditIconFile(file)
  }

  const handleEditRemoveIcon = () => {
    setEditIconType(DEFAULT_DEPARTMENT_ICON_TYPE)
    setEditEmoji("")
    setEditIconFile(null)
  }

  return (
    <div className={styles.container}>
      <button type="button" className={styles.close} onClick={onClose}>
        <IoMdClose size={22} />
      </button>

      <header className={styles.header}>
        <h2 className={styles.title}>{t("departments.management.title")}</h2>
        <span>{t("departments.management.subtitle")}</span>
      </header>

      <div className={styles.layout}>
        <DepartmentSidebar
          departments={sortedDepartments}
          selectedDepartmentId={selectedDepartment?.id ?? null}
          getMoveTargets={getBulkMoveTargets}
          onCreateClick={() => setShowCreateForm(true)}
          onSelectDepartment={setSelectedDepartmentId}
          onBulkMove={requestBulkMove}
          onBulkDelete={requestBulkDelete}
        />

        {showCreateForm ? (
          <DepartmentDetailsForm
            mode="create"
            name={newName}
            iconType={newIconType}
            emoji={newEmoji}
            iconFile={newIconFile}
            colorRGBA={newColorRGBA}
            isSaving={isSaving}
            onNameChange={setNewName}
            onEmojiChange={handleNewEmojiChange}
            onFileChange={handleNewFileChange}
            onRemoveIcon={handleNewRemoveIcon}
            onColorChange={setNewColorRGBA}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
          />
        ) : selectedDepartment ? (
          <div className={styles.panelWithMembers}>
            <DepartmentDetailsForm
              mode="edit"
              department={selectedDepartment}
              name={editName}
              iconType={editIconType}
              emoji={editEmoji}
              iconFile={editIconFile}
              colorRGBA={editColorRGBA}
              isSaving={isSaving}
              onNameChange={setEditName}
              onEmojiChange={handleEditEmojiChange}
              onFileChange={handleEditFileChange}
              onRemoveIcon={handleEditRemoveIcon}
              onColorChange={setEditColorRGBA}
              onSubmit={handleUpdate}
              onDelete={requestDeleteDepartment}
            />

            {canManageUsers && (
              <DepartmentMembersPanel
                members={departmentMembers}
                nonMembers={nonMemberUsers}
                addMenuOpen={showAddUserMenu}
                onAddMenuOpenChange={setShowAddUserMenu}
                onAddMember={(user) => void handleAddMember(user)}
                onRemoveMember={requestRemoveMember}
              />
            )}
          </div>
        ) : (
          <main className={styles.panel}>
            <span className={styles.emptyPanel}>{t("departments.management.empty")}</span>
          </main>
        )}
      </div>

      <DarkWrapper
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
        animationPreset="pop"
        zIndex={50}
      >
        <ConfirmModal
          title={confirmDialog.title}
          description={confirmDialog.description}
          intent="warning"
          strategy="simple"
          onConfirm={confirmDialog.onConfirm}
          onClose={closeConfirm}
        />
      </DarkWrapper>
    </div>
  )
}
