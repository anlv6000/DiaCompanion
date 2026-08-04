// ============================================================================
//  CÁC ENUM CẦN THÊM / SỬA trong src/DiaCompanion.Api/Common/Enums.cs
// ============================================================================
//
// 1) SỬA enum UserRole hiện tại — thêm Receptionist = 4:
//
//    TRƯỚC:
//        public enum UserRole : byte { Admin = 0, Doctor = 1, Patient = 3 }
//    SAU:
//        public enum UserRole : byte { Admin = 0, Doctor = 1, Patient = 3, Receptionist = 4 }
//
//    Giữ nguyên Patient = 3 và Receptionist = 4; giá trị 2 từng dùng cho Nurse
//    được để trống, không đánh lại số enum.
//
// 2) THÊM enum mới ShiftType (ca làm việc):

namespace DiaCompanion.Api.Common;

/// <summary>Ca làm việc trong ngày (LT-2). Sáng / Chiều.</summary>
public enum ShiftType : byte
{
    Morning = 1,   // Ca sáng
    Afternoon = 2, // Ca chiều
}
