// ============================================================================
//  CÁC ENUM CẦN THÊM / SỬA trong src/DiaCompanion.Api/Common/Enums.cs
// ============================================================================
//
// 1) SỬA enum UserRole hiện tại — thêm Receptionist = 4:
//
//    TRƯỚC:
//        public enum UserRole : byte { Admin = 0, Doctor = 1, Nurse = 2, Patient = 3 }
//    SAU:
//        public enum UserRole : byte { Admin = 0, Doctor = 1, Nurse = 2, Patient = 3, Receptionist = 4 }
//
//    Giữ nguyên các giá trị số cũ (0..3) để không phá dữ liệu đã có; chỉ nối
//    thêm 4 ở cuối.
//
// 2) THÊM enum mới ShiftType (ca làm việc):

namespace DiaCompanion.Api.Common;

/// <summary>Ca làm việc trong ngày (LT-2). Sáng / Chiều.</summary>
public enum ShiftType : byte
{
    Morning = 1,   // Ca sáng
    Afternoon = 2, // Ca chiều
}
