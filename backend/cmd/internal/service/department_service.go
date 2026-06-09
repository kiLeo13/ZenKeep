package service

import (
	"context"
	"errors"
	"mime/multipart"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/gommon/log"
	"gorm.io/gorm"

	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/domain/events"
	"zenkeep/cmd/internal/idgen"
	"zenkeep/cmd/internal/infrastructure/aws/storage"
	"zenkeep/cmd/internal/utils"
	"zenkeep/cmd/internal/utils/apierror"
)

type DepartmentRepository interface {
	FindAll() ([]*entity.Department, error)
	FindVisibleForUser(userID int64, includeAll bool) ([]*entity.Department, error)
	FindByID(id int64) (*entity.Department, error)
	SaveWithDB(db *gorm.DB, department *entity.Department) error
	DeleteWithDB(db *gorm.DB, department *entity.Department) error
	ListMemberships() ([]*entity.DepartmentMembership, error)
	AddMemberWithDB(db *gorm.DB, membership *entity.DepartmentMembership) error
	RemoveMemberWithDB(db *gorm.DB, departmentID int64, userID int64) error
	IsMember(userID int64, departmentID int64) (bool, error)
	FindUserDepartmentIDs(userID int64) ([]int64, error)
}

type DepartmentService struct {
	DB             *gorm.DB
	DepartmentRepo DepartmentRepository
	NoteRepo       NoteRepository
	UserRepo       UserRepository
	WSService      *WebSocketService
	S3             storage.S3Client
	Validate       interface {
		Struct(any) error
	}
	Audit *AuditService
	IDGen idgen.Generator
}

func NewDepartmentService(
	db *gorm.DB,
	departmentRepo DepartmentRepository,
	noteRepo NoteRepository,
	userRepo UserRepository,
	wsService *WebSocketService,
	s3 storage.S3Client,
	validate interface{ Struct(any) error },
	auditService *AuditService,
	idGenerator idgen.Generator,
) *DepartmentService {
	return &DepartmentService{
		DB:             db,
		DepartmentRepo: departmentRepo,
		NoteRepo:       noteRepo,
		UserRepo:       userRepo,
		WSService:      wsService,
		S3:             s3,
		Validate:       validate,
		Audit:          auditService,
		IDGen:          idGenerator,
	}
}

func (s *DepartmentService) GetDepartments(actor *entity.User) ([]*contract.DepartmentResponse, apierror.ErrorResponse) {
	includeAll := actor.Permissions.HasEffective(entity.PermissionAdministrator) ||
		actor.Permissions.HasEffective(entity.PermissionManageDepartments)

	departments, err := s.DepartmentRepo.FindVisibleForUser(actor.ID, includeAll)
	if err != nil {
		log.Errorf("failed to list departments: %v", err)
		return nil, apierror.InternalServerError
	}

	noteCounts, err := s.NoteRepo.CountByDepartmentIDs(departmentIDs(departments))
	if err != nil {
		log.Errorf("failed to count department notes: %v", err)
		return nil, apierror.InternalServerError
	}

	resp := make([]*contract.DepartmentResponse, len(departments))
	for i, department := range departments {
		resp[i] = toDepartmentResponse(department, noteCounts[department.ID])
	}
	return resp, nil
}

func (s *DepartmentService) GetDepartmentMemberships(actor *entity.User) (*contract.DepartmentUsersResponse, apierror.ErrorResponse) {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments, entity.PermissionManageUsers); apierr != nil {
		return nil, apierr
	}

	memberships, err := s.DepartmentRepo.ListMemberships()
	if err != nil {
		log.Errorf("failed to list department memberships: %v", err)
		return nil, apierror.InternalServerError
	}

	resp := &contract.DepartmentUsersResponse{
		Departments: make(map[string][]string),
	}
	for _, membership := range memberships {
		departmentID := idgen.Format(membership.DepartmentID)
		resp.Departments[departmentID] = append(
			resp.Departments[departmentID],
			idgen.Format(membership.UserID),
		)
	}
	return resp, nil
}

func (s *DepartmentService) CreateDepartment(actor *entity.User, req *contract.CreateDepartmentRequest, iconFile *multipart.FileHeader) (*contract.DepartmentResponse, apierror.ErrorResponse) {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments); apierr != nil {
		return nil, apierr
	}

	utils.Sanitize(req)
	if err := s.Validate.Struct(req); err != nil {
		return nil, apierror.FromValidationError(err)
	}

	iconValue, cleanup, apierr := s.prepareDepartmentIcon(req.IconType, req.IconValue, iconFile, "")
	if apierr != nil {
		return nil, apierr
	}

	now := utils.NowUTC()
	departmentID, err := s.nextID()
	if err != nil {
		cleanup()
		log.Errorf("failed to generate department id: %v", err)
		return nil, apierror.InternalServerError
	}

	department := &entity.Department{
		ID:        departmentID,
		Name:      req.Name,
		IconType:  entity.DepartmentIconType(req.IconType),
		IconValue: iconValue,
		ColorRGBA: req.ColorRGBA,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err = s.DB.Transaction(func(tx *gorm.DB) error {
		if err := s.DepartmentRepo.SaveWithDB(tx, department); err != nil {
			return err
		}
		return s.Audit.Record(tx, &entity.AuditLogEvent{
			ActorUserID: &actor.ID,
			ActionType:  entity.AuditActionDepartmentCreate,
			SubjectType: entity.AuditSubjectDepartment,
			SubjectID:   idgen.Format(department.ID),
			Source:      entity.AuditSourceHTTPAPI,
			Changes:     buildDepartmentCreateAuditChanges(department),
		})
	}); err != nil {
		cleanup()
		log.Errorf("failed to create department: %v", err)
		return nil, apierror.InternalServerError
	}

	resp := toDepartmentResponse(department, 0)
	go s.dispatchDepartmentCreated(department, resp)
	return resp, nil
}

func (s *DepartmentService) UpdateDepartment(actor *entity.User, departmentID int64, req *contract.UpdateDepartmentRequest, iconFile *multipart.FileHeader) (*contract.DepartmentResponse, apierror.ErrorResponse) {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments); apierr != nil {
		return nil, apierr
	}
	if req.IsEmpty() && iconFile == nil {
		return nil, apierror.EmptyPatchCallError
	}

	utils.Sanitize(req)
	if err := s.Validate.Struct(req); err != nil {
		return nil, apierror.FromValidationError(err)
	}

	department, apierr := s.fetchDepartment(departmentID)
	if apierr != nil {
		return nil, apierr
	}
	noteCount, err := s.NoteRepo.CountByDepartmentID(department.ID)
	if err != nil {
		log.Errorf("failed to count department notes: %v", err)
		return nil, apierror.InternalServerError
	}

	before := *department
	cleanupNewIcon := func() {}
	deleteOldIcon := func() {}

	if req.Name != nil {
		department.Name = *req.Name
	}
	if req.ColorRGBA.Set {
		department.ColorRGBA = req.ColorRGBA.Value
	}

	if req.IconType != nil || req.IconValue != nil || iconFile != nil {
		nextIconType := string(department.IconType)
		if req.IconType != nil {
			nextIconType = *req.IconType
		}

		rawIconValue := department.IconValue
		if req.IconValue != nil {
			rawIconValue = *req.IconValue
		}
		if entity.DepartmentIconType(nextIconType) == entity.DepartmentIconEmoji &&
			department.IconType != entity.DepartmentIconEmoji &&
			req.IconValue == nil {
			return nil, apierror.InvalidDepartmentIconError
		}

		previousImage := ""
		if department.IconType == entity.DepartmentIconImage {
			previousImage = department.IconValue
		}

		nextIconValue, cleanup, apierr := s.prepareDepartmentIcon(nextIconType, rawIconValue, iconFile, previousImage)
		if apierr != nil {
			return nil, apierr
		}
		cleanupNewIcon = cleanup

		if department.IconType == entity.DepartmentIconImage && department.IconValue != nextIconValue {
			oldIcon := department.IconValue
			deleteOldIcon = func() {
				_ = s.S3.DeleteFile(storage.PathDepartmentIcons + oldIcon)
			}
		}

		department.IconType = entity.DepartmentIconType(nextIconType)
		department.IconValue = nextIconValue
	}

	department.UpdatedAt = utils.NowUTC()
	changes := buildDepartmentUpdateAuditChanges(&before, department)

	if err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := s.DepartmentRepo.SaveWithDB(tx, department); err != nil {
			return err
		}
		if len(changes) == 0 {
			return nil
		}
		return s.Audit.Record(tx, &entity.AuditLogEvent{
			ActorUserID: &actor.ID,
			ActionType:  entity.AuditActionDepartmentUpdate,
			SubjectType: entity.AuditSubjectDepartment,
			SubjectID:   idgen.Format(department.ID),
			Source:      entity.AuditSourceHTTPAPI,
			Changes:     changes,
		})
	}); err != nil {
		cleanupNewIcon()
		log.Errorf("failed to update department: %v", err)
		return nil, apierror.InternalServerError
	}

	deleteOldIcon()
	resp := toDepartmentResponse(department, noteCount)
	go s.dispatchDepartmentUpdated(department, resp)
	return resp, nil
}

func (s *DepartmentService) DeleteDepartment(actor *entity.User, departmentID int64) apierror.ErrorResponse {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments); apierr != nil {
		return apierr
	}

	department, apierr := s.fetchDepartment(departmentID)
	if apierr != nil {
		return apierr
	}

	count, err := s.NoteRepo.CountByDepartmentID(department.ID)
	if err != nil {
		log.Errorf("failed to count department notes: %v", err)
		return apierror.InternalServerError
	}
	if count > 0 {
		return apierror.DepartmentHasNotesError
	}

	if department.IconType == entity.DepartmentIconImage {
		if err := s.S3.DeleteFile(storage.PathDepartmentIcons + department.IconValue); err != nil {
			log.Errorf("failed to delete department icon: %v", err)
			return apierror.InternalServerError
		}
	}

	if err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := s.DepartmentRepo.DeleteWithDB(tx, department); err != nil {
			return err
		}
		return s.Audit.Record(tx, &entity.AuditLogEvent{
			ActorUserID: &actor.ID,
			ActionType:  entity.AuditActionDepartmentDelete,
			SubjectType: entity.AuditSubjectDepartment,
			SubjectID:   idgen.Format(department.ID),
			Source:      entity.AuditSourceHTTPAPI,
			Changes: []*entity.AuditLogChange{
				newAuditDeleteValue("name", entity.AuditValueTypeString, department.Name),
			},
		})
	}); err != nil {
		log.Errorf("failed to delete department: %v", err)
		return apierror.InternalServerError
	}

	go s.dispatchDepartmentDeleted(department.ID)
	return nil
}

func (s *DepartmentService) AddDepartmentUser(actor *entity.User, departmentID int64, userID int64) apierror.ErrorResponse {
	return s.mutateDepartmentUser(actor, departmentID, userID, true)
}

func (s *DepartmentService) RemoveDepartmentUser(actor *entity.User, departmentID int64, userID int64) apierror.ErrorResponse {
	return s.mutateDepartmentUser(actor, departmentID, userID, false)
}

func (s *DepartmentService) BulkMoveNotes(actor *entity.User, departmentID int64, req *contract.BulkMoveDepartmentNotesRequest) apierror.ErrorResponse {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments, entity.PermissionEditNotes); apierr != nil {
		return apierr
	}
	if !req.TargetDepartmentID.Set {
		return apierror.NewMissingParamError("target_department_id")
	}

	source, apierr := s.fetchDepartment(departmentID)
	if apierr != nil {
		return apierr
	}

	var targetID *int64
	if req.TargetDepartmentID.Value != nil {
		parsedID, apierr := parseIDParam(*req.TargetDepartmentID.Value, "target_department_id")
		if apierr != nil {
			return apierr
		}
		if parsedID == source.ID {
			return nil
		}

		target, apierr := s.fetchDepartment(parsedID)
		if apierr != nil {
			return apierr
		}
		targetID = &target.ID
	}

	var moved int64
	if err := s.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		moved, err = s.NoteRepo.BulkMoveDepartmentWithDB(tx, source.ID, targetID)
		if err != nil {
			return err
		}
		return s.Audit.Record(tx, &entity.AuditLogEvent{
			ActorUserID: &actor.ID,
			ActionType:  entity.AuditActionDepartmentNotesBulkMove,
			SubjectType: entity.AuditSubjectDepartment,
			SubjectID:   idgen.Format(source.ID),
			Source:      entity.AuditSourceHTTPAPI,
			Changes: []*entity.AuditLogChange{
				newAuditCreateValue("target_department_id", entity.AuditValueTypeString, auditOptionalID(targetID)),
				newAuditCreateValue("note_count", entity.AuditValueTypeInt, strconv.FormatInt(moved, 10)),
			},
		})
	}); err != nil {
		log.Errorf("failed to bulk move department notes: %v", err)
		return apierror.InternalServerError
	}

	go s.dispatchScopeResyncToAll()
	return nil
}

func (s *DepartmentService) BulkDeleteNotes(actor *entity.User, departmentID int64) apierror.ErrorResponse {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments, entity.PermissionDeleteNotes); apierr != nil {
		return apierr
	}

	department, apierr := s.fetchDepartment(departmentID)
	if apierr != nil {
		return apierr
	}

	notes, err := s.NoteRepo.FindByDepartmentID(department.ID)
	if err != nil {
		log.Errorf("failed to list notes for bulk deletion: %v", err)
		return apierror.InternalServerError
	}

	for _, note := range notes {
		if err := deleteBucketObject(s.S3, note); err != nil {
			log.Errorf("failed to delete note attachment during department bulk delete: %v", err)
			return apierror.InternalServerError
		}
	}

	var deleted int64
	if err := s.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		deleted, err = s.NoteRepo.BulkDeleteDepartmentWithDB(tx, department.ID)
		if err != nil {
			return err
		}
		return s.Audit.Record(tx, &entity.AuditLogEvent{
			ActorUserID: &actor.ID,
			ActionType:  entity.AuditActionDepartmentNotesBulkDelete,
			SubjectType: entity.AuditSubjectDepartment,
			SubjectID:   idgen.Format(department.ID),
			Source:      entity.AuditSourceHTTPAPI,
			Changes: []*entity.AuditLogChange{
				newAuditDeleteValue("note_count", entity.AuditValueTypeInt, strconv.FormatInt(deleted, 10)),
			},
		})
	}); err != nil {
		log.Errorf("failed to bulk delete department notes: %v", err)
		return apierror.InternalServerError
	}

	go s.dispatchScopeResyncToAll()
	return nil
}

func (s *DepartmentService) mutateDepartmentUser(actor *entity.User, departmentID int64, userID int64, add bool) apierror.ErrorResponse {
	if apierr := requireAllPermissions(actor, entity.PermissionManageDepartments, entity.PermissionManageUsers); apierr != nil {
		return apierr
	}

	department, apierr := s.fetchDepartment(departmentID)
	if apierr != nil {
		return apierr
	}

	target, err := s.UserRepo.FindActiveByID(userID)
	if err != nil {
		log.Errorf("failed to fetch department member: %v", err)
		return apierror.InternalServerError
	}
	if target == nil {
		return apierror.NotFoundError
	}

	action := entity.AuditActionDepartmentMembershipRemove

	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if add {
			action = entity.AuditActionDepartmentMembershipAdd
			if err := s.DepartmentRepo.AddMemberWithDB(tx, &entity.DepartmentMembership{
				DepartmentID: department.ID,
				UserID:       target.ID,
				CreatedAt:    utils.NowUTC(),
			}); err != nil {
				return err
			}
		} else if err := s.DepartmentRepo.RemoveMemberWithDB(tx, department.ID, target.ID); err != nil {
			return err
		}

		return s.Audit.Record(tx, &entity.AuditLogEvent{
			ActorUserID: &actor.ID,
			ActionType:  action,
			SubjectType: entity.AuditSubjectDepartment,
			SubjectID:   idgen.Format(department.ID),
			Source:      entity.AuditSourceHTTPAPI,
		})
	})
	if err != nil {
		log.Errorf("failed to mutate department membership: %v", err)
		return apierror.InternalServerError
	}

	go s.dispatchMembershipScopeChange(target)
	return nil
}

func (s *DepartmentService) fetchDepartment(id int64) (*entity.Department, apierror.ErrorResponse) {
	department, err := s.DepartmentRepo.FindByID(id)
	if err != nil {
		log.Errorf("failed to fetch department: %v", err)
		return nil, apierror.InternalServerError
	}
	if department == nil {
		return nil, apierror.NotFoundError
	}
	return department, nil
}

func (s *DepartmentService) prepareDepartmentIcon(iconType string, iconValue string, iconFile *multipart.FileHeader, previousImage string) (string, func(), apierror.ErrorResponse) {
	cleanup := func() {}

	switch entity.DepartmentIconType(iconType) {
	case entity.DepartmentIconNone:
		return "", cleanup, nil
	case entity.DepartmentIconEmoji:
		if strings.TrimSpace(iconValue) == "" {
			return "", cleanup, apierror.InvalidDepartmentIconError
		}
		return strings.TrimSpace(iconValue), cleanup, nil
	case entity.DepartmentIconImage:
		if iconFile == nil {
			if previousImage != "" {
				return previousImage, cleanup, nil
			}
			return "", cleanup, apierror.MissingNoteFileError
		}
		value, apierr := uploadDepartmentIcon(s.S3, iconFile)
		if apierr != nil {
			return "", cleanup, apierr
		}
		cleanup = func() {
			_ = s.S3.DeleteFile(storage.PathDepartmentIcons + value)
		}
		return value, cleanup, nil
	default:
		return "", cleanup, apierror.InvalidDepartmentIconError
	}
}

func uploadDepartmentIcon(s3 storage.S3Client, fileHeader *multipart.FileHeader) (string, apierror.ErrorResponse) {
	if fileHeader.Size > contract.MaxDepartmentIconSizeBytes {
		return "", apierror.NewFileTooLargeError(contract.MaxDepartmentIconSizeBytes)
	}
	if strings.TrimSpace(fileHeader.Filename) == "" {
		return "", apierror.MissingFileNameError
	}
	if ext, ok := utils.CheckFileExt(fileHeader.Filename, contract.ValidDepartmentIconFileTypes); !ok {
		return "", apierror.NewInvalidFileExtError(ext)
	}

	bytes, apierr := readNoteFile(fileHeader)
	if apierr != nil {
		return "", apierr
	}

	filename := uuid.NewString() + filepath.Ext(fileHeader.Filename)
	if err := s3.UploadFile(bytes, storage.PathDepartmentIcons+filename); err != nil {
		log.Errorf("failed to upload department icon: %v", err)
		return "", apierror.InternalServerError
	}
	return filename, nil
}

func (s *DepartmentService) dispatchDepartmentCreated(department *entity.Department, resp *contract.DepartmentResponse) {
	s.WSService.BroadcastSupplier(context.Background(), func(userID int64) events.SocketEvent {
		if !s.canReceiveDepartment(userID, department.ID) {
			return nil
		}
		return &events.DepartmentCreated{DepartmentResponse: resp}
	})
}

func (s *DepartmentService) dispatchDepartmentUpdated(department *entity.Department, resp *contract.DepartmentResponse) {
	s.WSService.BroadcastSupplier(context.Background(), func(userID int64) events.SocketEvent {
		if !s.canReceiveDepartment(userID, department.ID) {
			return nil
		}
		return &events.DepartmentUpdated{DepartmentResponse: resp}
	})
}

func (s *DepartmentService) dispatchDepartmentDeleted(departmentID int64) {
	s.WSService.Broadcast(context.Background(), &events.DepartmentDeleted{
		DepartmentID: idgen.Format(departmentID),
	})
}

func (s *DepartmentService) dispatchMembershipScopeChange(target *entity.User) {
	presence := contract.PresenceOffline
	isOnline, _ := s.WSService.ConnRepo.IsOnline(target.ID, utils.NowUTC())
	if isOnline {
		presence = contract.PresenceOnline
	}

	s.WSService.Dispatch(context.Background(), target.ID, &events.UserUpdated{
		UserResponse: toUserResponse(target, target, presence),
	})
	s.WSService.Dispatch(context.Background(), target.ID, &events.ResyncRequired{
		Reason: contract.ReasonScopeChanged,
	})
}

func (s *DepartmentService) dispatchScopeResyncToAll() {
	s.WSService.Broadcast(context.Background(), &events.ResyncRequired{
		Reason: contract.ReasonScopeChanged,
	})
}

func (s *DepartmentService) canReceiveDepartment(userID int64, departmentID int64) bool {
	user, err := s.UserRepo.FindActiveByID(userID)
	if err != nil || user == nil {
		return false
	}
	if user.Permissions.HasEffective(entity.PermissionAdministrator) ||
		user.Permissions.HasEffective(entity.PermissionManageDepartments) {
		return true
	}
	isMember, err := s.DepartmentRepo.IsMember(user.ID, departmentID)
	return err == nil && isMember
}

func toDepartmentResponse(department *entity.Department, noteCount int64) *contract.DepartmentResponse {
	return &contract.DepartmentResponse{
		ID:        idgen.Format(department.ID),
		Name:      department.Name,
		IconType:  string(department.IconType),
		IconValue: department.IconValue,
		ColorRGBA: department.ColorRGBA,
		NoteCount: noteCount,
		CreatedAt: utils.FormatEpoch(department.CreatedAt),
		UpdatedAt: utils.FormatEpoch(department.UpdatedAt),
	}
}

func departmentIDs(departments []*entity.Department) []int64 {
	ids := make([]int64, len(departments))
	for i, department := range departments {
		ids[i] = department.ID
	}
	return ids
}

func buildDepartmentCreateAuditChanges(department *entity.Department) []*entity.AuditLogChange {
	return []*entity.AuditLogChange{
		newAuditCreateValue("name", entity.AuditValueTypeString, department.Name),
		newAuditCreateValue("icon_type", entity.AuditValueTypeEnum, string(department.IconType)),
		newAuditCreateValue("icon_value", entity.AuditValueTypeString, department.IconValue),
		newAuditCreateValue("color_rgba", entity.AuditValueTypeInt, auditOptionalUint32(department.ColorRGBA)),
	}
}

func buildDepartmentUpdateAuditChanges(before, after *entity.Department) []*entity.AuditLogChange {
	var changes []*entity.AuditLogChange
	appendAuditStringChange(&changes, "name", before.Name, after.Name)
	appendAuditEnumChange(&changes, "icon_type", string(before.IconType), string(after.IconType))
	appendAuditStringChange(&changes, "icon_value", before.IconValue, after.IconValue)
	appendAuditUint32PtrChange(&changes, "color_rgba", before.ColorRGBA, after.ColorRGBA)
	return changes
}

func appendAuditUint32PtrChange(changes *[]*entity.AuditLogChange, field string, oldValue, newValue *uint32) {
	oldAuditValue := auditOptionalUint32(oldValue)
	newAuditValue := auditOptionalUint32(newValue)
	if oldAuditValue == newAuditValue {
		return
	}
	*changes = append(*changes, &entity.AuditLogChange{
		FieldName: field,
		OldValue:  auditValuePtr(oldAuditValue),
		NewValue:  auditValuePtr(newAuditValue),
		ValueType: entity.AuditValueTypeInt,
	})
}

func auditOptionalUint32(value *uint32) string {
	if value == nil {
		return ""
	}
	return strconv.FormatUint(uint64(*value), 10)
}

func requireAllPermissions(actor *entity.User, permissions ...entity.Permission) apierror.ErrorResponse {
	for _, permission := range permissions {
		if !actor.Permissions.HasEffective(permission) {
			return apierror.NewPermissionError(int64(permission))
		}
	}
	return nil
}

func parseIDParam(raw string, name string) (int64, apierror.ErrorResponse) {
	id, err := idgen.Parse(strings.TrimSpace(raw))
	if err != nil {
		return 0, apierror.NewInvalidParamTypeError(name, "int64")
	}
	return id, nil
}

func (s *DepartmentService) nextID() (int64, error) {
	if s.IDGen == nil {
		return 0, errors.New("department id generator is nil")
	}
	return s.IDGen.NextID()
}
