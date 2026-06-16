package service

import (
	"context"
	"errors"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/gommon/log"
	"strconv"
	"strings"
	"zenkeep/cmd/internal/contract"
	"zenkeep/cmd/internal/domain/entity"
	"zenkeep/cmd/internal/idgen"
	"zenkeep/cmd/internal/infrastructure/minhareceita"
	"zenkeep/cmd/internal/utils"
	"zenkeep/cmd/internal/utils/apierror"
)

type CompanyLookupClient interface {
	GetByCNPJ(ctx context.Context, cnpj string) (*entity.Company, error)
}

type CompanyRepository interface {
	Save(company *entity.Company) error
	FindByCNPJ(cnpj string) (*entity.Company, error)
}

type MiscService struct {
	ReceitaClient CompanyLookupClient
	CompanyRepo   CompanyRepository
	AuditService  *AuditService
	IDGen         idgen.Generator
	Validate      *validator.Validate
}

type companyLookupResult struct {
	company   *entity.Company
	found     bool
	fromCache bool
}

func NewMiscService(client CompanyLookupClient, companyRepo CompanyRepository, auditService *AuditService, idGenerator idgen.Generator, validate *validator.Validate) *MiscService {
	if validate == nil {
		validate = validator.New()
	}

	return &MiscService{
		ReceitaClient: client,
		CompanyRepo:   companyRepo,
		AuditService:  auditService,
		IDGen:         idGenerator,
		Validate:      validate,
	}
}

func (u *MiscService) GenerateTextPDF(actor *entity.User, req *contract.GenerateTextPDFRequest) (*contract.GeneratedPDF, apierror.ErrorResponse) {
	if !actor.Permissions.HasEffective(entity.PermissionGeneratePDFs) {
		return nil, apierror.NewPermissionError(int64(entity.PermissionGeneratePDFs))
	}

	if req == nil {
		return nil, apierror.MalformedBodyError
	}

	req.FileName = strings.TrimSpace(req.FileName)
	if valerr := u.Validate.Struct(req); valerr != nil {
		return nil, apierror.FromValidationError(valerr)
	}

	fileName := normalizePDFFileName(req.FileName)
	pdfBytes, err := buildTextPDF(fileName, req.Content)
	if err != nil {
		log.Errorf("failed to generate text pdf: %v", err)
		return nil, apierror.InternalServerError
	}

	return &contract.GeneratedPDF{
		FileName: fileName,
		Bytes:    pdfBytes,
	}, nil
}

func (u *MiscService) GetCompanyByCNPJ(actor *entity.User, cnpj string) (*contract.CompanyResponse, apierror.ErrorResponse) {
	if !actor.Permissions.HasEffective(entity.PermissionPerformLookup) {
		return nil, apierror.UserMissingPermsError
	}

	result, apierr := u.findCompany(cnpj)
	if apierr != nil && apierr.Code() != apierror.NotFoundError.Code() {
		return nil, apierr
	}

	u.recordCompanyLookup(actor, cnpj, result.found, result.fromCache)

	if apierr != nil {
		return nil, apierr
	}

	return toCompanyResponse(result.company, result.fromCache), nil
}

// findCompany is a utility function that will try to resolve the CNPJ into a company.
// It returns the lookup result, including whether it was found and whether it came from cache.
func (u *MiscService) findCompany(cnpj string) (*companyLookupResult, apierror.ErrorResponse) {
	cached, err := u.CompanyRepo.FindByCNPJ(cnpj)
	if err != nil {
		log.Errorf("failed to find company by cnpj %s: %v", cnpj, err)
		return nil, apierror.InternalServerError
	}

	if cached != nil {
		if cached.Found {
			return &companyLookupResult{
				company:   cached,
				found:     true,
				fromCache: true,
			}, nil
		}

		return &companyLookupResult{
			found:     false,
			fromCache: true,
		}, apierror.NotFoundError
	}

	apiCompany, apierr := u.fetchFromAPI(cnpj)
	if apierr != nil {
		if apierr.Code() == apierror.NotFoundError.Code() {
			return &companyLookupResult{
				found:     false,
				fromCache: false,
			}, apierr
		}

		return nil, apierr
	}

	err = u.CompanyRepo.Save(apiCompany)
	if err != nil {
		log.Errorf("failed to save company cache for CNPJ %s: %v", cnpj, err)
	}

	return &companyLookupResult{
		company:   apiCompany,
		found:     true,
		fromCache: false,
	}, nil
}

func (u *MiscService) fetchFromAPI(cnpj string) (*entity.Company, apierror.ErrorResponse) {
	company, err := u.ReceitaClient.GetByCNPJ(context.Background(), cnpj)
	if err != nil {
		if errors.Is(err, minhareceita.ErrNotFound) {
			u.cacheNegativeResult(cnpj)
			return nil, apierror.NotFoundError
		}
		log.Errorf("failed to fetch company by cnpj %s: %v", cnpj, err)
		return nil, apierror.InternalServerError
	}

	company.Found = true
	company.CachedAt = utils.NowUTC()
	if err := u.assignCompanyPartnerIDs(company); err != nil {
		log.Errorf("failed to generate company partner ids for CNPJ %s: %v", cnpj, err)
		return nil, apierror.InternalServerError
	}
	return company, nil
}

func (u *MiscService) cacheNegativeResult(cnpj string) {
	emptyCompany := &entity.Company{
		CNPJ:  cnpj,
		Found: false,
	}
	if err := u.CompanyRepo.Save(emptyCompany); err != nil {
		log.Errorf("failed to save negative company cache for CNPJ %s: %v", cnpj, err)
	}
}

func (u *MiscService) assignCompanyPartnerIDs(company *entity.Company) error {
	if company == nil || u.IDGen == nil {
		return nil
	}

	for _, partner := range company.Partners {
		if partner.ID != 0 {
			continue
		}

		id, err := u.IDGen.NextID()
		if err != nil {
			return err
		}
		partner.ID = id
	}
	return nil
}

func (u *MiscService) recordCompanyLookup(actor *entity.User, cnpj string, found bool, fromCache bool) {
	if u.AuditService == nil {
		return
	}

	event := &entity.AuditLogEvent{
		ActorUserID: &actor.ID,
		ActionType:  entity.AuditActionCompanyLookup,
		SubjectType: entity.AuditSubjectCompany,
		SubjectID:   cnpj,
		Source:      entity.AuditSourceHTTPAPI,
		Changes: []*entity.AuditLogChange{
			newAuditCreateValue("found", entity.AuditValueTypeBool, strconv.FormatBool(found)),
			newAuditCreateValue("cache_hit", entity.AuditValueTypeBool, strconv.FormatBool(fromCache)),
		},
	}

	if err := u.AuditService.Record(nil, event); err != nil {
		log.Errorf("failed to record company lookup audit log for cnpj %s: %v", cnpj, err)
	}
}

func toCompanyResponse(c *entity.Company, cached bool) *contract.CompanyResponse {
	return &contract.CompanyResponse{
		CNPJ:              c.CNPJ,
		LegalName:         c.LegalName,
		TradeName:         c.TradeName,
		LegalNature:       c.LegalNature,
		CompanySize:       c.CompanySize,
		BusinessStartDate: c.BusinessStartDate,
		ShareCapital:      c.ShareCapital,
		Registration: &contract.CompanyRegistration{
			Status: string(c.RegistrationStatus),
			Reason: c.RegistrationReason,
			Date:   c.RegistrationDate,
		},
		Address: &contract.CompanyAddress{
			Type:         c.AddressType,
			StreetName:   c.AddressStreetName,
			Number:       c.AddressNumber,
			Neighborhood: c.AddressNeighborhood,
			ZipCode:      c.AddressZipCode,
			City:         c.AddressCity,
			Region:       c.AddressRegion,
		},
		Partners: toCompanyPartnerResponses(c.Partners),
		Cached:   cached,
	}
}

func toCompanyPartnerResponses(ps []*entity.CompanyPartner) []*contract.CompanyPartnerResponse {
	partners := make([]*contract.CompanyPartnerResponse, len(ps))
	for i, p := range ps {
		partners[i] = toCompanyPartnerResponse(p)
	}
	return partners
}

func toCompanyPartnerResponse(p *entity.CompanyPartner) *contract.CompanyPartnerResponse {
	return &contract.CompanyPartnerResponse{
		Name:     p.Name,
		Role:     p.Role,
		RoleCode: p.RoleCode,
		AgeRange: p.AgeRange,
	}
}
