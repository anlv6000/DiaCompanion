using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Services;

/// <summary>Base class chỉ chứa helper nghiệp vụ dùng chung, không truy cập persistence.</summary>
public abstract class BaseService : ControllerBase
{
    protected void EnsureCanAccessPatient(ICurrentUser me, int patientId)
    {
        // User có thêm role nhân viên thì quyền nhân viên được ưu tiên; chỉ tài khoản
        // thuần Patient mới bị giới hạn vào PatientId của chính mình.
        if (IsPatientOnly(me) && me.PatientId != patientId)
            throw AppException.Forbidden(Msg.Forbidden, "Bạn không có quyền xem hồ sơ này.");
    }

    protected int RequireMyPatientId(ICurrentUser me) =>
        me.PatientId ?? throw AppException.Forbidden(Msg.Forbidden,
            "Tài khoản của bạn chưa được gắn với hồ sơ bệnh án.");

    protected static bool IsPatientOnly(ICurrentUser me) =>
        me.IsInRole(Roles.Patient) && !me.IsInRole(Roles.Admin, Roles.Doctor, Roles.Receptionist);
}
