import type { ApiErrorResponse, ApiResponse } from "@/types/api/api"
import {
  companyResponseSchema,
  type CompanyResponse,
  type GenerateTextPDFRequest
} from "@/types/api/misc"

import { isAxiosError } from "axios"
import apiClient from "./apiClient"
import { handleApiError } from "@/utils/errorHandlerUtils"

import { safeApiCall } from "./safeApiCall"

export const miscService = {
  findByCNPJ: async (cnpj: string): Promise<ApiResponse<CompanyResponse>> => {
    return safeApiCall(
      () => apiClient.get(`/misc/cnpj/${cnpj}`),
      companyResponseSchema
    )
  },

  generateTextPDF: async ({
    fileName,
    content
  }: GenerateTextPDFRequest): Promise<ApiResponse<Blob>> => {
    try {
      const response = await apiClient.post<Blob>(
        "/misc/text-pdf",
        {
          file_name: fileName,
          content
        },
        { responseType: "blob" }
      )

      return {
        success: true,
        statusCode: response.status,
        data: response.data
      }
    } catch (error) {
      return handleBlobApiError(error)
    }
  }
}

async function handleBlobApiError(error: unknown): Promise<ApiErrorResponse> {
  if (!isAxiosError(error) || !error.response) {
    return handleApiError(error)
  }

  const errorData = await parseBlobErrorData(error.response.data)
  if (isStructuredError(errorData)) {
    return {
      success: false,
      statusCode: error.response.status,
      errors: errorData.errors
    }
  }

  if (isMessageError(errorData)) {
    return {
      success: false,
      statusCode: error.response.status,
      errors: { root: [errorData.message] }
    }
  }

  return handleApiError(error)
}

async function parseBlobErrorData(data: unknown): Promise<unknown> {
  if (!(data instanceof Blob)) {
    return data
  }

  try {
    return JSON.parse(await data.text())
  } catch {
    return null
  }
}

function isStructuredError(
  value: unknown
): value is { errors: Record<string, string[]> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "errors" in value &&
    typeof (value as { errors: unknown }).errors === "object"
  )
}

function isMessageError(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  )
}
