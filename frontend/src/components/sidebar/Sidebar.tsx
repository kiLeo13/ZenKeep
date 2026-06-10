import type {
  ChangeEventHandler,
  JSX,
  KeyboardEventHandler,
  MouseEventHandler
} from "react"
import type { NoteResponseData } from "@/types/api/notes"

import { useNavigate } from "@tanstack/react-router"
import { SidebarRail } from "./SidebarRail"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNoteStore } from "@/stores/useNotesStore"
import { useDepartmentsStore } from "@/stores/useDepartmentsStore"
import { throttle } from "lodash-es"
import { useTranslation } from "react-i18next"
import { Permission } from "@/models/Permission"
import { usePermission } from "@/hooks/usePermission"
import { SidebarHeader } from "./SidebarHeader"
import { SidebarEmptyState } from "./SidebarEmptyState"
import { SidebarCategoryGroup } from "./SidebarCategoryGroup"
import { moveNoteToGroup, toDepartmentGroups } from "./Sidebar.helpers"
import { useSidebarInteractions } from "./useSidebarInteractions"

import styles from "./Sidebar.module.css"

type SidebarProps = {
  isUserManagementOpen?: boolean
  onToggleUserManagement?: () => void
}

export function Sidebar({
  isUserManagementOpen = false,
  onToggleUserManagement
}: SidebarProps): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate({ from: "/" })

  const [search, setSearch] = useState("")
  const [collapsedGroupIDs, setCollapsedGroupIDs] = useState<Set<string>>(
    () => new Set()
  )

  const searchRef = useRef<HTMLInputElement>(null)
  const notes = useNoteStore((s) => s.notes)
  const notesState = useNoteStore((s) => s.state)
  const ensureLoaded = useNoteStore((s) => s.ensureLoaded)
  const reloadNotes = useNoteStore((s) => s.reload)
  const updateNote = useNoteStore((s) => s.updateNote)
  const departments = useDepartmentsStore((s) => s.departments)
  const ensureDepartmentsLoaded = useDepartmentsStore((s) => s.ensureLoaded)
  const canEditNotes = usePermission(Permission.EditNotes)

  const isLoading = notesState === "LOADING"
  const departmentGroups = toDepartmentGroups(search, notes, departments, t)
  const resultCount = departmentGroups.reduce(
    (total, group) => total + group.notes.length,
    0
  )

  const throttledLoadNotes = useMemo(
    () => throttle(reloadNotes, 5000, { leading: true, trailing: false }),
    [reloadNotes]
  )

  const sidebarInteractions = useSidebarInteractions({
    canEditNotes,
    notes,
    searchRef,
    throttledLoadNotes,
    onMoveNote: (note, group) => {
      void moveNoteToGroup(note, group, updateNote, t)
    }
  })

  useEffect(() => {
    ensureLoaded()
    ensureDepartmentsLoaded()
  }, [ensureLoaded, ensureDepartmentsLoaded])

  const handleSearch: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSearch(e.target.value)
  }

  const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key.toLowerCase() === "escape") {
      searchRef.current?.blur()
    }
  }

  const handleOpenNote =
    (note: NoteResponseData): MouseEventHandler<HTMLDivElement> =>
    () => {
      void navigate({
        search: (prev) => ({
          ...prev,
          id: note.id
        })
      })
    }

  const toggleGroup = (groupID: string) => {
    setCollapsedGroupIDs((current) => {
      const next = new Set(current)
      if (next.has(groupID)) {
        next.delete(groupID)
      } else {
        next.add(groupID)
      }
      return next
    })
  }

  return (
    <nav className={styles.sidebarLayout}>
      <SidebarRail
        isUserManagementOpen={isUserManagementOpen}
        onToggleUserManagement={onToggleUserManagement}
      />

      <div className={styles.leftMenu}>
        <SidebarHeader
          disabled={isLoading}
          resultCount={resultCount}
          search={search}
          searchRef={searchRef}
          onSearch={handleSearch}
          onSearchKeyDown={handleSearchKeyDown}
        />

        <div className={styles.menuLowerItems}>
          <div className={styles.sidebarLoaderContainer}>
            {isLoading && <div className="loader" />}
          </div>

          {resultCount === 0 && !isLoading && <SidebarEmptyState />}

          {!isLoading &&
            departmentGroups.map((group) => (
              <SidebarCategoryGroup
                canEditNotes={canEditNotes}
                draggedNoteID={sidebarInteractions.draggedNoteID}
                group={group}
                isCtrlPressed={sidebarInteractions.isCtrlPressed}
                isDropTarget={sidebarInteractions.dropTargetID === group.id}
                isExpanded={!collapsedGroupIDs.has(group.id)}
                key={group.id}
                onCategoryDragLeave={sidebarInteractions.handleCategoryDragLeave(
                  group.id
                )}
                onCategoryDragOver={sidebarInteractions.handleCategoryDragOver(
                  group
                )}
                onCategoryDrop={sidebarInteractions.handleCategoryDrop(group)}
                onNoteDragEnd={sidebarInteractions.handleNoteDragEnd}
                onNoteDragStart={sidebarInteractions.handleNoteDragStart}
                onOpenNote={handleOpenNote}
                onToggle={() => toggleGroup(group.id)}
              />
            ))}
        </div>
      </div>
    </nav>
  )
}
