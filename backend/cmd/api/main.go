package main

import (
	"context"
	"os"
	"zenkeep/cmd/internal/domain/policy"
	"zenkeep/cmd/internal/domain/sqlite"
	"zenkeep/cmd/internal/domain/sqlite/repository"
	"zenkeep/cmd/internal/http/handler"
	mdlware "zenkeep/cmd/internal/http/middleware"
	"zenkeep/cmd/internal/idgen"
	cognitoclient "zenkeep/cmd/internal/infrastructure/aws/cognito"
	"zenkeep/cmd/internal/infrastructure/aws/storage"
	"zenkeep/cmd/internal/infrastructure/aws/websocket"
	"zenkeep/cmd/internal/infrastructure/minhareceita"
	"zenkeep/cmd/internal/service"
	"zenkeep/cmd/internal/service/jobs"
	"zenkeep/cmd/internal/utils"
	"zenkeep/cmd/internal/utils/validators"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
)

const envVarsPrefix = "/zenkeep/prod/"

func main() {
	validate := validator.New()
	registerValidators(validate)

	if os.Getenv("GO_ENV") == "production" {
		loadProdEnv()
	} else {
		if err := godotenv.Load(); err != nil {
			panic(err)
		}
	}

	// Infra Init
	db, err := sqlite.Init()
	if err != nil {
		panic(err)
	}

	// --- Cognito/Auth Init ---
	appClientID := os.Getenv("AWS_COGNITO_CLIENT_ID")
	region := os.Getenv("AWS_COGNITO_REGION")
	poolID := os.Getenv("AWS_COGNITO_USER_POOL_ID")
	cogClient, err := cognitoclient.InitCognitoClient(appClientID, region, poolID)
	if err != nil {
		panic(err)
	}

	if err = utils.InitJWKS(region, poolID); err != nil {
		panic(err)
	}

	// --- Storage Init ---
	s3Client, err := storage.NewStorageClient()
	if err != nil {
		panic(err)
	}

	wsEndpoint := os.Getenv("AWS_WS_GATEWAY_ENDPOINT")
	wsRegion := os.Getenv("AWS_WS_GATEWAY_REGION")
	wsClient, err := websocket.NewAWSGatewayClient(context.Background(), wsEndpoint, wsRegion)
	if err != nil {
		panic(err)
	}

	// Clients
	receitaClient := minhareceita.NewClient()

	// Domain & Service Wiring
	userPolicy := policy.NewUserPolicy()
	notePolicy := policy.NewNotePolicy()

	connRepo := repository.NewConnectionRepository(db)
	deliveryRepo := repository.NewSocketDeliveryRepository(db)
	noteRepo := repository.NewNoteRepository(db)
	departmentRepo := repository.NewDepartmentRepository(db)
	userRepo := repository.NewUserRepository(db)
	compRepo := repository.NewCompanyRepository(db)
	auditRepo := repository.NewAuditRepository(db)

	idGenerator, err := idgen.NewSonyflakeGenerator()
	if err != nil {
		panic(err)
	}

	auditService, err := service.NewAuditService(db, auditRepo, idGenerator)
	if err != nil {
		panic(err)
	}

	connService := service.NewWebSocketService(connRepo, deliveryRepo, wsClient)
	userService := service.NewUserService(db, userRepo, validate, connService, cogClient, auditService, userPolicy, idGenerator)
	noteService := service.NewNoteService(db, noteRepo, departmentRepo, userRepo, connService, s3Client, validate, auditService, notePolicy, idGenerator)
	departmentService := service.NewDepartmentService(db, departmentRepo, noteRepo, userRepo, connService, s3Client, validate, auditService, idGenerator)
	miscService := service.NewMiscService(receitaClient, compRepo, auditService, idGenerator, validate)

	connRoutes := handler.NewWSDefault(connService)
	noteRoutes := handler.NewNoteDefault(noteService)
	departmentRoutes := handler.NewDepartmentDefault(departmentService)
	userRoutes := handler.NewUserDefault(userService)
	miscRoutes := handler.NewMiscRoute(miscService)
	auditRoutes := handler.NewAuditDefault(auditService)

	// --- Background Jobs ---
	connCleaner := jobs.NewConnectionCleaner(connService)
	companyCleaner := jobs.NewCompanyCacheCleaner(compRepo)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go connCleaner.Start(ctx)
	go companyCleaner.Start(ctx)

	// --- Middleware Setup ---
	authMiddleware := mdlware.NewAuthMiddleware(&mdlware.AuthMiddlewareConfig{
		UserRepo: userRepo,
	})

	// --- Server Setup ---
	e := echo.New()

	e.Use(middleware.CORS())
	e.Use(middleware.BodyLimit("30M"))
	e.Use(middleware.Recover())

	// --- Register Routes ---
	registerRoutes(e, noteRoutes, departmentRoutes, userRoutes, miscRoutes, auditRoutes, connRoutes, authMiddleware)

	if err = e.Start(":7070"); err != nil {
		panic(err)
	}
}

// registerRoutes separates the routing logic from the wiring logic.
func registerRoutes(
	e *echo.Echo,
	noteH *handler.DefaultNoteRoute,
	departmentH *handler.DefaultDepartmentRoute,
	userH *handler.DefaultUserRoute,
	miscH *handler.DefaultMiscRoute,
	auditH *handler.DefaultAuditRoute,
	wsH *handler.DefaultWSRoute,
	authMiddleware echo.MiddlewareFunc,
) {
	// --- Public Routes (Unauthenticated) ---
	public := e.Group("/api")

	e.GET("/health", healthCheckRoute)

	// User Auth & Registration
	public.POST("/users/login", userH.CreateLogin)
	public.POST("/users", userH.CreateUser)
	public.POST("/users/check-email", userH.CheckEmail)
	public.POST("/users/confirms", userH.ConfirmSignup)
	public.POST("/users/confirms/resend", userH.ResendConfirmation)

	// --- Protected Routes ---
	protected := e.Group("/api")
	protected.Use(authMiddleware)

	// Notes
	protected.GET("/notes", noteH.GetNotes)
	protected.GET("/notes/:id", noteH.GetNote)
	protected.POST("/notes", noteH.CreateNote)
	protected.PATCH("/notes/:id", noteH.UpdateNote)
	protected.DELETE("/notes/:id", noteH.DeleteNote)

	// Departments
	protected.GET("/departments", departmentH.GetDepartments)
	protected.POST("/departments", departmentH.CreateDepartment)
	protected.GET("/departments/users", departmentH.GetDepartmentMemberships)
	protected.PATCH("/departments/:department_id", departmentH.UpdateDepartment)
	protected.DELETE("/departments/:department_id", departmentH.DeleteDepartment)
	protected.PUT("/departments/:department_id/users/:user_id", departmentH.AddDepartmentUser)
	protected.DELETE("/departments/:department_id/users/:user_id", departmentH.RemoveDepartmentUser)
	protected.POST("/departments/:department_id/notes/bulk-move", departmentH.BulkMoveNotes)
	protected.POST("/departments/:department_id/notes/bulk-delete", departmentH.BulkDeleteNotes)

	// Users
	protected.GET("/users", userH.GetUsers)
	protected.GET("/users/:id", userH.GetUser)
	protected.PATCH("/users/:id", userH.UpdateUser)
	protected.DELETE("/users/:id", userH.DeleteUser)
	protected.POST("/users/logout", userH.Logout)

	// Misc
	protected.GET("/misc/cnpj/:cnpj", miscH.GetCompany)
	protected.POST("/misc/text-pdf", miscH.GenerateTextPDF)
	protected.GET("/audit-logs", auditH.GetAuditLogs)

	// --- WebSocket ---
	ws := e.Group("/ws")

	ws.POST("/connect", wsH.HandleConnect, authMiddleware)
	ws.POST("/default", wsH.HandleMessage)
	ws.POST("/disconnect", wsH.HandleDisconnect)
}

func registerValidators(validate *validator.Validate) {
	_ = validate.RegisterValidation("hasupper", validators.HasUpper)
	_ = validate.RegisterValidation("haslower", validators.HasLower)
	_ = validate.RegisterValidation("hasdigit", validators.HasDigit)
	_ = validate.RegisterValidation("hasspecial", validators.HasSpecial)
	_ = validate.RegisterValidation("nodupes", validators.NoDupes)
	_ = validate.RegisterValidation("nospaces", validators.NoWhiteSpaces)
}

func loadProdEnv() {
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-2"))
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	client := ssm.NewFromConfig(cfg)
	out, err := client.GetParametersByPath(ctx, &ssm.GetParametersByPathInput{
		Path:           aws.String(envVarsPrefix),
		WithDecryption: aws.Bool(true),
		Recursive:      aws.Bool(true),
	})
	if err != nil {
		log.Fatalf("unable to load prod environment, %v", err)
	}

	prefixLength := len(envVarsPrefix)
	for _, param := range out.Parameters {
		key := (*param.Name)[prefixLength:]
		value := *param.Value
		if err := os.Setenv(key, value); err != nil {
			log.Fatalf("unable to set environment variable, %v", err)
		}
	}
	log.Debugf("loaded %d prod environment variables", len(out.Parameters))
}

func healthCheckRoute(c echo.Context) error {
	return c.String(200, "OK")
}
