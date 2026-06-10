import { useEffect, useMemo, useState, type ChangeEvent, type JSX } from "react"

import { IoSearchSharp } from "react-icons/io5"
import { MdRefresh } from "react-icons/md"
import { useUsersStore } from "@/stores/useUsersStore"
import { useTranslation } from "react-i18next"
import { UserEntry } from "./UserEntry"
import { sortUsers, toFilteredUsers } from "./UserManagementPanel.helpers"
import { UserManagementSkeletonRows } from "./UserManagementSkeletonRows"

import styles from "./UserManagementPanel.module.css"

export function UserManagementPanel(): JSX.Element {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")

  const users = useUsersStore((s) => s.users)
  const storeState = useUsersStore((s) => s.state)
  const ensureLoaded = useUsersStore((s) => s.ensureLoaded)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const sortedUsers = useMemo(
    () => sortUsers(toFilteredUsers(users, search)),
    [search, users]
  )
  const isLoading = storeState === "NONE" || storeState === "LOADING"

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  return (
    <section className={styles.panel} aria-label={t("tooltips.labels.usersMng")}>
      <header className={styles.header}>
        <h3 className={styles.title}>
          {t("modals.usersMng.title", { val: users.length })}
        </h3>
        <div className={styles.searchContainer}>
          <IoSearchSharp className={styles.searchIcon} size={"1.25em"} />
          <input
            className={styles.searchInput}
            value={search}
            onChange={handleSearchChange}
            type="text"
            name="user-search"
            placeholder={t("placeholders.search")}
            autoComplete="off"
          />
        </div>
      </header>

      <div className={styles.division} />

      <div className={styles.userList} aria-busy={isLoading}>
        {isLoading ? (
          <UserManagementSkeletonRows />
        ) : storeState === "ERROR" ? (
          <div className={styles.state}>
            <p className={styles.stateText}>{t("modals.usersMng.loadError")}</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => void ensureLoaded()}
            >
              <MdRefresh size={"1.2em"} />
              {t("modals.usersMng.retry")}
            </button>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className={styles.state}>
            <p className={styles.stateText}>{t("modals.usersMng.empty")}</p>
          </div>
        ) : (
          sortedUsers.map((user) => <UserEntry key={user.id} user={user} />)
        )}
      </div>
    </section>
  )
}
