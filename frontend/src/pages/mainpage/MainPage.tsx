import { useEffect, useState, type JSX } from "react"
import { useNavigate } from "@tanstack/react-router"

import {
  Group,
  Panel,
  Separator,
  useDefaultLayout
} from "react-resizable-panels"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { EmptyDisplay } from "@/components/board/EmptyDisplay"
import { ContentBoard } from "@/components/board/ContentBoard"
import { LoaderContainer } from "@/components/LoaderContainer"
import { userService } from "@/services/userService"
import { useNoteStore } from "@/stores/useNotesStore"
import { toasts } from "@/utils/toastUtils"
import { isNumeric } from "@/utils/utils"
import { useSessionStore } from "@/stores/useSessionStore"
import { useTranslation } from "react-i18next"
import { useWebSocketManager } from "@/hooks/useWebSocketManager"
import { indexRouteApi } from "@/router/indexRouteApi"
import { createAsyncComponent } from "@/utils/createAsyncComponent"
import { useDelayedUnmount } from "@/hooks/useModalPresence"
import { UserManagementPanelFallback } from "@/components/modals/users/management/UserManagementPanelFallback"

import styles from "./MainPage.module.css"

const UserManagementPanel = createAsyncComponent(
  () => import("@/components/modals/users/management/UserManagementPanel"),
  (module) => module.UserManagementPanel
)
const USER_MANAGEMENT_PANEL_ANIMATION_MS = 240

export function MainPage(): JSX.Element {
  const { t } = useTranslation()
  const { id: activeNoteId } = indexRouteApi.useSearch()
  const navigate = useNavigate({ from: "/" })
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false)
  const shouldRenderUserManagement = useDelayedUnmount(
    isUserManagementOpen,
    USER_MANAGEMENT_PANEL_ANIMATION_MS
  )

  const setUser = useSessionStore((s) => s.setUser)
  const shownNote = useNoteStore((s) => s.shownNote)
  const isFetchingNote = useNoteStore((s) => s.isFetchingNote)
  const isRendering = useNoteStore((s) => s.isRendering)
  const openNote = useNoteStore((s) => s.openNote)
  const closeNote = useNoteStore((s) => s.closeNote)
  const isVideoNote = shownNote?.content?.endsWith("mp4")

  // Init WebSocket
  useWebSocketManager()

  useEffect(() => {
    async function handleNotesLoad() {
      if (!activeNoteId) {
        closeNote()
        return
      }

      const isNum = isNumeric(activeNoteId)
      if (!isNum) {
        void navigate({
          replace: true,
          search: (prev) => ({
            ...prev,
            id: undefined
          })
        })
        return
      }

      const resp = await openNote(activeNoteId)
      if (!resp?.errors) return

      if (resp.statusCode === 404) {
        toasts.error(t("errors.notes.notFound"))
      } else {
        toasts.apiError(t("errors.notes.cantOpen"), resp)
      }

      void navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          id: undefined
        })
      })
    }

    void handleNotesLoad()
  }, [activeNoteId, closeNote, navigate, openNote, t])

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "notes-layout-persistence",
    storage: localStorage
  })

  useEffect(() => {
    const loadSelfUser = async () => {
      const resp = await userService.getSelfUser()

      if (resp.success) {
        setUser(resp.data)
      } else {
        toasts.apiError("Failed to load self user data", resp)
      }
    }
    loadSelfUser()
  }, [setUser])

  useEffect(() => {
    const handleGlobalClose = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase()
      if (key && key === "escape" && !isInput(e.target as HTMLElement)) {
        void navigate({
          search: (prev) => ({
            ...prev,
            id: undefined
          })
        })
      }
    }
    window.addEventListener("keydown", handleGlobalClose)
    return () => window.removeEventListener("keydown", handleGlobalClose)
  }, [navigate])

  return (
    <>
      <title>{`${t("app.title")} - Anotações`}</title>

      <div className={styles.container}>
        {shouldRenderUserManagement && (
          <aside
            id="user-management-panel"
            className={styles.userManagementPanel}
            data-state={isUserManagementOpen ? "open" : "closing"}
            aria-hidden={!isUserManagementOpen}
          >
            <UserManagementPanel
              loadingFallback={<UserManagementPanelFallback />}
            />
          </aside>
        )}

        <Group
          orientation="horizontal"
          className={styles.workspaceGroup}
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          resizeTargetMinimumSize={{ fine: 0, coarse: 0 }}
          disableCursor
        >
          <Panel
            defaultSize={300}
            minSize={300}
            maxSize={400}
            className={styles.sidebarPanel}
          >
            <Sidebar
              isUserManagementOpen={isUserManagementOpen}
              onToggleUserManagement={() =>
                setIsUserManagementOpen((open) => !open)
              }
            />
          </Panel>

          <Separator className={styles.resizeHandle} />

          <Panel minSize={30}>
            <main className={styles.mainContent}>
              {isFetchingNote ? (
                <LoaderContainer />
              ) : shownNote ? (
                <ContentBoard note={shownNote} />
              ) : (
                <EmptyDisplay />
              )}

              {/* If we have the note data, but a media file is still rendering in the background */}
              {!isFetchingNote && isRendering && !isVideoNote && (
                <LoaderContainer />
              )}
            </main>
          </Panel>
        </Group>
      </div>
    </>
  )
}

function isInput(el: HTMLElement): boolean {
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA"
}
