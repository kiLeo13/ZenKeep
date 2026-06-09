package handler

import (
	"encoding/json"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/idgen"
	"zenkeep/cmd/internal/utils"
	"zenkeep/cmd/internal/utils/apierror"
)

type DepartmentService interface {
	GetDepartments(actor *entity.User) ([]*contract.DepartmentResponse, apierror.ErrorResponse)
	GetDepartmentMemberships(actor *entity.User) (*contract.DepartmentUsersResponse, apierror.ErrorResponse)
	CreateDepartment(actor *entity.User, req *contract.CreateDepartmentRequest, iconFile *multipart.FileHeader) (*contract.DepartmentResponse, apierror.ErrorResponse)
	UpdateDepartment(actor *entity.User, departmentID int64, req *contract.UpdateDepartmentRequest, iconFile *multipart.FileHeader) (*contract.DepartmentResponse, apierror.ErrorResponse)
	DeleteDepartment(actor *entity.User, departmentID int64) apierror.ErrorResponse
	AddDepartmentUser(actor *entity.User, departmentID int64, userID int64) apierror.ErrorResponse
	RemoveDepartmentUser(actor *entity.User, departmentID int64, userID int64) apierror.ErrorResponse
	BulkMoveNotes(actor *entity.User, departmentID int64, req *contract.BulkMoveDepartmentNotesRequest) apierror.ErrorResponse
	BulkDeleteNotes(actor *entity.User, departmentID int64) apierror.ErrorResponse
}

type DefaultDepartmentRoute struct {
	DepartmentService DepartmentService
}

func NewDepartmentDefault(departmentService DepartmentService) *DefaultDepartmentRoute {
	return &DefaultDepartmentRoute{DepartmentService: departmentService}
}

func (d *DefaultDepartmentRoute) GetDepartments(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departments, apierr := d.DepartmentService.GetDepartments(user)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.JSON(http.StatusOK, echo.Map{"departments": departments})
}

func (d *DefaultDepartmentRoute) GetDepartmentMemberships(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departmentUsers, apierr := d.DepartmentService.GetDepartmentMemberships(user)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.JSON(http.StatusOK, departmentUsers)
}

func (d *DefaultDepartmentRoute) CreateDepartment(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	var req contract.CreateDepartmentRequest
	iconFile, apierr := bindDepartmentPayload(c, &req)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	department, apierr := d.DepartmentService.CreateDepartment(user, &req, iconFile)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.JSON(http.StatusCreated, department)
}

func (d *DefaultDepartmentRoute) UpdateDepartment(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departmentID, apierr := parseRouteID(c.Param("department_id"), "department_id")
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	var req contract.UpdateDepartmentRequest
	iconFile, apierr := bindDepartmentPayload(c, &req)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	department, apierr := d.DepartmentService.UpdateDepartment(user, departmentID, &req, iconFile)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.JSON(http.StatusOK, department)
}

func (d *DefaultDepartmentRoute) DeleteDepartment(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departmentID, apierr := parseRouteID(c.Param("department_id"), "department_id")
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	if apierr = d.DepartmentService.DeleteDepartment(user, departmentID); apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.NoContent(http.StatusNoContent)
}

func (d *DefaultDepartmentRoute) AddDepartmentUser(c echo.Context) error {
	return d.mutateDepartmentUser(c, true)
}

func (d *DefaultDepartmentRoute) RemoveDepartmentUser(c echo.Context) error {
	return d.mutateDepartmentUser(c, false)
}

func (d *DefaultDepartmentRoute) BulkMoveNotes(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departmentID, apierr := parseRouteID(c.Param("department_id"), "department_id")
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	var req contract.BulkMoveDepartmentNotesRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, apierror.MalformedBodyError)
	}

	if apierr = d.DepartmentService.BulkMoveNotes(user, departmentID, &req); apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.NoContent(http.StatusNoContent)
}

func (d *DefaultDepartmentRoute) BulkDeleteNotes(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departmentID, apierr := parseRouteID(c.Param("department_id"), "department_id")
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	if apierr = d.DepartmentService.BulkDeleteNotes(user, departmentID); apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.NoContent(http.StatusNoContent)
}

func (d *DefaultDepartmentRoute) mutateDepartmentUser(c echo.Context, add bool) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	departmentID, apierr := parseRouteID(c.Param("department_id"), "department_id")
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	userID, apierr := parseRouteID(c.Param("user_id"), "user_id")
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	if add {
		apierr = d.DepartmentService.AddDepartmentUser(user, departmentID, userID)
	} else {
		apierr = d.DepartmentService.RemoveDepartmentUser(user, departmentID, userID)
	}

	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.NoContent(http.StatusNoContent)
}

func bindDepartmentPayload[T any](c echo.Context, req *T) (*multipart.FileHeader, apierror.ErrorResponse) {
	contentType := c.Request().Header.Get(echo.HeaderContentType)
	if strings.HasPrefix(contentType, echo.MIMEApplicationJSON) {
		if err := c.Bind(req); err != nil {
			return nil, apierror.MalformedBodyError
		}
		return nil, nil
	}

	if strings.HasPrefix(contentType, echo.MIMEMultipartForm) {
		jsonPayload := strings.TrimSpace(c.FormValue("json_payload"))
		if jsonPayload == "" {
			return nil, apierror.FormJSONRequiredError
		}
		if err := json.Unmarshal([]byte(jsonPayload), req); err != nil {
			return nil, apierror.MalformedBodyError
		}

		iconFile, err := c.FormFile("icon")
		if err != nil {
			return nil, nil
		}
		return iconFile, nil
	}

	return nil, apierror.InvalidMediaTypeError
}

func parseRouteID(raw string, name string) (int64, apierror.ErrorResponse) {
	if strings.TrimSpace(raw) == "" {
		return 0, apierror.NewMissingParamError(name)
	}
	id, err := idgen.Parse(strings.TrimSpace(raw))
	if err != nil {
		return 0, apierror.NewInvalidParamTypeError(name, "int64")
	}
	return id, nil
}
