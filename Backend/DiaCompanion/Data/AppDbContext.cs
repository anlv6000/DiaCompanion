using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SystemConfig> SystemConfigs => Set<SystemConfig>();

    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Visit> Visits => Set<Visit>();
    public DbSet<FundusImage> FundusImages => Set<FundusImage>();
    public DbSet<ModelVersion> ModelVersions => Set<ModelVersion>();
    public DbSet<AiDiagnosis> AiDiagnoses => Set<AiDiagnosis>();
    public DbSet<DiagnosisReview> DiagnosisReviews => Set<DiagnosisReview>();

    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();
    public DbSet<MedicationLog> MedicationLogs => Set<MedicationLog>();
    public DbSet<HealthMetric> HealthMetrics => Set<HealthMetric>();
    public DbSet<LifestyleLog> LifestyleLogs => Set<LifestyleLog>();
    public DbSet<SymptomReport> SymptomReports => Set<SymptomReport>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<BlogPost> BlogPosts => Set<BlogPost>();
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<DoctorShift> DoctorShifts => Set<DoctorShift>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        /* ---------------------------------------------------------------
           NF-14: mọi truy vấn đọc mặc định loại bản ghi đã thu hồi.
           Đặt ở tầng model để không phụ thuộc việc lập trình viên nhớ
           thêm .Where(x => !x.IsVoided) ở từng câu truy vấn.
           Cần lấy cả bản ghi đã void (màn audit) thì dùng IgnoreQueryFilters().
           --------------------------------------------------------------- */
        b.Entity<Patient>().HasQueryFilter(x => !x.IsVoided);
        b.Entity<Visit>().HasQueryFilter(x => !x.IsVoided);
        b.Entity<FundusImage>().HasQueryFilter(x => !x.IsVoided);
        b.Entity<AiDiagnosis>().HasQueryFilter(x => !x.IsVoided);
        b.Entity<DiagnosisReview>().HasQueryFilter(x => !x.IsVoided);
        b.Entity<Prescription>().HasQueryFilter(x => !x.IsVoided);

        b.Entity<HealthMetric>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<LifestyleLog>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<SymptomReport>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<BlogPost>().HasQueryFilter(x => !x.IsDeleted);
        b.Entity<Feedback>().HasQueryFilter(x => !x.IsDeleted);

        /* --------------------------------------------------------- Users */
        b.Entity<User>(e =>
        {
            e.Property(x => x.Role).HasConversion<byte>();
            e.Property(x => x.PublicId).HasDefaultValueSql("NEWID()");
            // QT-2: unique CÓ ĐIỀU KIỆN. Unique thường sẽ khiến số điện thoại của
            // tài khoản đã khoá bị giữ vĩnh viễn, không đăng ký lại được.
            e.HasIndex(x => x.Phone).IsUnique().HasFilter("[Phone] IS NOT NULL AND [IsActive] = 1");
            e.HasIndex(x => x.Email).IsUnique().HasFilter("[Email] IS NOT NULL AND [IsActive] = 1");
            e.HasIndex(x => x.PublicId).IsUnique();
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
        });

        /* ------------------------------------------------------ Patients */
        b.Entity<Patient>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique().HasFilter("[IsVoided] = 0");
            // LI-6: một SĐT định danh đúng một bệnh nhân còn hiệu lực.
            // Filter cho phép dùng lại số sau khi hồ sơ sai bị thu hồi.
            e.HasIndex(x => x.Phone).IsUnique().HasFilter("[IsVoided] = 0");
            e.HasIndex(x => x.UserId).IsUnique().HasFilter("[UserId] IS NOT NULL AND [IsVoided] = 0");
            e.HasIndex(x => x.FullNameSearch);
            e.Property(x => x.BaselineHbA1c).HasPrecision(4, 1);
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");

            e.HasOne(x => x.User).WithOne(u => u.Patient)
                .HasForeignKey<Patient>(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
        });

        /* -------------------------------------------------------- Visits */
        b.Entity<Visit>(e =>
        {
            e.Property(x => x.Status).HasConversion<byte>();
            e.Property(x => x.Referral).HasConversion<byte?>();
            e.HasIndex(x => new { x.PatientId, x.VisitDate });
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasOne(x => x.Patient).WithMany(p => p.Visits)
                .HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Doctor).WithMany()
                .HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.NoAction);
        });

        /* -------------------------------------------------- FundusImages */
        b.Entity<FundusImage>(e =>
        {
            e.Property(x => x.Eye).HasConversion<byte>();
            e.Property(x => x.QualityStatus).HasConversion<byte>();
            e.HasIndex(x => x.VisitId);
            e.HasIndex(x => new { x.PatientId, x.CreatedAt });
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasOne(x => x.Patient).WithMany(p => p.Images)
                .HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Visit).WithMany(v => v.Images)
                .HasForeignKey(x => x.VisitId).OnDelete(DeleteBehavior.NoAction);
        });

        /* --------------------------------------------------- AiDiagnoses */
        b.Entity<AiDiagnosis>(e =>
        {
            e.Property(x => x.DrGrade).HasConversion<byte>();
            e.Property(x => x.LesionGradeImplied).HasConversion<byte?>();
            e.Property(x => x.DeferReason).HasConversion<byte?>();
            e.Property(x => x.Confidence).HasPrecision(5, 4);
            e.Property(x => x.Disagreement).HasPrecision(5, 4);
            e.Property(x => x.ConfidenceThreshold).HasPrecision(5, 4);
            e.Property(x => x.DisagreementThreshold).HasPrecision(5, 4);
            e.Property(x => x.FractalDimension).HasPrecision(6, 4);
            foreach (var p in new[] { "AreaMA", "AreaHE", "AreaEX", "AreaSE" })
                e.Property(p).HasPrecision(9, 6);

            // QT-9: token chống tương tranh — hai bác sĩ cùng duyệt một ca thì
            // người thứ hai nhận 409 thay vì ghi đè âm thầm.
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");

            // UC-30: index phục vụ hàng đợi triage, truy vấn nóng nhất hệ thống
            e.HasIndex(x => new { x.IsDeferred, x.Disagreement, x.CreatedAt })
                .HasFilter("[IsVoided] = 0")
                .HasDatabaseName("IX_AiDx_Triage");
            e.HasIndex(x => x.FundusImageId);

            e.HasOne(x => x.FundusImage).WithMany(f => f.Diagnoses)
                .HasForeignKey(x => x.FundusImageId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.ModelVersion).WithMany()
                .HasForeignKey(x => x.ModelVersionId).OnDelete(DeleteBehavior.NoAction);
        });

        /* ---------------------------------------------- DiagnosisReviews */
        b.Entity<DiagnosisReview>(e =>
        {
            e.Property(x => x.Action).HasConversion<byte>();
            e.Property(x => x.FinalGrade).HasConversion<byte>();
            // Một kết quả AI chỉ có đúng một review còn hiệu lực.
            // Đây là chốt chặn cuối nếu kiểm tra tầng ứng dụng bị vượt qua.
            e.HasIndex(x => x.AiDiagnosisId).IsUnique().HasFilter("[IsVoided] = 0");
            e.HasIndex(x => new { x.DoctorId, x.CreatedAt });
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasOne(x => x.AiDiagnosis).WithMany(d => d.Reviews)
                .HasForeignKey(x => x.AiDiagnosisId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Doctor).WithMany()
                .HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.NoAction);
        });

        /* -------------------------------------------------- ModelVersions */
        b.Entity<ModelVersion>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            // BR-15: tại mỗi thời điểm chỉ một phiên bản kích hoạt
            e.HasIndex(x => x.IsActive).IsUnique().HasFilter("[IsActive] = 1");
            e.Property(x => x.Qwk).HasPrecision(5, 4);
            e.Property(x => x.Dice).HasPrecision(5, 4);
            e.Property(x => x.IoU).HasPrecision(5, 4);
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
        });

        /* -------------------------------------------------- Prescriptions */
        b.Entity<Prescription>(e =>
        {
            e.HasIndex(x => new { x.PatientId, x.IssuedAt });
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Doctor).WithMany().HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<PrescriptionItem>(e =>
        {
            e.Property(x => x.IsActive).HasDefaultValue(true);
            // QT-6: NO ACTION, tuyệt đối không cascade. Xoá cứng một đơn thuốc
            // sẽ kéo mất MedicationLogs — tức là xoá sạch lịch sử tuân thủ thuốc
            // mà bác sĩ dùng để đánh giá nguy cơ tiến triển.
            e.HasOne(x => x.Prescription).WithMany(p => p.Items)
                .HasForeignKey(x => x.PrescriptionId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.PrescriptionId, x.IsActive });
        });

        b.Entity<MedicationLog>(e =>
        {
            e.Property(x => x.Status).HasConversion<byte>();
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasIndex(x => new { x.PatientId, x.ScheduledAt });
            e.HasIndex(x => new { x.Status, x.ScheduledAt, x.ReminderSentAt });
            e.HasOne(x => x.PrescriptionItem).WithMany(i => i.Logs)
                .HasForeignKey(x => x.PrescriptionItemId).OnDelete(DeleteBehavior.NoAction);
        });

        /* -------------------------------------------------- HealthMetrics */
        b.Entity<HealthMetric>(e =>
        {
            e.Property(x => x.MetricType).HasConversion<byte>();
            e.Property(x => x.Context).HasConversion<byte?>();
            e.Property(x => x.Value).HasPrecision(6, 2);
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            // QT-12: clustered index thay cho partition. ~1,1 triệu dòng/năm
            // là quá nhỏ để cần partition; index này đạt đúng mục tiêu đó.
            // PK phải NONCLUSTERED để nhường vị trí clustered cho
            // (PatientId, RecordedAtUtc) — một bảng chỉ có một clustered index.
            e.HasKey(x => x.Id).IsClustered(false);
            e.HasIndex(x => new { x.PatientId, x.RecordedAtUtc }).IsClustered();
            e.HasIndex(x => new { x.PatientId, x.MetricType, x.RecordedLocalDate })
                .HasFilter("[IsDeleted] = 0");
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<LifestyleLog>(e =>
        {
            e.HasIndex(x => new { x.PatientId, x.LogLocalDate });
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
        });

        b.Entity<SymptomReport>(e =>
        {
            e.Property(x => x.Severity).HasConversion<byte>();
            e.HasIndex(x => new { x.PatientId, x.CreatedAt });
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.ResponsibleDoctor).WithMany()
                .HasForeignKey(x => x.ResponsibleDoctorId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.ResponsibleDoctorId, x.CreatedAt });
        });

        b.Entity<Notification>(e =>
        {
            e.Property(x => x.Type).HasConversion<byte>();
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        b.Entity<BlogPost>(e =>
        {
            e.Property(x => x.Category).HasConversion<byte>();
            e.HasIndex(x => x.PublishedAt).HasFilter("[IsPublished] = 1 AND [IsDeleted] = 0");
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<Feedback>(e =>
        {
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => new { x.PatientId, x.VisitId })
                .IsUnique()
                .HasFilter("[VisitId] IS NOT NULL AND [IsDeleted] = 0");
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne<Visit>().WithMany().HasForeignKey(x => x.VisitId).OnDelete(DeleteBehavior.NoAction);
        });

        /* ------------------------------------------------------ AuditLogs */
        b.Entity<AuditLog>(e =>
        {
            e.HasIndex(x => new { x.CreatedAt, x.Id }).HasDatabaseName("IX_Audit_Created");
            e.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAt });
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<OtpCode>(e =>
        {
            e.Property(x => x.Purpose).HasConversion<byte>();
            e.HasIndex(x => new { x.Phone, x.ExpiresAt }).HasFilter("[ConsumedAt] IS NULL");
        });

        b.Entity<SystemConfig>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasColumnName("Key");
            e.Property(x => x.MinValue).HasPrecision(10, 4);
            e.Property(x => x.MaxValue).HasPrecision(10, 4);
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");
        });
        b.Entity<DoctorShift>(e =>
        {
            e.Property(x => x.Shift).HasConversion<byte>();

            e.HasIndex(x => new { x.DoctorId, x.DayOfWeek, x.Shift })
                .IsUnique();
            e.Property(x => x.RowVer).IsRowVersion().HasColumnName("RowVer");

            e.HasOne(x => x.Doctor)
                .WithMany()
                .HasForeignKey(x => x.DoctorId)
                .OnDelete(DeleteBehavior.NoAction);
        });
    }

    /// <summary>
    /// Tự sinh cột tìm kiếm bỏ dấu (QT-15) để không phụ thuộc việc từng chỗ
    /// gọi có nhớ gán hay không.
    /// </summary>
    public override int SaveChanges()
    {
        NormalizeSearchColumns();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        NormalizeSearchColumns();
        return base.SaveChangesAsync(ct);
    }

    private void NormalizeSearchColumns()
    {
        foreach (var entry in ChangeTracker.Entries<Patient>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified)
                entry.Entity.FullNameSearch = VietnameseText.RemoveDiacritics(entry.Entity.FullName);
        }
    }
}
