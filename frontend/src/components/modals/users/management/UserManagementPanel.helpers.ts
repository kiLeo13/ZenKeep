import type { UserResponseData } from "@/types/api/users"

import { matchSorter } from "match-sorter"

import { Permission } from "@/models/Permission"

export function sortUsers(users: UserResponseData[]): UserResponseData[] {
  return [...users].sort((user, nextUser) => {
    const userIsAdmin = Permission.hasEffective(
      user.permissions,
      Permission.Administrator
    )
    const nextUserIsAdmin = Permission.hasEffective(
      nextUser.permissions,
      Permission.Administrator
    )

    if (userIsAdmin && !nextUserIsAdmin) return -1
    if (!userIsAdmin && nextUserIsAdmin) return 1

    return user.username.localeCompare(nextUser.username)
  })
}

export function toFilteredUsers(
  users: UserResponseData[],
  search: string
): UserResponseData[] {
  if (!search.trim()) return users

  return matchSorter(users, search, { keys: ["username"] })
}
