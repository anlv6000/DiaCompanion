using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;
using DiaCompanion.Api.Data;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

/// <summary>EF Core implementation of the repository/unit-of-work boundary.</summary>
public sealed class EfRepository : IRepository
{
    private readonly AppDbContext _db;

    public EfRepository(AppDbContext db) => _db = db;

    public DbSet<User> Users => _db.Users;
    public DbSet<OtpCode> OtpCodes => _db.OtpCodes;
    public DbSet<AuditLog> AuditLogs => _db.AuditLogs;
    public DbSet<SystemConfig> SystemConfigs => _db.SystemConfigs;
    public DbSet<Patient> Patients => _db.Patients;
    public DbSet<Visit> Visits => _db.Visits;
    public DbSet<FundusImage> FundusImages => _db.FundusImages;
    public DbSet<ModelVersion> ModelVersions => _db.ModelVersions;
    public DbSet<AiDiagnosis> AiDiagnoses => _db.AiDiagnoses;
    public DbSet<DiagnosisReview> DiagnosisReviews => _db.DiagnosisReviews;
    public DbSet<Prescription> Prescriptions => _db.Prescriptions;
    public DbSet<PrescriptionItem> PrescriptionItems => _db.PrescriptionItems;
    public DbSet<MedicationLog> MedicationLogs => _db.MedicationLogs;
    public DbSet<HealthMetric> HealthMetrics => _db.HealthMetrics;
    public DbSet<LifestyleLog> LifestyleLogs => _db.LifestyleLogs;
    public DbSet<SymptomReport> SymptomReports => _db.SymptomReports;
    public DbSet<Notification> Notifications => _db.Notifications;
    public DbSet<BlogPost> BlogPosts => _db.BlogPosts;
    public DbSet<Feedback> Feedbacks => _db.Feedbacks;

    public DatabaseFacade Database => _db.Database;
    public EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class => _db.Entry(entity);
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _db.SaveChangesAsync(cancellationToken);
    public Task<bool> CanConnectAsync(CancellationToken cancellationToken = default) =>
        _db.Database.CanConnectAsync(cancellationToken);
}
