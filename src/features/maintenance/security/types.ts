export interface Department {
  code: string
  description: string | null
  users: number
}

export interface UserSummary {
  code: string
  name: string | null
  lgCode: string | null
  department: string | null
  serviceProvider: string | null
  status: string | null
  authorisedStatus: string | null
}

export interface UserDetail extends UserSummary {
  dateCreated: string | null
  granted: number[]
}

export interface AccessEntry {
  position: number
  tab: string
  group: string
  caption: string
}

export interface CodeName {
  code: string
  name: string | null
}

export interface SecurityLookups {
  departments: CodeName[]
  serviceProviders: CodeName[]
  matrix: AccessEntry[]
}

/** Role Management fields; a blank password keeps the current one when editing. */
export interface RoleUserRequest {
  code: string
  name: string
  password: string
  department: string
  status: string
  dateCreated: string
}

export interface PermissionUserRequest extends RoleUserRequest {
  lgCode: string
  serviceProvider: string
  authorisedStatus: string
  granted: number[]
}
