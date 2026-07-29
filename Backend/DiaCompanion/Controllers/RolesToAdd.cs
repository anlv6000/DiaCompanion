// ============================================================================
//  SỬA Roles trong src/DiaCompanion.Api/Controllers/BaseApiController.cs
// ============================================================================
//
// Thêm hằng cho lễ tân và các nhóm quyền liên quan. Dán vào class Roles:
//
//     public const string Receptionist = "Receptionist";
//
//     // Quầy tiếp đón: lễ tân + các vai trò lâm sàng vẫn thao tác được đầu quầy.
//     // Dùng cho: tạo hồ sơ bệnh nhân, mở lượt khám, gán bác sĩ.
//     public const string FrontDesk = "Admin,Doctor,Nurse,Receptionist";
//
//     // Quản lý lịch trực: lễ tân xếp lịch, admin giám sát.
//     public const string FrontDeskOrAdmin = "Admin,Receptionist";
//
// Sau khi thêm, class Roles đầy đủ trông như sau:
//
//     public static class Roles
//     {
//         public const string Admin = "Admin";
//         public const string Doctor = "Doctor";
//         public const string Nurse = "Nurse";
//         public const string Patient = "Patient";
//         public const string Receptionist = "Receptionist";
//
//         public const string Clinical = "Admin,Doctor,Nurse";
//         public const string DoctorOnly = "Doctor";
//         public const string DoctorOrAdmin = "Admin,Doctor";
//         public const string Staff = "Admin,Doctor,Nurse";
//         public const string FrontDesk = "Admin,Doctor,Nurse,Receptionist";
//         public const string FrontDeskOrAdmin = "Admin,Receptionist";
//     }
//
// ----------------------------------------------------------------------------
//  MỞ QUYỀN cho lễ tân ở các endpoint ĐÃ CÓ (đổi Roles.Staff -> Roles.FrontDesk)
// ----------------------------------------------------------------------------
//
// 1) PatientsController.Create  (tạo hồ sơ + tài khoản bệnh nhân)
//        TRƯỚC:  [Authorize(Roles = Roles.Staff)]
//        SAU:    [Authorize(Roles = Roles.FrontDesk)]
//
// 2) PatientsController — reissue-credentials (cấp lại mật khẩu tạm để in phiếu)
//        TRƯỚC:  [Authorize(Roles = Roles.Staff)]   // nếu đang là Staff
//        SAU:    [Authorize(Roles = Roles.FrontDesk)]
//
// 3) VisitsController.Create  (mở lượt khám, gán DoctorId)
//        TRƯỚC:  [Authorize(Roles = Roles.Staff)]
//        SAU:    [Authorize(Roles = Roles.FrontDesk)]
//
//    Lưu ý: VisitsController.Create hiện đặt DoctorId mặc định theo người tạo
//    nếu người tạo là Doctor:
//        DoctorId = req.DoctorId ?? (_me.Role == UserRole.Doctor ? _me.Id : null)
//    Với lễ tân, _me.Role != Doctor nên DoctorId sẽ lấy đúng từ req.DoctorId mà
//    lễ tân chọn (bác sĩ đang trực). Không cần sửa dòng này.
//
// KHÔNG mở các endpoint lâm sàng khác (đóng lượt, chạy AI, kê đơn…) cho lễ tân —
// giữ nguyên Roles.DoctorOnly / Roles.Clinical như cũ.
