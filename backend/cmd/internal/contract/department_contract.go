package contract

const MaxDepartmentIconSizeBytes = 512 * 1024

var ValidDepartmentIconFileTypes = []string{"png", "jpg", "jpeg", "webp", "gif"}

type DepartmentResponse struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	IconType  string  `json:"icon_type"`
	IconValue string  `json:"icon_value"`
	ColorRGBA *uint32 `json:"color_rgba"`
	NoteCount int64   `json:"note_count"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

type DepartmentUsersResponse struct {
	Departments map[string][]string `json:"departments"`
}

type CreateDepartmentRequest struct {
	Name      string  `json:"name" validate:"required,min=2,max=80"`
	IconType  string  `json:"icon_type" validate:"required,oneof=NONE EMOJI IMAGE"`
	IconValue string  `json:"icon_value" validate:"omitempty,max=16"`
	ColorRGBA *uint32 `json:"color_rgba"`
}

type UpdateDepartmentRequest struct {
	Name      *string        `json:"name" validate:"omitempty,min=2,max=80"`
	IconType  *string        `json:"icon_type" validate:"omitempty,oneof=NONE EMOJI IMAGE"`
	IconValue *string        `json:"icon_value" validate:"omitempty,max=16"`
	ColorRGBA NullableUint32 `json:"color_rgba"`
}

func (r *UpdateDepartmentRequest) IsEmpty() bool {
	return r.Name == nil && r.IconType == nil && r.IconValue == nil && !r.ColorRGBA.Set
}

type BulkMoveDepartmentNotesRequest struct {
	TargetDepartmentID NullableString `json:"target_department_id"`
}
