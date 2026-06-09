package service

import (
	"mime/multipart"
	"testing"

	"gorm.io/gorm"

	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/domain/policy"
	"zenkeep/cmd/internal/domain/sqlite/repository"
	"zenkeep/cmd/internal/idgen"
	"zenkeep/cmd/internal/utils"
)

func TestDepartmentDeleteIsBlockedWhenNotesStillReferenceIt(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionManageDepartments)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Reclame Aqui")
	mustSaveDepartmentNote(t, repos.noteRepo, 20, actor.ID, &department.ID)

	apierr := departmentSvc.DeleteDepartment(actor, department.ID)
	if apierr == nil {
		t.Fatal("expected department deletion to be blocked")
	}
	if apierr.Code() != 409 {
		t.Fatalf("expected 409 conflict, got %d", apierr.Code())
	}
}

func TestDepartmentMembershipMutationRequiresManageDepartmentsAndManageUsers(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionManageDepartments)
	target := mustSaveDepartmentUser(t, repos.userRepo, 2, 0)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Social")

	apierr := departmentSvc.AddDepartmentUser(actor, department.ID, target.ID)
	if apierr == nil {
		t.Fatal("expected missing Manage Users permission")
	}
	if apierr.Code() != 403 {
		t.Fatalf("expected 403, got %d", apierr.Code())
	}
}

func TestGetDepartmentMembershipsGroupsUsersByDepartment(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(
		t,
		repos.userRepo,
		1,
		entity.PermissionManageDepartments.Add(entity.PermissionManageUsers),
	)
	userA := mustSaveDepartmentUser(t, repos.userRepo, 2, 0)
	userB := mustSaveDepartmentUser(t, repos.userRepo, 3, 0)
	departmentA := mustSaveDepartment(t, repos.departmentRepo, 10, "Support")
	departmentB := mustSaveDepartment(t, repos.departmentRepo, 11, "Billing")
	mustAddMembership(t, repos.departmentRepo, departmentA.ID, userB.ID)
	mustAddMembership(t, repos.departmentRepo, departmentA.ID, userA.ID)
	mustAddMembership(t, repos.departmentRepo, departmentB.ID, userA.ID)

	resp, apierr := departmentSvc.GetDepartmentMemberships(actor)
	if apierr != nil {
		t.Fatalf("list department memberships: %#v", apierr)
	}

	expected := map[string][]string{
		idgen.Format(departmentA.ID): []string{idgen.Format(userA.ID), idgen.Format(userB.ID)},
		idgen.Format(departmentB.ID): []string{idgen.Format(userA.ID)},
	}
	if len(resp.Departments) != len(expected) {
		t.Fatalf("expected %d department groups, got %d", len(expected), len(resp.Departments))
	}
	for departmentID, userIDs := range expected {
		got := resp.Departments[departmentID]
		if len(got) != len(userIDs) {
			t.Fatalf("expected department %s users %v, got %v", departmentID, userIDs, got)
		}
		for i, userID := range userIDs {
			if got[i] != userID {
				t.Fatalf("expected department %s users %v, got %v", departmentID, userIDs, got)
			}
		}
	}
}

func TestCreateDepartmentAllowsTextOnlyIconAndStoresColor(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionManageDepartments)
	color := uint32(0x6DB9FFFF)

	resp, apierr := departmentSvc.CreateDepartment(actor, &contract.CreateDepartmentRequest{
		Name:      "Atendimento",
		IconType:  string(entity.DepartmentIconNone),
		ColorRGBA: &color,
	}, nil)
	if apierr != nil {
		t.Fatalf("create department: %#v", apierr)
	}
	if resp.IconType != string(entity.DepartmentIconNone) {
		t.Fatalf("expected NONE icon type, got %s", resp.IconType)
	}
	if resp.IconValue != "" {
		t.Fatalf("expected empty icon value, got %q", resp.IconValue)
	}
	if resp.ColorRGBA == nil || *resp.ColorRGBA != color {
		t.Fatalf("expected response color %d, got %v", color, resp.ColorRGBA)
	}
	if resp.NoteCount != 0 {
		t.Fatalf("expected new department note count 0, got %d", resp.NoteCount)
	}

	persisted, err := repos.departmentRepo.FindByID(9001)
	if err != nil {
		t.Fatalf("find department: %v", err)
	}
	if persisted == nil {
		t.Fatal("expected persisted department")
	}
	if persisted.ColorRGBA == nil || *persisted.ColorRGBA != color {
		t.Fatalf("expected persisted color %d, got %v", color, persisted.ColorRGBA)
	}
}

func TestUpdateDepartmentCanClearImageIconAndColor(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionManageDepartments)
	color := uint32(0x9B59B6CC)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Backoffice")
	department.IconType = entity.DepartmentIconImage
	department.IconValue = "existing.png"
	department.ColorRGBA = &color
	if err := repos.departmentRepo.SaveWithDB(nil, department); err != nil {
		t.Fatalf("save image department: %v", err)
	}
	mustSaveDepartmentNote(t, repos.noteRepo, 20, actor.ID, &department.ID)

	iconType := string(entity.DepartmentIconNone)
	resp, apierr := departmentSvc.UpdateDepartment(actor, department.ID, &contract.UpdateDepartmentRequest{
		IconType:  &iconType,
		ColorRGBA: contract.NullableUint32{Set: true, Value: nil},
	}, nil)
	if apierr != nil {
		t.Fatalf("update department: %#v", apierr)
	}
	if resp.IconType != string(entity.DepartmentIconNone) || resp.IconValue != "" {
		t.Fatalf("expected cleared icon, got %s %q", resp.IconType, resp.IconValue)
	}
	if resp.ColorRGBA != nil {
		t.Fatalf("expected nil response color, got %v", resp.ColorRGBA)
	}
	if resp.NoteCount != 1 {
		t.Fatalf("expected department note count 1, got %d", resp.NoteCount)
	}

	persisted, err := repos.departmentRepo.FindByID(department.ID)
	if err != nil {
		t.Fatalf("find department: %v", err)
	}
	if persisted.ColorRGBA != nil {
		t.Fatalf("expected nil persisted color, got %v", persisted.ColorRGBA)
	}
	if persisted.IconType != entity.DepartmentIconNone || persisted.IconValue != "" {
		t.Fatalf("expected persisted icon cleared, got %s %q", persisted.IconType, persisted.IconValue)
	}
}

func TestGetDepartmentsReturnsNoteCountForEveryVisibleDepartment(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionManageDepartments)
	departmentA := mustSaveDepartment(t, repos.departmentRepo, 10, "Chat")
	departmentB := mustSaveDepartment(t, repos.departmentRepo, 11, "Email")
	departmentC := mustSaveDepartment(t, repos.departmentRepo, 12, "Voice")

	mustSaveDepartmentNote(t, repos.noteRepo, 20, actor.ID, &departmentA.ID)
	mustSaveDepartmentNote(t, repos.noteRepo, 21, actor.ID, &departmentA.ID)
	mustSaveDepartmentNote(t, repos.noteRepo, 22, actor.ID, &departmentB.ID)
	mustSaveDepartmentNote(t, repos.noteRepo, 23, actor.ID, nil)

	departments, apierr := departmentSvc.GetDepartments(actor)
	if apierr != nil {
		t.Fatalf("list departments: %#v", apierr)
	}

	counts := make(map[string]int64, len(departments))
	for _, department := range departments {
		counts[department.ID] = department.NoteCount
	}

	expected := map[string]int64{
		idgen.Format(departmentA.ID): 2,
		idgen.Format(departmentB.ID): 1,
		idgen.Format(departmentC.ID): 0,
	}
	for id, noteCount := range expected {
		if counts[id] != noteCount {
			t.Fatalf("expected department %s note count %d, got %d", id, noteCount, counts[id])
		}
	}
}

func TestDepartmentUpdateImageToEmojiRequiresEmojiValue(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionManageDepartments)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Backoffice")
	department.IconType = entity.DepartmentIconImage
	department.IconValue = "existing.png"
	if err := repos.departmentRepo.SaveWithDB(nil, department); err != nil {
		t.Fatalf("save image department: %v", err)
	}

	iconType := string(entity.DepartmentIconEmoji)
	_, apierr := departmentSvc.UpdateDepartment(actor, department.ID, &contract.UpdateDepartmentRequest{
		IconType: &iconType,
	}, nil)
	if apierr == nil {
		t.Fatal("expected missing emoji value to be rejected")
	}
	if apierr.Code() != 400 {
		t.Fatalf("expected 400, got %d", apierr.Code())
	}
}

func TestDepartmentIconUploadRejectsFilesOverSafetyLimit(t *testing.T) {
	_, apierr := uploadDepartmentIcon(noopS3{}, &multipart.FileHeader{
		Filename: "department.png",
		Size:     contract.MaxDepartmentIconSizeBytes + 1,
	})
	if apierr == nil {
		t.Fatal("expected oversized department icon to be rejected")
	}
	if apierr.Code() != 400 {
		t.Fatalf("expected 400, got %d", apierr.Code())
	}
}

func TestGetAllNotesFiltersDepartmentNotesByMembership(t *testing.T) {
	db := newTestDB(t)
	_, repos := newDepartmentTestService(t, db)
	noteSvc := newDepartmentTestNoteService(t, db, repos)

	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, 0)
	admin := mustSaveDepartmentUser(t, repos.userRepo, 2, entity.PermissionAdministrator)
	departmentA := mustSaveDepartment(t, repos.departmentRepo, 10, "Chat")
	departmentB := mustSaveDepartment(t, repos.departmentRepo, 11, "Email")
	mustAddMembership(t, repos.departmentRepo, departmentA.ID, actor.ID)

	mustSaveDepartmentNote(t, repos.noteRepo, 20, actor.ID, nil)
	mustSaveDepartmentNote(t, repos.noteRepo, 21, actor.ID, &departmentA.ID)
	mustSaveDepartmentNote(t, repos.noteRepo, 22, actor.ID, &departmentB.ID)

	notes, apierr := noteSvc.GetAllNotes(actor)
	if apierr != nil {
		t.Fatalf("list notes: %#v", apierr)
	}
	if len(notes) != 2 {
		t.Fatalf("expected general plus own department note, got %d", len(notes))
	}

	adminNotes, apierr := noteSvc.GetAllNotes(admin)
	if apierr != nil {
		t.Fatalf("list admin notes: %#v", apierr)
	}
	if len(adminNotes) != 3 {
		t.Fatalf("expected admin to see all notes, got %d", len(adminNotes))
	}
}

func TestCreateNoteRejectsDepartmentTheActorDoesNotBelongTo(t *testing.T) {
	db := newTestDB(t)
	_, repos := newDepartmentTestService(t, db)
	noteSvc := newDepartmentTestNoteService(t, db, repos)

	actor := mustSaveDepartmentUser(t, repos.userRepo, 1, entity.PermissionCreateNotes)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Backoffice")
	rawDepartmentID := idgen.Format(department.ID)

	_, apierr := noteSvc.CreateTextNote(actor, &contract.CreateTextNoteRequest{
		Name:         "Policy",
		Content:      "content",
		NoteType:     string(entity.NoteTypeMarkdown),
		DepartmentID: &rawDepartmentID,
		Tags:         []string{"policy"},
	})
	if apierr == nil {
		t.Fatal("expected forbidden department assignment")
	}
	if apierr.Code() != 403 {
		t.Fatalf("expected 403, got %d", apierr.Code())
	}
}

func TestBulkMoveDepartmentNotesToGeneral(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(
		t,
		repos.userRepo,
		1,
		entity.PermissionManageDepartments.Add(entity.PermissionEditNotes),
	)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Voice")
	note := mustSaveDepartmentNote(t, repos.noteRepo, 20, actor.ID, &department.ID)

	apierr := departmentSvc.BulkMoveNotes(actor, department.ID, &contract.BulkMoveDepartmentNotesRequest{
		TargetDepartmentID: contract.NullableString{Set: true, Value: nil},
	})
	if apierr != nil {
		t.Fatalf("bulk move: %#v", apierr)
	}

	updated, err := repos.noteRepo.FindByID(note.ID)
	if err != nil {
		t.Fatalf("find note: %v", err)
	}
	if updated.DepartmentID != nil {
		t.Fatalf("expected note to move to general, got %v", *updated.DepartmentID)
	}
}

func TestBulkDeleteDepartmentNotes(t *testing.T) {
	db := newTestDB(t)
	departmentSvc, repos := newDepartmentTestService(t, db)
	actor := mustSaveDepartmentUser(
		t,
		repos.userRepo,
		1,
		entity.PermissionManageDepartments.Add(entity.PermissionDeleteNotes),
	)
	department := mustSaveDepartment(t, repos.departmentRepo, 10, "Email")
	mustSaveDepartmentNote(t, repos.noteRepo, 20, actor.ID, &department.ID)
	mustSaveDepartmentNote(t, repos.noteRepo, 21, actor.ID, &department.ID)

	apierr := departmentSvc.BulkDeleteNotes(actor, department.ID)
	if apierr != nil {
		t.Fatalf("bulk delete: %#v", apierr)
	}

	count, err := repos.noteRepo.CountByDepartmentID(department.ID)
	if err != nil {
		t.Fatalf("count notes: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected all department notes to be deleted, got %d", count)
	}
}

type departmentTestRepos struct {
	departmentRepo *repository.DefaultDepartmentRepository
	noteRepo       *repository.DefaultNoteRepository
	userRepo       *repository.DefaultUserRepository
}

func newDepartmentTestService(t *testing.T, db *gorm.DB) (*DepartmentService, departmentTestRepos) {
	t.Helper()

	repos := departmentTestRepos{
		departmentRepo: repository.NewDepartmentRepository(db),
		noteRepo:       repository.NewNoteRepository(db),
		userRepo:       repository.NewUserRepository(db),
	}
	connRepo := repository.NewConnectionRepository(db)
	wsSvc := NewWebSocketService(connRepo, repository.NewSocketDeliveryRepository(db), noopGateway{})
	departmentSvc := NewDepartmentService(
		db,
		repos.departmentRepo,
		repos.noteRepo,
		repos.userRepo,
		wsSvc,
		noopS3{},
		newTestValidator(),
		newTestAuditService(t, db, 8000),
		&sequenceAuditIDGenerator{next: 9000},
	)
	return departmentSvc, repos
}

func newDepartmentTestNoteService(t *testing.T, db *gorm.DB, repos departmentTestRepos) *NoteService {
	t.Helper()

	wsSvc := NewWebSocketService(
		repository.NewConnectionRepository(db),
		repository.NewSocketDeliveryRepository(db),
		noopGateway{},
	)
	return NewNoteService(
		db,
		repos.noteRepo,
		repos.departmentRepo,
		repos.userRepo,
		wsSvc,
		noopS3{},
		newTestValidator(),
		newTestAuditService(t, db, 8500),
		policy.NewNotePolicy(),
		&sequenceAuditIDGenerator{next: 9500},
	)
}

func mustSaveDepartmentUser(t *testing.T, userRepo *repository.DefaultUserRepository, id int64, permissions entity.Permission) *entity.User {
	t.Helper()

	user := &entity.User{
		ID:            id,
		SubUUID:       "sub-" + idgen.Format(id),
		Username:      "user-" + idgen.Format(id),
		Email:         "user@example.com",
		EmailVerified: true,
		Permissions:   permissions,
		Active:        true,
		CreatedAt:     utils.NowUTC(),
		UpdatedAt:     utils.NowUTC(),
	}
	if err := userRepo.Save(user); err != nil {
		t.Fatalf("save user: %v", err)
	}
	return user
}

func mustSaveDepartment(t *testing.T, departmentRepo *repository.DefaultDepartmentRepository, id int64, name string) *entity.Department {
	t.Helper()

	department := &entity.Department{
		ID:        id,
		Name:      name,
		IconType:  entity.DepartmentIconEmoji,
		IconValue: "#",
		CreatedAt: utils.NowUTC(),
		UpdatedAt: utils.NowUTC(),
	}
	if err := departmentRepo.SaveWithDB(nil, department); err != nil {
		t.Fatalf("save department: %v", err)
	}
	return department
}

func mustAddMembership(t *testing.T, departmentRepo *repository.DefaultDepartmentRepository, departmentID int64, userID int64) {
	t.Helper()
	if err := departmentRepo.AddMemberWithDB(nil, &entity.DepartmentMembership{
		DepartmentID: departmentID,
		UserID:       userID,
		CreatedAt:    utils.NowUTC(),
	}); err != nil {
		t.Fatalf("save membership: %v", err)
	}
}

func mustSaveDepartmentNote(
	t *testing.T,
	noteRepo *repository.DefaultNoteRepository,
	id int64,
	createdByID int64,
	departmentID *int64,
) *entity.Note {
	t.Helper()

	note := &entity.Note{
		ID:           id,
		Name:         "note-" + idgen.Format(id),
		Content:      "content",
		CreatedByID:  createdByID,
		DepartmentID: departmentID,
		Tags:         "policy",
		NoteType:     entity.NoteTypeMarkdown,
		ContentSize:  7,
		CreatedAt:    utils.NowUTC(),
		UpdatedAt:    utils.NowUTC(),
	}
	if err := noteRepo.Save(note); err != nil {
		t.Fatalf("save note: %v", err)
	}
	return note
}
