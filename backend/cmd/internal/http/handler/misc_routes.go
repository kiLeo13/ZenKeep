package handler

import (
	"github.com/labstack/echo/v4"
	"mime"
	"net/http"
	"strings"
	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/utils"
	"zenkeep/cmd/internal/utils/apierror"
)

type MiscService interface {
	GetCompanyByCNPJ(actor *entity.User, cnpj string) (*contract.CompanyResponse, apierror.ErrorResponse)
	GenerateTextPDF(actor *entity.User, req *contract.GenerateTextPDFRequest) (*contract.GeneratedPDF, apierror.ErrorResponse)
}

type DefaultMiscRoute struct {
	MiscService MiscService
}

func NewMiscRoute(miscService MiscService) *DefaultMiscRoute {
	return &DefaultMiscRoute{MiscService: miscService}
}

func (u *DefaultMiscRoute) GetCompany(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	cnpj := strings.TrimSpace(c.Param("cnpj"))
	if !utils.IsCNPJValid(cnpj) {
		apierr := apierror.InvalidCNPJError
		return c.JSON(apierr.Code(), apierr)
	}

	company, apierr := u.MiscService.GetCompanyByCNPJ(user, cnpj)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}
	return c.JSON(http.StatusOK, company)
}

func (u *DefaultMiscRoute) GenerateTextPDF(c echo.Context) error {
	user, cerr := utils.GetUserFromContext(c)
	if cerr != nil {
		return c.JSON(cerr.Code(), cerr)
	}

	var req contract.GenerateTextPDFRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, apierror.MalformedBodyError)
	}

	pdf, apierr := u.MiscService.GenerateTextPDF(user, &req)
	if apierr != nil {
		return c.JSON(apierr.Code(), apierr)
	}

	disposition := mime.FormatMediaType("attachment", map[string]string{
		"filename": pdf.FileName,
	})
	c.Response().Header().Set(echo.HeaderContentDisposition, disposition)
	return c.Blob(http.StatusOK, "application/pdf", pdf.Bytes)
}
