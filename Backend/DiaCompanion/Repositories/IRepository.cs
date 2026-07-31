using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Repositories;

/// <summary>
/// Repository + Unit of Work boundary. Application services never receive
/// AppDbContext directly; all persistence goes through this contract.
/// </summary>
public interface IRepository
{
    DbSet<User> Users { get; }
    DbSet<OtpCode> OtpCodes { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<SystemConfig> SystemConfigs { get; }
    DbSet<Patient> Patients { get; }
    DbSet<Visit> Visits { get; }
    DbSet<FundusImage> FundusImages { get; }
    DbSet<ModelVersion> ModelVersions { get; }
    DbSet<AiDiagnosis> AiDiagnoses { get; }
    DbSet<DiagnosisReview> DiagnosisReviews { get; }
    DbSet<Prescription> Prescriptions { get; }
    DbSet<PrescriptionItem> PrescriptionItems { get; }
    DbSet<MedicationLog> MedicationLogs { get; }
    DbSet<HealthMetric> HealthMetrics { get; }
    DbSet<LifestyleLog> LifestyleLogs { get; }
    DbSet<SymptomReport> SymptomReports { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<BlogPost> BlogPosts { get; }
    DbSet<Feedback> Feedbacks { get; }
    
    DbSet<DoctorShift> DoctorShifts { get; }
    DatabaseFacade Database { get; }
    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task<bool> CanConnectAsync(CancellationToken cancellationToken = default);
}
