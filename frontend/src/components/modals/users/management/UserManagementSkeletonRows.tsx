import type { JSX } from "react"

import styles from "./UserManagementSkeletonRows.module.css"

type UserManagementSkeletonRowsProps = {
  count?: number
}

export function UserManagementSkeletonRows({
  count = 7
}: UserManagementSkeletonRowsProps): JSX.Element {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          className={styles.skeletonRow}
          data-testid="user-management-skeleton-row"
          key={index}
        >
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonText}>
            <div className={styles.skeletonName} />
            <div className={styles.skeletonMeta} />
          </div>
          <div className={styles.skeletonAction} />
        </div>
      ))}
    </>
  )
}
