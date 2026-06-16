package service

import (
	"bytes"
	"strings"

	"github.com/go-pdf/fpdf"
)

const defaultPDFFileName = "document"

func buildTextPDF(fileName string, content string) ([]byte, error) {
	var output bytes.Buffer

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetTitle(fileName, true)
	pdf.SetAuthor("ZenKeep", true)
	pdf.SetMargins(18, 18, 18)
	pdf.SetAutoPageBreak(true, 18)
	pdf.AddPage()

	translate := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 10, translate(pdfTitleFromFileName(fileName)), "", 1, "L", false, 0, "")
	pdf.Ln(2)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, translate(normalizeLineEndings(content)), "", "L", false)

	if err := pdf.Output(&output); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func normalizePDFFileName(fileName string) string {
	sanitized := strings.Map(func(r rune) rune {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			return '_'
		}
		return r
	}, strings.TrimSpace(fileName))

	sanitized = strings.Trim(sanitized, ". ")
	if sanitized == "" {
		sanitized = defaultPDFFileName
	}

	if !strings.HasSuffix(strings.ToLower(sanitized), ".pdf") {
		sanitized += ".pdf"
	}
	return sanitized
}

func pdfTitleFromFileName(fileName string) string {
	if strings.HasSuffix(strings.ToLower(fileName), ".pdf") {
		return fileName[:len(fileName)-4]
	}
	return fileName
}

func normalizeLineEndings(content string) string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	return strings.ReplaceAll(content, "\r", "\n")
}
