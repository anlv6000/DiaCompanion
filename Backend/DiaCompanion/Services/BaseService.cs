using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Services;

/// <summary>
/// Base class for application services. It contains only shared response helpers
/// and authorization guards; database access is delegated to IRepository.
/// </summary>
public abstract class BaseService : ControllerBase
{
    protected void EnsureCanAccessPatient(ICurrentUser me, int patientId)
    {
        if (me.Role == UserRole.Patient && me.PatientId != patientId)
            throw AppException.Forbidden(Msg.Forbidden, "Bạn không có quyền xem hồ sơ này.");
    }

    protected int RequireMyPatientId(ICurrentUser me) =>
        me.PatientId ?? throw AppException.Forbidden(Msg.Forbidden,
            "Tài khoản của bạn chưa được gắn với hồ sơ bệnh án.");
}
