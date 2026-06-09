package handler

import (
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/utils/apierror"
)

type noContentUserService struct{}

func (s noContentUserService) GetUsers(*entity.User) ([]*contract.UserResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentUserService) GetUser(*entity.User, string) (*contract.UserResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentUserService) UpdateUser(*entity.User, string, *contract.UpdateUserRequest) (*contract.UserResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentUserService) DeleteUser(*entity.User, string) apierror.ErrorResponse {
	return nil
}

func (s noContentUserService) Logout(*entity.User, *contract.LogoutRequest) apierror.ErrorResponse {
	return nil
}

func (s noContentUserService) CheckEmail(*contract.CheckUserStatusRequest) (*contract.EmailStatus, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentUserService) CreateUser(*contract.CreateUserRequest) apierror.ErrorResponse {
	panic("not implemented")
}

func (s noContentUserService) Login(*contract.UserLoginRequest) (*contract.UserLoginResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentUserService) ConfirmSignup(*contract.ConfirmSignupRequest) apierror.ErrorResponse {
	return nil
}

func (s noContentUserService) ResendConfirmation(*contract.ResendConfirmationRequest) apierror.ErrorResponse {
	return nil
}

type noContentDepartmentService struct{}

func (s noContentDepartmentService) GetDepartments(*entity.User) ([]*contract.DepartmentResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentDepartmentService) GetDepartmentMemberships(*entity.User) (*contract.DepartmentUsersResponse, apierror.ErrorResponse) {
	return &contract.DepartmentUsersResponse{
		Departments: map[string][]string{
			"1": []string{"10", "11"},
			"2": []string{"12"},
		},
	}, nil
}

func (s noContentDepartmentService) CreateDepartment(*entity.User, *contract.CreateDepartmentRequest, *multipart.FileHeader) (*contract.DepartmentResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentDepartmentService) UpdateDepartment(*entity.User, int64, *contract.UpdateDepartmentRequest, *multipart.FileHeader) (*contract.DepartmentResponse, apierror.ErrorResponse) {
	panic("not implemented")
}

func (s noContentDepartmentService) DeleteDepartment(*entity.User, int64) apierror.ErrorResponse {
	panic("not implemented")
}

func (s noContentDepartmentService) AddDepartmentUser(*entity.User, int64, int64) apierror.ErrorResponse {
	return nil
}

func (s noContentDepartmentService) RemoveDepartmentUser(*entity.User, int64, int64) apierror.ErrorResponse {
	return nil
}

func (s noContentDepartmentService) BulkMoveNotes(*entity.User, int64, *contract.BulkMoveDepartmentNotesRequest) apierror.ErrorResponse {
	return nil
}

func (s noContentDepartmentService) BulkDeleteNotes(*entity.User, int64) apierror.ErrorResponse {
	return nil
}

type noContentWebSocketService struct{}

func (s noContentWebSocketService) RegisterConnection(int64, string, string, int64, *int64) apierror.ErrorResponse {
	panic("not implemented")
}

func (s noContentWebSocketService) RemoveConnection(string) {}

func (s noContentWebSocketService) HandleMessage(*contract.IncomingSocketMessage, string) {}

func TestNoContentUserRoutesReturn204(t *testing.T) {
	e := echo.New()
	route := NewUserDefault(noContentUserService{})

	tests := []struct {
		name       string
		method     string
		target     string
		body       string
		routeParam string
		handler    func(echo.Context) error
		withUser   bool
	}{
		{
			name:       "delete user",
			method:     http.MethodDelete,
			target:     "/api/users/1",
			routeParam: "1",
			handler:    route.DeleteUser,
			withUser:   true,
		},
		{
			name:     "logout",
			method:   http.MethodPost,
			target:   "/api/users/logout",
			body:     `{}`,
			handler:  route.Logout,
			withUser: true,
		},
		{
			name:    "confirm signup",
			method:  http.MethodPost,
			target:  "/api/users/confirms",
			body:    `{}`,
			handler: route.ConfirmSignup,
		},
		{
			name:    "resend confirmation",
			method:  http.MethodPost,
			target:  "/api/users/confirms/resend",
			body:    `{}`,
			handler: route.ResendConfirmation,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, rec := newJSONContext(e, tt.method, tt.target, tt.body)
			if tt.routeParam != "" {
				c.SetParamNames("id")
				c.SetParamValues(tt.routeParam)
			}
			if tt.withUser {
				c.Set("user", &entity.User{ID: 1})
			}

			if err := tt.handler(c); err != nil {
				t.Fatalf("handler returned error: %v", err)
			}
			assertNoContent(t, rec)
		})
	}
}

func TestNoContentDepartmentRoutesReturn204(t *testing.T) {
	e := echo.New()
	route := NewDepartmentDefault(noContentDepartmentService{})

	tests := []struct {
		name    string
		method  string
		target  string
		body    string
		handler func(echo.Context) error
	}{
		{
			name:    "add department user",
			method:  http.MethodPut,
			target:  "/api/departments/1/users/2",
			handler: route.AddDepartmentUser,
		},
		{
			name:    "remove department user",
			method:  http.MethodDelete,
			target:  "/api/departments/1/users/2",
			handler: route.RemoveDepartmentUser,
		},
		{
			name:    "bulk move notes",
			method:  http.MethodPost,
			target:  "/api/departments/1/notes/bulk-move",
			body:    `{}`,
			handler: route.BulkMoveNotes,
		},
		{
			name:    "bulk delete notes",
			method:  http.MethodPost,
			target:  "/api/departments/1/notes/bulk-delete",
			handler: route.BulkDeleteNotes,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, rec := newJSONContext(e, tt.method, tt.target, tt.body)
			c.Set("user", &entity.User{ID: 1})
			c.SetParamNames("department_id", "user_id")
			c.SetParamValues("1", "2")

			if err := tt.handler(c); err != nil {
				t.Fatalf("handler returned error: %v", err)
			}
			assertNoContent(t, rec)
		})
	}
}

func TestGetDepartmentMembershipsReturnsGroupedResponse(t *testing.T) {
	e := echo.New()
	route := NewDepartmentDefault(noContentDepartmentService{})
	c, rec := newJSONContext(e, http.MethodGet, "/api/departments/users", "")
	c.Set("user", &entity.User{ID: 1})

	if err := route.GetDepartmentMemberships(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var resp contract.DepartmentUsersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got := resp.Departments["1"]; len(got) != 2 || got[0] != "10" || got[1] != "11" {
		t.Fatalf("expected department 1 users [10 11], got %v", got)
	}
}

func TestNoContentWebSocketRoutesReturn204(t *testing.T) {
	e := echo.New()
	route := NewWSDefault(noContentWebSocketService{})

	tests := []struct {
		name    string
		method  string
		target  string
		body    string
		handler func(echo.Context) error
	}{
		{
			name:    "disconnect",
			method:  http.MethodPost,
			target:  "/ws/disconnect",
			handler: route.HandleDisconnect,
		},
		{
			name:    "message",
			method:  http.MethodPost,
			target:  "/ws/default",
			body:    `{}`,
			handler: route.HandleMessage,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, rec := newJSONContext(e, tt.method, tt.target, tt.body)
			if err := tt.handler(c); err != nil {
				t.Fatalf("handler returned error: %v", err)
			}
			assertNoContent(t, rec)
		})
	}
}

func newJSONContext(e *echo.Echo, method, target, body string) (echo.Context, *httptest.ResponseRecorder) {
	if body == "" {
		body = "{}"
	}
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func assertNoContent(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
	}
	if body := rec.Body.String(); body != "" {
		t.Fatalf("expected empty response body, got %q", body)
	}
}
