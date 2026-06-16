package service

import (
	"bytes"
	"testing"

	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
)

func TestGenerateTextPDFRequiresGeneratePDFsPermission(t *testing.T) {
	miscSvc := NewMiscService(nil, nil, nil, nil, newTestValidator())
	actor := &entity.User{Permissions: entity.PermissionPerformLookup}

	_, apierr := miscSvc.GenerateTextPDF(actor, &contract.GenerateTextPDFRequest{
		FileName: "report",
		Content:  "hello",
	})

	if apierr == nil {
		t.Fatal("expected permission error")
	}
	if apierr.Code() != 403 {
		t.Fatalf("expected 403, got %d", apierr.Code())
	}
}

func TestGenerateTextPDFReturnsPDFBytesAndNormalizedFilename(t *testing.T) {
	miscSvc := NewMiscService(nil, nil, nil, nil, newTestValidator())
	actor := &entity.User{Permissions: entity.PermissionGeneratePDFs}

	pdf, apierr := miscSvc.GenerateTextPDF(actor, &contract.GenerateTextPDFRequest{
		FileName: ` quarter/report `,
		Content:  "Linha 1\nLinha 2 com acento",
	})

	if apierr != nil {
		t.Fatalf("generate pdf returned api error: %#v", apierr)
	}
	if pdf.FileName != "quarter_report.pdf" {
		t.Fatalf("expected normalized filename, got %q", pdf.FileName)
	}
	if !bytes.HasPrefix(pdf.Bytes, []byte("%PDF-")) {
		t.Fatalf("expected PDF bytes, got prefix %q", string(pdf.Bytes[:5]))
	}
	if len(pdf.Bytes) < 100 {
		t.Fatalf("expected non-empty PDF content, got %d bytes", len(pdf.Bytes))
	}
}

func TestGenerateTextPDFValidatesRequiredFields(t *testing.T) {
	miscSvc := NewMiscService(nil, nil, nil, nil, newTestValidator())
	actor := &entity.User{Permissions: entity.PermissionGeneratePDFs}

	_, apierr := miscSvc.GenerateTextPDF(actor, &contract.GenerateTextPDFRequest{
		FileName: "   ",
		Content:  "",
	})

	if apierr == nil {
		t.Fatal("expected validation error")
	}
	if apierr.Code() != 400 {
		t.Fatalf("expected 400, got %d", apierr.Code())
	}
}
