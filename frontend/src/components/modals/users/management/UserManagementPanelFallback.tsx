import type { JSX } from "react"

import { UserManagementSkeletonRows } from "./UserManagementSkeletonRows"

import styles from "./UserManagementPanelFallback.module.css"

export function UserManagementPanelFallback(): JSX.Element {
  return (
    <div className={styles.fallback} aria-hidden="true">
      <div className={styles.header}>
        <div className={styles.title} />
        <div className={styles.search} />
      </div>
      <div className={styles.divider} />
      <div className={styles.rows}>
        <UserManagementSkeletonRows />
      </div>
    </div>
  )
}
