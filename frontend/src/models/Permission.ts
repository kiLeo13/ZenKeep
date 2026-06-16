export class Permission {
  public readonly label: string
  public readonly offset: number
  public readonly raw: number

  private constructor(offset: number, label: string) {
    this.label = label
    this.offset = offset
    this.raw = 1 << offset
  }

  static readonly Administrator = new Permission(0, "perms.adm")
  static readonly CreateNotes = new Permission(1, "perms.createNotes")
  static readonly EditNotes = new Permission(2, "perms.editNotes")
  static readonly DeleteNotes = new Permission(3, "perms.deleteNotes")
  static readonly ManageUsers = new Permission(5, "perms.manageUsers")
  static readonly DeleteUsers = new Permission(6, "perms.deleteUsers")
  static readonly ManagePermissions = new Permission(7, "perms.managePerms")
  static readonly PunishUsers = new Permission(8, "perms.punishUsers")
  static readonly PerformLookup = new Permission(9, "perms.lookup")
  static readonly ReadAuditLogs = new Permission(10, "perms.readAuditLogs")
  static readonly ManageDepartments = new Permission(11, "perms.manageDepartments")
  static readonly GeneratePDFs = new Permission(12, "perms.generatePdfs")

  static get all(): Permission[] {
    return [
      Permission.Administrator,
      Permission.CreateNotes,
      Permission.EditNotes,
      Permission.DeleteNotes,
      Permission.ManageUsers,
      Permission.DeleteUsers,
      Permission.ManagePermissions,
      Permission.PunishUsers,
      Permission.PerformLookup,
      Permission.ReadAuditLogs,
      Permission.ManageDepartments,
      Permission.GeneratePDFs
    ]
  }

  static hasRaw(userMask: number, permission: Permission): boolean {
    return (userMask & permission.raw) === permission.raw
  }

  static hasEffective(userMask: number, permission: Permission): boolean {
    return (
      Permission.hasRaw(userMask, Permission.Administrator) ||
      Permission.hasRaw(userMask, permission)
    )
  }

  static toArray(mask: number): Permission[] {
    return Permission.all.filter((perm) => Permission.hasRaw(mask, perm))
  }

  /**
   * Checks if a specific permission state differs between two masks.
   * Returns `true` if the permission was added OR removed.
   */
  static changed(
    maskA: number,
    maskB: number,
    perm: Permission
  ): boolean {
    return ((maskA ^ maskB) & perm.raw) !== 0
  }
}
