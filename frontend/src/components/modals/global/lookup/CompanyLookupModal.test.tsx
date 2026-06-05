import type { CompanyResponse } from "@/types/api/misc"
import type { ReactNode } from "react"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { miscService } from "@/services/miscService"

import { CompanyLookupModal } from "./CompanyLookupModal"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "errors.cnpjLookup": "Erro ao consultar CNPJ",
        "errors.cnpjNotFound": "CNPJ nao encontrado",
        "errors.invalidCnpj": "CNPJ invalido",
        "labels.lookup": "Consultar",
        "modals.lookup.headerLabel": "CNPJ",
        "modals.lookup.title": "Consulta CNPJ"
      }

      return translations[key] ?? key
    }
  })
}))

vi.mock("@/utils/companies/companyValidators", () => ({
  isCNPJValid: vi.fn(() => true)
}))

vi.mock("@/components/ui/AppTooltip", () => ({
  AppTooltip: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock("./CompanyDisplay", () => ({
  CompanyDisplay: ({ company }: { company: CompanyResponse }) => (
    <div data-testid="company-display">
      {company.cnpj}:{String(company.cached)}
    </div>
  )
}))

vi.mock("@/services/miscService", () => ({
  miscService: {
    findByCNPJ: vi.fn()
  }
}))

vi.mock("lodash-es", () => ({
  throttle: (fn: (...args: unknown[]) => unknown) =>
    Object.assign(fn, { cancel: () => undefined })
}))

describe("CompanyLookupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requeries the displayed CNPJ when the current result is a cache miss", async () => {
    const cnpj = "12345678000195"
    vi.mocked(miscService.findByCNPJ)
      .mockResolvedValueOnce({
        success: true,
        data: makeCompany(cnpj, false),
        statusCode: 200
      })
      .mockResolvedValueOnce({
        success: true,
        data: makeCompany(cnpj, true),
        statusCode: 200
      })

    render(<CompanyLookupModal setLookingUp={vi.fn()} />)

    const input = screen.getByPlaceholderText("00.000.000/0000-00")

    fireEvent.change(input, { target: { value: cnpj } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(screen.getByTestId("company-display")).toHaveTextContent(
        `${cnpj}:false`
      )
    })

    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(miscService.findByCNPJ).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId("company-display")).toHaveTextContent(
        `${cnpj}:true`
      )
    })
  })

  it("does not requery a displayed CNPJ after the result is already a cache hit", async () => {
    const cnpj = "12345678000195"
    vi.mocked(miscService.findByCNPJ).mockResolvedValueOnce({
      success: true,
      data: makeCompany(cnpj, true),
      statusCode: 200
    })

    render(<CompanyLookupModal setLookingUp={vi.fn()} />)

    const input = screen.getByPlaceholderText("00.000.000/0000-00")

    fireEvent.change(input, { target: { value: cnpj } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(screen.getByTestId("company-display")).toHaveTextContent(
        `${cnpj}:true`
      )
    })

    fireEvent.keyDown(input, { key: "Enter" })

    expect(miscService.findByCNPJ).toHaveBeenCalledTimes(1)
  })
})

function makeCompany(cnpj: string, cached: boolean): CompanyResponse {
  return {
    cnpj,
    legalName: "Magalu Teste",
    tradeName: "Magalu",
    legalNature: "Sociedade Empresaria Limitada",
    companySize: "DEMAIS",
    startDate: "2020-01-01",
    shareCapital: 100,
    registration: {
      status: "ACTIVE",
      reason: "",
      date: "2020-01-01"
    },
    address: {
      type: "Rua",
      streetName: "Teste",
      number: "1",
      neighborhood: "Centro",
      zipCode: "00000000",
      city: "Sao Paulo",
      region: "SP"
    },
    partners: [],
    cached
  }
}
