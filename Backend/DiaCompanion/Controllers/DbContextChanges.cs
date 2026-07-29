// ============================================================================
//  SỬA src/DiaCompanion.Api/Data/AppDbContext.cs
// ============================================================================
//
// 1) Thêm DbSet (khu vực các DbSet, cạnh DbSet<Visit>):
//
//        public DbSet<DoctorShift> DoctorShifts => Set<DoctorShift>();
//
// 2) Thêm cấu hình model trong OnModelCreating (đặt sau block cấu hình Visits):
//
//        /* --------------------------------------------------- DoctorShifts */
//        b.Entity<DoctorShift>(e =>
//        {
//            e.Property(x => x.Shift).HasConversion<byte>();
//
//            // Mỗi bác sĩ chỉ có một dòng cho mỗi (thứ, ca) — chống trùng lịch.
//            e.HasIndex(x => new { x.DoctorId, x.DayOfWeek, x.Shift }).IsUnique();
//
//            // Tra cứu nóng: "hôm nay (thứ mấy) ai đang trực".
//            e.HasIndex(x => new { x.DayOfWeek, x.Shift })
//                .HasFilter("[IsActive] = 1")
//                .HasDatabaseName("IX_DoctorShift_Duty");
//
//            e.HasOne(x => x.Doctor).WithMany()
//                .HasForeignKey(x => x.DoctorId).OnDelete(DeleteBehavior.NoAction);
//
//            // Chặn giá trị ngoài miền ngay ở tầng CSDL.
//            e.ToTable(t =>
//            {
//                t.HasCheckConstraint("CK_DoctorShift_Day", "[DayOfWeek] BETWEEN 0 AND 6");
//                t.HasCheckConstraint("CK_DoctorShift_Shift", "[Shift] IN (1, 2)");
//            });
//        });
//
//    DoctorShift KHÔNG có query filter IsVoided/IsDeleted (không phải bản ghi
//    lâm sàng, chỉ là lịch cấu hình) — bật/tắt bằng cột IsActive.
