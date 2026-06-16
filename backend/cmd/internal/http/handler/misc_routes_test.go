package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/utils/apierror"
)

type fakeMiscService struct {
	pdf     *contract.GeneratedPDF
	apierr  apierror.ErrorResponse
	actor   *entity.User
	pdfReq  *contract.GenerateTextPDFRequest
	company *contract.CompanyResponse
}

func (f *fakeMiscService) GetCompanyByCNPJ(actor *entity.User, cnpj string) (*contract.CompanyResponse, apierror.ErrorResponse) {
	return f.company, f.apierr
}

func (f *fakeMiscService) GenerateTextPDF(actor *entity.User, req *contract.GenerateTextPDFRequest) (*contract.GeneratedPDF, apierror.ErrorResponse) {
	f.actor = actor
	f.pdfReq = req
	return f.pdf, f.apierr
}

func TestGenerateTextPDFReturnsPDFAttachment(t *testing.T) {
	e := echo.New()
	service := &fakeMiscService{
		pdf: &contract.GeneratedPDF{
			FileName: "report.pdf",
			Bytes:    []byte("%PDF-test"),
		},
	}
	route := NewMiscRoute(service)

	req := httptest.NewRequest(http.MethodPost, "/api/misc/text-pdf", strings.NewReader(`{"file_name":"report","content":"hello"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	user := &entity.User{ID: 10}
	ctx.Set("user", user)

	if err := route.GenerateTextPDF(ctx); err != nil {
		t.Fatalf("route returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if service.actor != user {
		t.Fatal("expected route to pass authenticated actor")
	}
	if service.pdfReq == nil || service.pdfReq.FileName != "report" || service.pdfReq.Content != "hello" {
		t.Fatalf("unexpected service request: %#v", service.pdfReq)
	}
	if contentType := rec.Header().Get(echo.HeaderContentType); !strings.HasPrefix(contentType, "application/pdf") {
		t.Fatalf("expected application/pdf content type, got %q", contentType)
	}
	if disposition := rec.Header().Get(echo.HeaderContentDisposition); disposition != `attachment; filename=report.pdf` {
		t.Fatalf("unexpected content disposition: %q", disposition)
	}
	if rec.Body.String() != "%PDF-test" {
		t.Fatalf("unexpected response body: %q", rec.Body.String())
	}
}

func TestGenerateTextPDFReturnsServiceError(t *testing.T) {
	e := echo.New()
	route := NewMiscRoute(&fakeMiscService{
		apierr: apierror.NewPermissionError(int64(entity.PermissionGeneratePDFs)),
	})

	req := httptest.NewRequest(http.MethodPost, "/api/misc/text-pdf", strings.NewReader(`{"file_name":"report","content":"hello"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.Set("user", &entity.User{ID: 10})

	if err := route.GenerateTextPDF(ctx); err != nil {
		t.Fatalf("route returned error: %v", err)
	}

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
