using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Data;
using DiaCompanion.Api.Middleware;
using DiaCompanion.Api.Services;
using DiaCompanion.Api.Repositories;

var builder = WebApplication.CreateBuilder(args);

/* ------------------------------------------------------------------ config */
// QT-19: secret đọc từ biến môi trường, KHÔNG từ bảng SystemConfigs.
// Ví dụ: JWT__SIGNINGKEY=... (hai gạch dưới = phân cấp)
builder.Configuration.AddEnvironmentVariables();

/* ---------------------------------------------------------------- services */
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default"),
        sql => sql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null)));

// Repository is scoped together with AppDbContext (one Unit of Work per request).
builder.Services.AddScoped<IRepository, EfRepository>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<IClinicClock, ClinicClock>();
builder.Services.AddSingleton<IDeferralService, DeferralService>();
builder.Services.AddSingleton<ISymptomAdviceService, SymptomAdviceService>();
builder.Services.AddSingleton<IFileStorageService, FileStorageService>();

builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IConfigService, ConfigService>();
builder.Services.AddScoped<IVoidService, VoidService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IAdherenceService, AdherenceService>();
builder.Services.AddScoped<IOtpService, OtpService>();

builder.Services.AddHttpClient<IAiInferenceClient, AiInferenceClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["AiService:BaseUrl"] ?? "http://localhost:8000");
    // QA-02: suy luận không được vượt quá ngưỡng thời gian đã cam kết
    c.Timeout = TimeSpan.FromSeconds(builder.Configuration.GetValue<int?>("AiService:TimeoutSeconds") ?? 60);
});

// Application services: Controller -> Service -> Repository
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IBlogService, BlogService>();
builder.Services.AddScoped<IDiagnosesService, DiagnosesService>();
builder.Services.AddScoped<IEngagementService, EngagementService>();
builder.Services.AddScoped<IExportService, ExportService>();
builder.Services.AddScoped<IImagesService, ImagesService>();
builder.Services.AddScoped<IMonitoringService, MonitoringService>();
builder.Services.AddScoped<IPatientsService, PatientsService>();
builder.Services.AddScoped<IPrescriptionsService, PrescriptionsService>();
builder.Services.AddScoped<IRecheckService, RecheckService>();
builder.Services.AddScoped<ITriageService, TriageService>();
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IVisitsService, VisitsService>();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        o.JsonSerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    });

/* --------------------------------------------------------------------- JWT */
var jwtService = new JwtTokenService(builder.Configuration);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = jwtService.SigningKey,
            // Mặc định .NET cho lệch 5 phút; siết lại để phiên hết hạn đúng lúc
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(o => o.AddPolicy("app", p => p
    .WithOrigins("http://localhost:5173", "http://localhost:9001", "http://localhost:8081" , "app://.")
    .AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "DiaCompanion API",
        Version = "v1",
        Description = "Hệ thống hỗ trợ sàng lọc bệnh võng mạc đái tháo đường — SET490-G6"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = Array.Empty<string>()
    });
});

var app = builder.Build();

/* -------------------------------------------------------------- pipeline */
app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "DiaCompanion API v1"));
}

app.UseCors("app");
app.UseAuthentication();
app.UseMiddleware<MustChangePasswordMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/health", async (IRepository repository) =>
{
    var canConnect = await repository.CanConnectAsync();
    return Results.Ok(new
    {
        status = canConnect ? "healthy" : "degraded",
        database = canConnect,
        utcNow = DateTime.UtcNow
    });
}).AllowAnonymous();

app.Run();
