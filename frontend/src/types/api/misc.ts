import { z } from "zod"

export type GenerateTextPDFRequest = {
  fileName: string
  content: string
}

// --------------------------------------------------
// API Responses
// --------------------------------------------------
export const regStatusSchema = z.enum([
  "ACTIVE",
  "CLOSED",
  "SUSPENDED",
  "UNFIT",
  "UNKNOWN"
])

const companyRegistrationSchema = z.object({
  status: regStatusSchema,
  reason: z.string(),
  date: z.string().optional()
})

const companyAddressSchema = z
  .object({
    type: z.string(),
    street_name: z.string(),
    number: z.string(),
    neighborhood: z.string(),
    zip_code: z.string(),
    city: z.string(),
    region: z.string()
  })
  .transform((a) => ({
    type: a.type,
    streetName: a.street_name,
    number: a.number,
    neighborhood: a.neighborhood,
    zipCode: a.zip_code,
    city: a.city,
    region: a.region
  }))

const companyPartnerSchema = z
  .object({
    name: z.string(),
    role: z.string(),
    role_code: z.int(),
    age_range: z.string() // Well, :shrug:
  })
  .transform((p) => ({
    name: p.name,
    role: p.role,
    roleCode: p.role_code,
    ageRange: p.age_range
  }))

export const companyResponseSchema = z
  .object({
    cnpj: z.string(),
    legal_name: z.string(),
    trade_name: z.string().optional(),
    legal_nature: z.string(),
    company_size: z.string(),
    business_start_date: z.iso.date(),
    share_capital: z.number(),
    registration: companyRegistrationSchema,
    address: companyAddressSchema,
    partners: z.array(companyPartnerSchema),
    cached: z.boolean()
  })
  .transform((c) => ({
    cnpj: c.cnpj,
    legalName: c.legal_name,
    tradeName: c.trade_name,
    legalNature: c.legal_nature,
    companySize: c.company_size,
    startDate: c.business_start_date,
    shareCapital: c.share_capital,
    registration: c.registration,
    address: c.address,
    partners: c.partners,
    cached: c.cached
  }))

// Exports
export type RegistrationStatus = z.infer<typeof regStatusSchema>
export type CompanyAddress = z.infer<typeof companyAddressSchema>
export type CompanyPartner = z.infer<typeof companyPartnerSchema>
export type CompanyResponse = z.infer<typeof companyResponseSchema>
