import { NOTE_MAX_SIZE_BYTES_RAW } from "@/services/noteService"
import { getPrettySize } from "@/utils/utils"
import { declarationSectionId } from "./apiReferenceIds"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type InlineTextPart =
  | string
  | {
      hash?: string
      label: string
      href?: string
      resourceId?: string
      sectionId?: string
    }

export type CalloutTone = "info" | "warning" | "danger"

export type ApiCallout = {
  tone: CalloutTone
  text: InlineTextPart[]
}

export type ApiField = {
  name: string
  type: string
  description: InlineTextPart[]
}

export type ApiExample = {
  label?: string
  language?: string
  code: string
}

export type ApiTopic = {
  id: string
  title: string
  description?: InlineTextPart[]
  callouts?: ApiCallout[]
  fields?: ApiField[]
  examples?: ApiExample[]
}

export type ApiRoute = {
  id: string
  method: HttpMethod
  path: string
  title: string
  auth: "Public" | "Bearer JWT"
  description: InlineTextPart[][]
  callouts?: ApiCallout[]
  pathParams?: ApiField[]
  queryParams?: ApiField[]
  requestBody?: ApiField[]
  responses: {
    status: number
    description: InlineTextPart[]
  }[]
}

export type ApiResource = {
  id: string
  name: string
  navLabel?: string
  objectName: string
  description: InlineTextPart[]
  callouts?: ApiCallout[]
  declarations?: ApiDeclaration[]
  fields: ApiField[]
  routes: ApiRoute[]
}

export type ApiDeclaration = {
  id: string
  title: string
  description?: InlineTextPart[]
  fields: ApiField[]
}

export type GatewayEvent = {
  id: string
  type: string
  description: InlineTextPart[]
  dataFields: ApiField[]
  callouts?: ApiCallout[]
  returns?: InlineTextPart[]
}

export type GatewayEventGroup = {
  id: string
  navLabel: string
  title: string
  description: InlineTextPart[]
  events: GatewayEvent[]
}

const apiUrl = import.meta.env.VITE_API_BASE_URL
export const apiBaseUrl = apiUrl.slice(0, apiUrl.lastIndexOf("/"))

const noteTypeDeclarationHash = declarationSectionId("note", "note-type")
const departmentIconTypeDeclarationHash = declarationSectionId(
  "department",
  "icon-type"
)

export const apiTopics: ApiTopic[] = [
  {
    id: "base-url",
    title: "Base URL",
    examples: [
      {
        code: apiBaseUrl + "/v{version}",
        language: "curl"
      }
    ]
  },
  {
    id: "api-versioning",
    title: "API Versioning",
    description: [
      "As of now, ZenKeep has only one version, at ",
      { label: "/v1" },
      " stage. This way, you should invoke all endpoints with the following syntax: ",
      { label: "/v1/{endpoint}" },
      "."
    ]
  },
  {
    id: "authorization",
    title: "Authorization",
    description: [
      "Almost all routes in this application require authentication via an ",
      { label: "Authorization" },
      " header containing a bearer JWT. Public routes will contain a disclaimer below it."
    ],
    callouts: [
      {
        tone: "info",
        text: [
          "Requests that do not provide a valid bearer token will fail with a ",
          { label: "401 Unauthorized" },
          "."
        ]
      }
    ],
    examples: [
      {
        label: "Authenticated request",
        language: "http",
        code: "Authorization: Bearer <id_token>"
      }
    ]
  },
  {
    id: "serialization",
    title: "ID Serialization",
    description: [
      "Internal platform IDs are ",
      { label: "Sonyflake", href: "https://github.com/sony/sonyflake" },
      " ",
      { label: "int64" },
      " values, but the API always returns them as decimal strings to avoid integer overflow or precision loss in clients and languages with smaller integer ranges. Clients should treat every ",
      { label: "id" },
      ", ",
      { label: "*_id" },
      ", ",
      { label: "event_id" },
      ", and cursor field as a string."
    ],
    fields: [
      {
        name: "id",
        type: "string",
        description: [
          "Decimal string representation of a backend int64 ID. Do not parse it as a JavaScript number."
        ]
      },
      {
        name: "ID bit layout",
        type: "int64",
        description: [
          "Sonyflake layout: 39 timestamp bits, 8 sequence bits, and 16 machine ID bits. The encoded value is ",
          { label: "(timestamp << 24) | (sequence << 16) | machine_id" },
          "."
        ]
      },
      {
        name: "timestamp",
        type: "39-bit offset",
        description: [
          "Elapsed 10 millisecond units since ",
          { label: "2025-01-01T00:00:00Z" },
          ". To resolve the approximate creation time, extract the timestamp bits, multiply by 10 milliseconds, and add the result to that UTC base date."
        ]
      },
      {
        name: "machine_id",
        type: "16-bit integer",
        description: [
          "Resolved from SONYFLAKE_MACHINE_ID when configured, otherwise the legacy AUDIT_MACHINE_ID, otherwise a stable host-derived fallback."
        ]
      },
      {
        name: "created_at / updated_at",
        type: "string",
        description: ["ISO 8601 date-time string."]
      }
    ],
    examples: [
      {
        label: "Timestamp from ID - Python Example",
        language: "python",
        code: `from datetime import datetime, timedelta, timezone

raw_id = "123456789012345678"
timestamp_units = int(raw_id) >> 24 # high 39 bits
created_at_utc = datetime(2025, 1, 1, tzinfo=timezone.utc) + timedelta(
    milliseconds=timestamp_units * 10 # Sonyflake uses 10ms units
)

print(created_at_utc.isoformat()) # 2025-03-26T14:33:12.340000+00:00`
      }
    ]
  },
  {
    id: "errors",
    title: "Error Messages",
    description: [
      "Errors return either a simple message object or a structured validation object. Clients should support both shapes."
    ],
    fields: [
      {
        name: "message",
        type: "string",
        description: ["Human-readable API error message."]
      },
      {
        name: "errors",
        type: "Record<string, string[]>",
        description: ["Validation errors grouped by request field."]
      }
    ],
    examples: [
      {
        label: "Validation error",
        language: "json",
        code: `{
  "errors": {
    "email": ["Value must be a valid email address"]
  }
}`
      }
    ]
  },
  {
    id: "pagination",
    title: "Pagination",
    description: [
      "Audit logs use cursor pagination. Send ",
      { label: "limit" },
      " and optionally ",
      { label: "before_id" },
      ". The next cursor is returned as ",
      { label: "next_before_id" },
      "."
    ],
    fields: [
      {
        name: "limit",
        type: "integer",
        description: ["Maximum number of entries to return."]
      },
      {
        name: "before_id?",
        type: "string",
        description: ["Return entries older than this audit log ID."]
      },
      {
        name: "next_before_id",
        type: "string?",
        description: ["Cursor for the next page when more results exist."]
      }
    ]
  },
  {
    id: "gateway",
    title: "Gateway (WebSocket) API",
    description: [
      "Realtime messages are typed envelopes. Clients connect with a stable ",
      { label: "session_id" },
      " and the last applied ",
      { label: "last_event_id" },
      " so missed events can be replayed."
    ],
    callouts: [
      {
        tone: "info",
        text: [
          "Hidden tabs only send pings while visible. Reconnect behavior relies on session resumption and ordered replay."
        ]
      }
    ]
  }
]

export const apiResources: ApiResource[] = [
  {
    id: "user",
    name: "User",
    objectName: "User Object",
    description: [
      "Represents a ZenKeep user account, permission bitmask, verification state, and current presence."
    ],
    fields: [
      { name: "id", type: "string", description: ["User platform ID."] },
      { name: "username", type: "string", description: ["Display name."] },
      {
        name: "permissions",
        type: "integer",
        description: ["Permission bitmask."]
      },
      {
        name: "presence",
        type: "ONLINE | OFFLINE",
        description: ["Current realtime presence."]
      },
      {
        name: "is_verified?",
        type: "boolean",
        description: ["Returned when verification state is included."]
      },
      {
        name: "suspended?",
        type: "boolean",
        description: ["Returned when suspension state is included."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    routes: [
      {
        id: "login-user",
        method: "POST",
        path: "/users/login",
        title: "Login",
        auth: "Public",
        description: [
          [
            "Authenticates a user with email and password. Returns a token pair."
          ]
        ],
        requestBody: [
          {
            name: "email",
            type: "string",
            description: ["User email address."]
          },
          { name: "password", type: "string", description: ["User password."] }
        ],
        responses: [
          {
            status: 200,
            description: ["Returns access_token and id_token."]
          },
          {
            status: 400,
            description: ["Credentials mismatch or malformed body."]
          }
        ]
      },
      {
        id: "create-user",
        method: "POST",
        path: "/users",
        title: "Create User",
        auth: "Public",
        description: [
          ["Creates a user account and starts the confirmation flow."]
        ],
        requestBody: [
          {
            name: "username",
            type: "string",
            description: ["Display name, 2 to 80 characters."]
          },
          {
            name: "email",
            type: "string",
            description: ["Valid email address."]
          },
          {
            name: "password",
            type: "string",
            description: [
              "Password meeting backend validator rules."
            ]
          }
        ],
        responses: [
          { status: 201, description: ["User was created."] },
          {
            status: 400,
            description: ["Validation or identity provider error."]
          }
        ]
      },
      {
        id: "list-users",
        method: "GET",
        path: "/users",
        title: "List Users",
        auth: "Bearer JWT",
        description: [
          [
            "Lists users visible to the authenticated requester. Returns an array of ",
            { label: "user", resourceId: "user" },
            " objects."
          ]
        ],
        responses: [
          {
            status: 200,
            description: ["Returns users wrapped in a users property."]
          },
          { status: 401, description: ["Missing or invalid bearer token."] }
        ]
      },
      {
        id: "get-user",
        method: "GET",
        path: "/users/{id}",
        title: "Get User",
        auth: "Bearer JWT",
        description: [
          [
            "Fetches one user by platform ID. Returns a ",
            { label: "user", resourceId: "user" },
            " object."
          ]
        ],
        pathParams: [
          { name: "id", type: "string", description: ["User platform ID."] }
        ],
        responses: [
          { status: 200, description: ["User found."] },
          {
            status: 404,
            description: ["User was not found or is not visible."]
          }
        ]
      },
      {
        id: "update-user",
        method: "PATCH",
        path: "/users/{id}",
        title: "Update User",
        auth: "Bearer JWT",
        description: [
          [
            "Updates mutable user fields permitted by the requester. Returns the updated ",
            { label: "User", resourceId: "user" },
            " object."
          ]
        ],
        callouts: [
          {
            tone: "warning",
            text: [
              "Permission and suspension changes require elevated permissions."
            ]
          }
        ],
        pathParams: [
          {
            name: "id",
            type: "string",
            description: ["Target user platform ID."]
          }
        ],
        requestBody: [
          {
            name: "username?",
            type: "string",
            description: ["New display name."]
          },
          {
            name: "permissions?",
            type: "integer",
            description: ["Permission bitmask."]
          },
          {
            name: "suspended?",
            type: "boolean",
            description: ["Suspension state."]
          }
        ],
        responses: [
          { status: 200, description: ["User updated."] },
          { status: 403, description: ["Requester lacks permission."] }
        ]
      },
      {
        id: "delete-user",
        method: "DELETE",
        path: "/users/{id}",
        title: "Delete User",
        auth: "Bearer JWT",
        description: [["Deletes a user account when policy allows it."]],
        pathParams: [
          {
            name: "id",
            type: "string",
            description: ["Target user platform ID."]
          }
        ],
        responses: [
          { status: 204, description: ["User deleted."] },
          { status: 403, description: ["Requester cannot delete this user."] }
        ]
      }
    ]
  },
  {
    id: "department",
    name: "Department",
    objectName: "Department Object",
    description: [
      "Represents a note scope used to group operational content for one or more teams. Notes can be general or assigned to exactly one department; users can belong to many departments."
    ],
    fields: [
      { name: "id", type: "string", description: ["Department platform ID."] },
      {
        name: "name",
        type: "string",
        description: ["Department display name, unique across the workspace."]
      },
      {
        name: "icon_type",
        type: "Department Icon Type",
        description: [
          "How the icon should be rendered. See ",
          {
            label: "Department Icon Type",
            resourceId: "department",
            hash: departmentIconTypeDeclarationHash
          },
          "."
        ]
      },
      {
        name: "icon_value",
        type: "string",
        description: [
          "Emoji character for ",
          { label: "EMOJI" },
          " icons, or stored image filename for ",
          { label: "IMAGE" },
          " icons. Empty when icon_type is ",
          { label: "NONE" },
          "."
        ]
      },
      {
        name: "color_rgba",
        type: "integer | null",
        description: [
          "Optional department text color as a 32-bit RGBA integer in 0xRRGGBBAA order. Null means the client should use its default sidebar text color."
        ]
      },
      {
        name: "note_count",
        type: "integer",
        description: ["Number of notes currently assigned to this department."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    declarations: [
      {
        id: "icon-type",
        title: "Department Icon Type",
        description: ["Determines how the department icon value is interpreted."],
        fields: [
          {
            name: "NONE",
            type: "string",
            description: ["Render the department as text only, with no icon."]
          },
          {
            name: "EMOJI",
            type: "string",
            description: ["Use icon_value as the department emoji."]
          },
          {
            name: "IMAGE",
            type: "string",
            description: [
              "Use icon_value as an uploaded raster image filename under department icon storage."
            ]
          }
        ]
      },
      {
        id: "membership",
        title: "Department Membership",
        description: [
          "Represents a user-to-department edge. Memberships are returned separately from departments so user objects and department objects each keep a single source of truth."
        ],
        fields: [
          {
            name: "department_id",
            type: "string",
            description: ["Department platform ID."]
          },
          {
            name: "user_id",
            type: "string",
            description: ["User platform ID."]
          }
        ]
      }
    ],
    routes: [
      {
        id: "list-departments",
        method: "GET",
        path: "/departments",
        title: "List Departments",
        auth: "Bearer JWT",
        description: [
          [
            "Lists departments visible to the authenticated requester. Admins and users with ",
            { label: "Manage Departments" },
            " receive every department; other users receive only departments they belong to."
          ]
        ],
        responses: [
          {
            status: 200,
            description: ["Returns departments wrapped in a departments property."]
          }
        ]
      },
      {
        id: "create-department",
        method: "POST",
        path: "/departments",
        title: "Create Department",
        auth: "Bearer JWT",
        description: [
          [
            "Creates a department. Requires ",
            { label: "Manage Departments" },
            " permission."
          ]
        ],
        callouts: [
          {
            tone: "info",
            text: [
              "Image icons must use ",
              { label: "multipart/form-data" },
              " with department metadata in ",
              { label: "json_payload" },
              " and the file in ",
              { label: "icon" },
              ". Text-only and emoji departments can use JSON. Uploaded image icons must be at most 512 KiB."
            ]
          }
        ],
        requestBody: [
          {
            name: "name",
            type: "string",
            description: ["Department name, 2 to 80 characters."]
          },
          {
            name: "icon_type",
            type: "Department Icon Type",
            description: ["Either NONE, EMOJI, or IMAGE."]
          },
          {
            name: "icon_value?",
            type: "string",
            description: ["Emoji value for emoji icons."]
          },
          {
            name: "color_rgba?",
            type: "integer | null",
            description: ["Optional 32-bit RGBA text color in 0xRRGGBBAA order."]
          },
          {
            name: "json_payload?",
            type: "string",
            description: ["Required multipart metadata for uploaded image icons."]
          },
          {
            name: "icon?",
            type: "file",
            description: ["Raster image file for IMAGE icons. Accepted types: png, jpg, jpeg, webp, gif. Maximum size: 512 KiB."]
          }
        ],
        responses: [
          { status: 201, description: ["Department created."] },
          { status: 403, description: ["Requester cannot manage departments."] },
          { status: 415, description: ["Unsupported content type."] }
        ]
      },
      {
        id: "list-department-memberships",
        method: "GET",
        path: "/departments/users",
        title: "List Department Memberships",
        auth: "Bearer JWT",
        description: [
          [
            "Lists every department membership edge. Requires both ",
            { label: "Manage Departments" },
            " and ",
            { label: "Manage Users" },
            " permissions."
          ]
        ],
        responses: [
          {
            status: 200,
            description: ["Returns memberships wrapped in a memberships property."]
          },
          { status: 403, description: ["Requester lacks one of the required permissions."] }
        ]
      },
      {
        id: "update-department",
        method: "PATCH",
        path: "/departments/{department_id}",
        title: "Update Department",
        auth: "Bearer JWT",
        description: [
          [
            "Updates department name, icon, or sidebar text color. Requires ",
            { label: "Manage Departments" },
            " permission."
          ]
        ],
        pathParams: [
          {
            name: "department_id",
            type: "string",
            description: ["Department platform ID."]
          }
        ],
        requestBody: [
          { name: "name?", type: "string", description: ["Replacement department name."] },
          {
            name: "icon_type?",
            type: "Department Icon Type",
            description: ["Replacement icon mode."]
          },
          {
            name: "icon_value?",
            type: "string",
            description: ["Replacement emoji value for emoji icons."]
          },
          {
            name: "color_rgba?",
            type: "integer | null",
            description: ["Replacement 32-bit RGBA text color. Send null to clear the custom color."]
          },
          {
            name: "json_payload?",
            type: "string",
            description: ["Required multipart metadata for uploaded replacement image icons."]
          },
          {
            name: "icon?",
            type: "file",
            description: ["Replacement raster image file for IMAGE icons. Maximum size: 512 KiB."]
          }
        ],
        responses: [
          { status: 200, description: ["Department updated."] },
          { status: 403, description: ["Requester cannot manage departments."] },
          { status: 404, description: ["Department not found."] }
        ]
      },
      {
        id: "delete-department",
        method: "DELETE",
        path: "/departments/{department_id}",
        title: "Delete Department",
        auth: "Bearer JWT",
        description: [
          [
            "Deletes a department only when no notes still reference it. Requires ",
            { label: "Manage Departments" },
            " permission."
          ]
        ],
        pathParams: [
          {
            name: "department_id",
            type: "string",
            description: ["Department platform ID."]
          }
        ],
        responses: [
          { status: 204, description: ["Department deleted."] },
          { status: 403, description: ["Requester cannot manage departments."] },
          { status: 409, description: ["Department still has notes. Move or delete those notes first."] }
        ]
      },
      {
        id: "add-department-user",
        method: "PUT",
        path: "/departments/{department_id}/users/{user_id}",
        title: "Add Department Member",
        auth: "Bearer JWT",
        description: [
          [
            "Adds one user to one department. Requires both ",
            { label: "Manage Departments" },
            " and ",
            { label: "Manage Users" },
            " permissions."
          ]
        ],
        pathParams: [
          { name: "department_id", type: "string", description: ["Department platform ID."] },
          { name: "user_id", type: "string", description: ["User platform ID."] }
        ],
        responses: [
          { status: 204, description: ["Membership exists after the request."] },
          { status: 403, description: ["Requester lacks one of the required permissions."] }
        ]
      },
      {
        id: "remove-department-user",
        method: "DELETE",
        path: "/departments/{department_id}/users/{user_id}",
        title: "Remove Department Member",
        auth: "Bearer JWT",
        description: [
          [
            "Removes one user from one department. Requires both ",
            { label: "Manage Departments" },
            " and ",
            { label: "Manage Users" },
            " permissions."
          ]
        ],
        pathParams: [
          { name: "department_id", type: "string", description: ["Department platform ID."] },
          { name: "user_id", type: "string", description: ["User platform ID."] }
        ],
        responses: [
          { status: 204, description: ["Membership no longer exists after the request."] },
          { status: 403, description: ["Requester lacks one of the required permissions."] }
        ]
      },
      {
        id: "bulk-move-department-notes",
        method: "POST",
        path: "/departments/{department_id}/notes/bulk-move",
        title: "Bulk Move Department Notes",
        auth: "Bearer JWT",
        description: [
          [
            "Moves every note in a source department to another department or to General. Requires ",
            { label: "Manage Departments" },
            " and ",
            { label: "Edit Notes" },
            " permissions."
          ]
        ],
        pathParams: [
          { name: "department_id", type: "string", description: ["Source department platform ID."] }
        ],
        requestBody: [
          {
            name: "target_department_id",
            type: "string | null",
            description: ["Target department ID, or null to move the notes to General."]
          }
        ],
        responses: [
          { status: 204, description: ["Matching notes were moved."] },
          { status: 403, description: ["Requester lacks one of the required permissions."] },
          { status: 404, description: ["Source or target department was not found."] }
        ]
      },
      {
        id: "bulk-delete-department-notes",
        method: "POST",
        path: "/departments/{department_id}/notes/bulk-delete",
        title: "Bulk Delete Department Notes",
        auth: "Bearer JWT",
        description: [
          [
            "Deletes every note in a department. Requires ",
            { label: "Manage Departments" },
            " and ",
            { label: "Delete Notes" },
            " permissions."
          ]
        ],
        pathParams: [
          { name: "department_id", type: "string", description: ["Source department platform ID."] }
        ],
        responses: [
          { status: 204, description: ["Matching notes were deleted."] },
          { status: 403, description: ["Requester lacks one of the required permissions."] }
        ]
      }
    ]
  },
  {
    id: "note",
    name: "Note",
    objectName: "Note Object",
    description: [
      "Represents a Markdown, flowchart, or reference note visible to the requester. A note can be assigned to one department or left without a department as General content."
    ],
    fields: [
      { name: "id", type: "string", description: ["Note platform ID."] },
      { name: "name", type: "string", description: ["Note name."] },
      {
        name: "content?",
        type: "string",
        description: [
          "Text content or reference file identifier, depending on ",
          {
            label: "Note Type",
            resourceId: "note",
            hash: noteTypeDeclarationHash
          },
          "."
        ]
      },
      { name: "tags", type: "string array", description: ["Note tags."] },
      {
        name: "department_id",
        type: "string | null",
        description: [
          "Department scope for the note. Null means the note is General content."
        ]
      },
      {
        name: "note_type",
        type: "Note Type",
        description: [
          "Rendering and storage mode. See ",
          {
            label: "Note Type",
            resourceId: "note",
            hash: noteTypeDeclarationHash
          },
          "."
        ]
      },
      {
        name: "content_size",
        type: "integer",
        description: ["Content size in bytes."]
      },
      {
        name: "created_by_id",
        type: "string",
        description: ["Creator user ID."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    declarations: [
      {
        id: "note-type",
        title: "Note Type",
        description: [
          "Determines how the note content is stored and rendered."
        ],
        fields: [
          {
            name: "MARKDOWN",
            type: "string",
            description: ["Text note rendered with Markdown."]
          },
          {
            name: "FLOWCHART",
            type: "string",
            description: ["Text note rendered as a Mermaid flowchart."]
          },
          {
            name: "REFERENCE",
            type: "string",
            description: [
              "File-backed note rendered according to the uploaded attachment type."
            ]
          }
        ]
      }
    ],
    routes: [
      {
        id: "list-notes",
        method: "GET",
        path: "/notes",
        title: "List Notes",
        auth: "Bearer JWT",
        description: [
          [
            "Lists notes visible to the authenticated user. Returns an array of ",
            { label: "note", resourceId: "note" },
            " objects."
          ]
        ],
        responses: [
          {
            status: 200,
            description: [
              "Returns an array of notes in a ",
              { label: "notes" },
              " property."
            ]
          }
        ]
      },
      {
        id: "create-note",
        method: "POST",
        path: "/notes",
        title: "Create Note",
        auth: "Bearer JWT",
        description: [
          [
            "Creates a new note. Returns the created ",
            { label: "note", resourceId: "note" },
            " object. Requires ",
            { label: "Create Notes" },
            " permission."
          ]
        ],
        callouts: [
          {
            tone: "info",
            text: [
              "File uploads must use ",
              { label: "multipart/form-data" },
              " header and pass all attributes through ",
              { label: "json_payload" },
              " parameter."
            ]
          },
          {
            tone: "warning",
            text: [
              "All notes are limited to ",
              { label: `${getPrettySize(NOTE_MAX_SIZE_BYTES_RAW)}` },
              ". That is, text notes don't have a character limit as of now."
            ]
          }
        ],
        requestBody: [
          {
            name: "name",
            type: "string",
            description: ["Note name, 2 to 80 characters."]
          },
          {
            name: "content?",
            type: "string",
            description: [
              "Required for ",
              { label: "MARKDOWN" },
              " and ",
              { label: "FLOWCHART" },
              " ",
              {
                label: "Note Type",
                resourceId: "note",
                hash: noteTypeDeclarationHash
              },
              " values."
            ]
          },
          {
            name: "note_type?",
            type: "Note Type",
            description: [
              "Required for JSON text notes. Must be ",
              { label: "MARKDOWN" },
              " or ",
              { label: "FLOWCHART" },
              "."
            ]
          },
          {
            name: "department_id?",
            type: "string | null",
            description: [
              "Department ID to assign the note to. Omit or send null to create a General note."
            ]
          },
          {
            name: "json_payload?",
            type: "string",
            description: [
              "Required multipart metadata for uploaded reference notes."
            ]
          },
          {
            name: "content?",
            type: "file",
            description: ["Required multipart file part for reference notes."]
          }
        ],
        responses: [
          { status: 201, description: ["Note created."] },
          { status: 415, description: ["Unsupported content type."] }
        ]
      },
      {
        id: "get-note",
        method: "GET",
        path: "/notes/{id}",
        title: "Get Note",
        auth: "Bearer JWT",
        description: [
          [
            "Fetches one note by platform ID. Returns a full ",
            { label: "note", resourceId: "note" },
            " object."
          ]
        ],
        pathParams: [
          { name: "id", type: "string", description: ["Note platform ID."] }
        ],
        responses: [
          { status: 200, description: ["Note found."] },
          {
            status: 404,
            description: ["Note was not found or is not visible."]
          }
        ]
      },
      {
        id: "update-note",
        method: "PATCH",
        path: "/notes/{id}",
        title: "Update Note",
        auth: "Bearer JWT",
        description: [
          [
            "Updates note metadata. Returns the updated ",
            { label: "note", resourceId: "note" },
            " object."
          ],
          [
            "This endpoint usually fires a ",
            { label: "Note Updated" },
            " event. However, if the department scope change removes a recipient's access, that recipient receives a ",
            { label: "Note Deleted" },
            " event. If the update grants access to a recipient, that recipient receives a ",
            { label: "Note Created" },
            " event."
          ],
          ["Note content cannot be updated."]
        ],
        requestBody: [
          { name: "name?", type: "string", description: ["Note name."] },
          {
            name: "tags?",
            type: "string array",
            description: ["Replacement tag list."]
          },
          {
            name: "department_id?",
            type: "string | null",
            description: [
              "Replacement department ID, or null to move the note to General."
            ]
          }
        ],
        responses: [
          { status: 200, description: ["Note updated."] },
          { status: 403, description: ["Requester cannot edit the note."] }
        ]
      },
      {
        id: "delete-note",
        method: "DELETE",
        path: "/notes/{id}",
        title: "Delete Note",
        auth: "Bearer JWT",
        description: [
          ["Deletes a note by ID. Returns a 204 empty response on success."]
        ],
        responses: [
          { status: 204, description: ["Note deleted."] },
          {
            status: 404,
            description: [
              "Note not found or user does not have permission to see it."
            ]
          },
          { status: 403, description: ["Requester cannot delete the note."] }
        ]
      }
    ]
  },
  {
    id: "audit-logs",
    name: "Audit Log",
    navLabel: "AuditLogs",
    objectName: "Audit Log Object",
    description: [
      "Represents an immutable audit event with zero or more field-level changes."
    ],
    fields: [
      { name: "id", type: "string", description: ["Audit event ID."] },
      {
        name: "actor_user_id",
        type: "string?",
        description: ["User that performed the action, when available."]
      },
      {
        name: "action_type",
        type: "NOTE_CREATE | NOTE_UPDATE | NOTE_DELETE | USER_UPDATE | USER_SUSPEND | USER_UNSUSPEND | USER_DELETE | COMPANY_LOOKUP | DEPARTMENT_CREATE | DEPARTMENT_UPDATE | DEPARTMENT_DELETE | DEPARTMENT_MEMBERSHIP_ADD | DEPARTMENT_MEMBERSHIP_REMOVE | DEPARTMENT_NOTES_BULK_MOVE | DEPARTMENT_NOTES_BULK_DELETE",
        description: ["Action discriminator, including department management and department note bulk actions."]
      },
      {
        name: "subject_type",
        type: "NOTE | USER | COMPANY | DEPARTMENT",
        description: ["Audited resource kind."]
      },
      {
        name: "subject_id",
        type: "string",
        description: ["Audited resource ID or business identifier."]
      },
      { name: "source", type: "string", description: ["Event source."] },
      {
        name: "occurred_at",
        type: "string",
        description: ["Event timestamp."]
      },
      {
        name: "changes",
        type: "AuditLogChange array",
        description: ["Field-level change list."]
      }
    ],
    routes: [
      {
        id: "list-audit-logs",
        method: "GET",
        path: "/audit-logs",
        title: "List Audit Logs",
        auth: "Bearer JWT",
        description: [
          [
            "Lists audit events newest first with cursor pagination. Returns an array of ",
            { label: "audit log", resourceId: "audit-logs" },
            " objects and an optional ",
            { label: "next_before_id" },
            " cursor."
          ]
        ],
        queryParams: [
          {
            name: "limit?",
            type: "integer",
            description: ["Maximum page size."]
          },
          {
            name: "before_id?",
            type: "string",
            description: ["Cursor for older entries."]
          },
          {
            name: "actor_user_id?",
            type: "string",
            description: ["Filter by actor user ID."]
          },
          {
            name: "subject_type?",
            type: "NOTE | USER | COMPANY | DEPARTMENT",
            description: ["Filter by audited subject type."]
          },
          {
            name: "action_type?",
            type: "string",
            description: ["Filter by action type."]
          }
        ],
        responses: [
          { status: 200, description: ["Audit entries returned."] },
          { status: 403, description: ["Requester cannot read audit logs."] }
        ]
      }
    ]
  },
  {
    id: "company",
    name: "Company",
    objectName: "Company Object",
    description: [
      "Represents a CNPJ lookup response from cache or the lookup provider."
    ],
    fields: [
      { name: "cnpj", type: "string", description: ["Company CNPJ."] },
      {
        name: "legal_name",
        type: "string",
        description: ["Registered legal name."]
      },
      {
        name: "trade_name?",
        type: "string",
        description: ["Trade name, when present."]
      },
      {
        name: "registration",
        type: "object",
        description: ["Registration status, reason, and date."]
      },
      { name: "address", type: "object", description: ["Registered address."] },
      {
        name: "partners",
        type: "CompanyPartner array",
        description: ["Known company partners."]
      },
      {
        name: "cached",
        type: "boolean",
        description: [
          "Whether this successful response was served from the local company cache. Fresh provider responses return false; later successful lookups for the same CNPJ can return true."
        ]
      }
    ],
    routes: [
      {
        id: "get-company",
        method: "GET",
        path: "/misc/cnpj/{cnpj}",
        title: "Get Company by CNPJ",
        auth: "Bearer JWT",
        description: [
          [
            "Looks up a Brazilian company by CNPJ. Returns a ",
            { label: "company", resourceId: "company" },
            " object."
          ]
        ],
        pathParams: [
          {
            name: "cnpj",
            type: "string",
            description: ["Fourteen-digit CNPJ."]
          }
        ],
        responses: [
          {
            status: 200,
            description: [
              "Company found through the lookup provider or returned from local cache."
            ]
          },
          { status: 404, description: ["Company was not found."] }
        ]
      }
    ]
  }
]

export const gatewayEvents: GatewayEvent[] = [
  {
    id: "note-created",
    type: "NOTE_CREATED",
    description: [
      "Dispatched when a new note is created and visible to the receiving user."
    ],
    dataFields: [
      { name: "id", type: "string", description: ["Note platform ID."] },
      { name: "name", type: "string", description: ["Note name."] },
      { name: "tags", type: "string array", description: ["Note tags."] },
      {
        name: "department_id",
        type: "string | null",
        description: [
          "Department scope for the note. Null means General content."
        ]
      },
      {
        name: "note_type",
        type: "Note Type",
        description: [
          "Rendering and storage mode. See ",
          {
            label: "Note Type",
            resourceId: "note",
            hash: noteTypeDeclarationHash
          },
          "."
        ]
      },
      {
        name: "content_size",
        type: "integer",
        description: ["Content size in bytes."]
      },
      {
        name: "created_by_id",
        type: "string",
        description: ["Creator user ID."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    returns: ["A full ", { label: "note", resourceId: "note" }, " object."]
  },
  {
    id: "note-updated",
    type: "NOTE_UPDATED",
    description: [
      "Dispatched when a note visible to the receiving user is updated."
    ],
    dataFields: [
      { name: "id", type: "string", description: ["Note platform ID."] },
      { name: "name", type: "string", description: ["Note name."] },
      { name: "tags", type: "string array", description: ["Note tags."] },
      {
        name: "department_id",
        type: "string | null",
        description: [
          "Department scope for the note. Null means General content."
        ]
      },
      {
        name: "note_type",
        type: "Note Type",
        description: [
          "Rendering and storage mode. See ",
          {
            label: "Note Type",
            resourceId: "note",
            hash: noteTypeDeclarationHash
          },
          "."
        ]
      },
      {
        name: "content_size",
        type: "integer",
        description: ["Content size in bytes."]
      },
      {
        name: "created_by_id",
        type: "string",
        description: ["Creator user ID."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    returns: [
      "A full ",
      { label: "note", resourceId: "note" },
      " object with updated fields."
    ]
  },
  {
    id: "note-deleted",
    type: "NOTE_DELETED",
    description: [
      "Dispatched when a note is deleted or leaves the receiving user's department scope."
    ],
    dataFields: [
      { name: "id", type: "string", description: ["Deleted note platform ID."] }
    ],
    returns: [
      "An object containing only the ",
      { label: "id" },
      " of the deleted note."
    ]
  },
  {
    id: "department-created",
    type: "DEPARTMENT_CREATED",
    description: [
      "Dispatched when a department is created and visible to the receiving user."
    ],
    dataFields: [
      { name: "id", type: "string", description: ["Department platform ID."] },
      { name: "name", type: "string", description: ["Department display name."] },
      {
        name: "icon_type",
        type: "Department Icon Type",
        description: [
          "Department icon mode. See ",
          {
            label: "Department Icon Type",
            resourceId: "department",
            hash: departmentIconTypeDeclarationHash
          },
          "."
        ]
      },
      {
        name: "icon_value",
        type: "string",
        description: ["Emoji value, uploaded image filename, or empty string for text-only departments."]
      },
      {
        name: "color_rgba",
        type: "integer | null",
        description: ["Optional sidebar text color in 0xRRGGBBAA order."]
      },
      {
        name: "note_count",
        type: "integer",
        description: ["Number of notes currently assigned to this department."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    returns: [
      "A full ",
      { label: "department", resourceId: "department" },
      " object."
    ]
  },
  {
    id: "department-updated",
    type: "DEPARTMENT_UPDATED",
    description: [
      "Dispatched when a department visible to the receiving user is updated."
    ],
    dataFields: [
      { name: "id", type: "string", description: ["Department platform ID."] },
      { name: "name", type: "string", description: ["Department display name."] },
      {
        name: "icon_type",
        type: "Department Icon Type",
        description: [
          "Department icon mode. See ",
          {
            label: "Department Icon Type",
            resourceId: "department",
            hash: departmentIconTypeDeclarationHash
          },
          "."
        ]
      },
      {
        name: "icon_value",
        type: "string",
        description: ["Emoji value, uploaded image filename, or empty string for text-only departments."]
      },
      {
        name: "color_rgba",
        type: "integer | null",
        description: ["Optional sidebar text color in 0xRRGGBBAA order."]
      },
      {
        name: "note_count",
        type: "integer",
        description: ["Number of notes currently assigned to this department."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    returns: [
      "A full ",
      { label: "department", resourceId: "department" },
      " object with updated fields."
    ]
  },
  {
    id: "department-deleted",
    type: "DEPARTMENT_DELETED",
    description: ["Dispatched when a department is deleted."],
    dataFields: [
      {
        name: "id",
        type: "string",
        description: ["Deleted department platform ID."]
      }
    ],
    returns: [
      "An object containing only the ",
      { label: "id" },
      " of the deleted department."
    ]
  },
  {
    id: "user-created",
    type: "USER_CREATED",
    description: [
      "Dispatched when a new user account is created and visible to the receiving user."
    ],
    dataFields: [
      { name: "id", type: "string", description: ["User platform ID."] },
      { name: "username", type: "string", description: ["Display name."] },
      {
        name: "permissions",
        type: "integer",
        description: ["Permission bitmask."]
      },
      {
        name: "presence",
        type: "ONLINE | OFFLINE",
        description: ["Current realtime presence."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    returns: ["A full ", { label: "user", resourceId: "user" }, " object."]
  },
  {
    id: "user-updated",
    type: "USER_UPDATED",
    description: ["Dispatched when a user account is updated."],
    dataFields: [
      { name: "id", type: "string", description: ["User platform ID."] },
      { name: "username", type: "string", description: ["Display name."] },
      {
        name: "permissions",
        type: "integer",
        description: ["Permission bitmask."]
      },
      {
        name: "presence",
        type: "ONLINE | OFFLINE",
        description: ["Current realtime presence."]
      },
      { name: "created_at", type: "string", description: ["Creation time."] },
      { name: "updated_at", type: "string", description: ["Last update time."] }
    ],
    returns: [
      "A full ",
      { label: "user", resourceId: "user" },
      " object with updated fields."
    ]
  },
  {
    id: "user-deleted",
    type: "USER_DELETED",
    description: ["Dispatched when a user account is deleted."],
    dataFields: [
      { name: "id", type: "string", description: ["Deleted user platform ID."] }
    ],
    returns: [
      "An object containing only the ",
      { label: "id" },
      " of the deleted user."
    ]
  },
  {
    id: "presence-updated",
    type: "PRESENCE_UPDATED",
    description: ["Dispatched when a user's online/offline presence changes."],
    dataFields: [
      { name: "id", type: "string", description: ["User platform ID."] },
      {
        name: "presence",
        type: "ONLINE | OFFLINE",
        description: ["New presence status."]
      }
    ],
    returns: [
      "An object with the user ",
      { label: "id" },
      " and new ",
      { label: "presence" },
      " value."
    ]
  },
  {
    id: "session-expired",
    type: "SESSION_EXPIRED",
    description: [
      "Dispatched when the authenticated session is no longer valid. The client should re-authenticate."
    ],
    dataFields: [],
    returns: [
      "No meaningful payload. The ",
      { label: "data" },
      " field may be empty or unknown."
    ]
  },
  {
    id: "connection-kill",
    type: "CONNECTION_KILL",
    description: [
      "Dispatched when the server forcibly terminates the connection. The ",
      { label: "code" },
      " field indicates the reason."
    ],
    dataFields: [
      {
        name: "code",
        type: "SUSPENDED_ACCOUNT | IDLE_TIMEOUT | DELETED | LOGOUT",
        description: ["Kill reason discriminator."]
      },
      {
        name: "reason?",
        type: "string",
        description: ["Optional human-readable reason."]
      }
    ],
    returns: [
      "A ",
      { label: "ConnectionKill" },
      " object with a ",
      { label: "code" },
      " and optional ",
      { label: "reason" },
      "."
    ]
  },
  {
    id: "resync-required",
    type: "RESYNC_REQUIRED",
    description: [
      "Dispatched when the server cannot replay missed events. The client should perform a full data resync."
    ],
    dataFields: [
      {
        name: "reason",
        type: "CURSOR_TOO_OLD | SCOPE_CHANGED",
        description: ["Reason the resync is required."]
      },
      {
        name: "latest_event_id?",
        type: "string",
        description: ["Latest available event ID when known."]
      }
    ],
    returns: [
      "A ",
      { label: "ResyncRequired" },
      " object with ",
      { label: "reason" },
      " and optional ",
      { label: "latest_event_id" },
      "."
    ]
  }
]

export const clientGatewayEvents: GatewayEvent[] = [
  {
    id: "ping",
    type: "ping",
    description: [
      "Sent by the browser while the tab is visible to keep the websocket session alive."
    ],
    dataFields: [],
    returns: [
      "The server updates the connection heartbeat and responds with ",
      { label: "ACK" },
      "."
    ]
  }
]

export const gatewayEventGroups: GatewayEventGroup[] = [
  {
    id: "server-events",
    navLabel: "Server Events",
    title: "Server Events",
    description: ["Messages emitted by the server over the websocket gateway."],
    events: gatewayEvents
  },
  {
    id: "client-events",
    navLabel: "Client Events",
    title: "Client Events",
    description: ["Messages sent by the browser to the websocket gateway."],
    events: clientGatewayEvents
  }
]
