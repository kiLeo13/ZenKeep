import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TextPDFModal } from "./TextPDFModal"
import { miscService } from "@/services/miscService"
import { toasts } from "@/utils/toastUtils"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "commons.cancel": "Cancelar",
        "errors.required": "Campo obrigatorio",
        "errors.string.max": `Max ${params?.count}`,
        "modals.textPdf.title": "Gerar PDF",
        "modals.textPdf.subtitle": "Digite e baixe",
        "modals.textPdf.fileName": "Nome do arquivo",
        "modals.textPdf.fileNamePlaceholder": "relatorio",
        "modals.textPdf.content": "Conteudo",
        "modals.textPdf.contentPlaceholder": "Digite o texto",
        "modals.textPdf.contentHint": "Quebras mantidas",
        "modals.textPdf.download": "Baixar PDF",
        "modals.textPdf.toasts.success": "PDF gerado",
        "modals.textPdf.toasts.error": "Erro ao gerar PDF"
      }

      return translations[key] ?? key
    }
  })
}))

vi.mock("@/services/miscService", () => ({
  miscService: {
    generateTextPDF: vi.fn()
  }
}))

vi.mock("@/utils/toastUtils", () => ({
  toasts: {
    apiError: vi.fn(),
    success: vi.fn()
  }
}))

describe("TextPDFModal", () => {
  const createObjectURL = vi.fn(() => "blob:pdf")
  const revokeObjectURL = vi.fn()
  const clickSpy = vi.fn()

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy)
  })

  it("generates and downloads a PDF from typed text", async () => {
    const pdfBlob = new Blob(["%PDF-test"], { type: "application/pdf" })
    vi.mocked(miscService.generateTextPDF).mockResolvedValue({
      success: true,
      statusCode: 200,
      data: pdfBlob
    })

    render(<TextPDFModal onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Nome do arquivo/), {
      target: { value: "relatorio/mensal" }
    })
    fireEvent.change(screen.getByLabelText(/Conteudo/), {
      target: { value: "Linha 1\nLinha 2" }
    })
    fireEvent.click(screen.getByRole("button", { name: /Baixar PDF/i }))

    await waitFor(() => {
      expect(miscService.generateTextPDF).toHaveBeenCalledWith({
        fileName: "relatorio/mensal",
        content: "Linha 1\nLinha 2"
      })
      expect(createObjectURL).toHaveBeenCalledWith(pdfBlob)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:pdf")
      expect(toasts.success).toHaveBeenCalledWith("PDF gerado")
    })
  })

  it("keeps the download button disabled until filename and content are filled", () => {
    render(<TextPDFModal onClose={vi.fn()} />)

    expect(screen.getByRole("button", { name: /Baixar PDF/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Nome do arquivo/), {
      target: { value: "relatorio" }
    })
    fireEvent.change(screen.getByLabelText(/Conteudo/), {
      target: { value: "Texto" }
    })

    expect(screen.getByRole("button", { name: /Baixar PDF/i })).toBeEnabled()
  })

  it("shows API errors without triggering a download", async () => {
    const errorResponse = {
      success: false as const,
      statusCode: 403,
      errors: { root: ["Missing permissions"] }
    }
    vi.mocked(miscService.generateTextPDF).mockResolvedValue(errorResponse)

    render(<TextPDFModal onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Nome do arquivo/), {
      target: { value: "relatorio" }
    })
    fireEvent.change(screen.getByLabelText(/Conteudo/), {
      target: { value: "Texto" }
    })
    fireEvent.click(screen.getByRole("button", { name: /Baixar PDF/i }))

    await waitFor(() => {
      expect(toasts.apiError).toHaveBeenCalledWith(
        "Erro ao gerar PDF",
        errorResponse
      )
      expect(createObjectURL).not.toHaveBeenCalled()
    })
  })
})
