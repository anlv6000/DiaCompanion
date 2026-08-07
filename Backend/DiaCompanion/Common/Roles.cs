namespace DiaCompanion.Api.Common;

/// <summary>
/// Tên vai trò nghiệp vụ. Id của vai trò luôn được tra từ dbo.Roles; ứng dụng
/// không gắn cứng RoleId và không dùng enum để quyết định phân quyền.
/// </summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Doctor = "Doctor";
    public const string Patient = "Patient";
    public const string Receptionist = "Receptionist";

    public const string DoctorOnly = Doctor;
    public const string DoctorOrAdmin = "Admin,Doctor";
    public const string DoctorOrReception = "Doctor,Receptionist";
    public const string DoctorOrPatient = "Doctor,Patient";
    public const string FrontDesk = "Admin,Doctor,Receptionist";
    public const string FrontDeskOrAdmin = "Admin,Receptionist";
    public const string Staff = "Admin,Doctor,Receptionist";
    public const string StaffPatient = "Doctor,Receptionist";
    public const string VisitView = "Doctor,Patient";
    public const string AllRole = "Admin,Doctor,Receptionist,Patient";

    public static readonly string[] StaffAssignable = [Admin, Doctor, Receptionist];

    public static string Primary(IEnumerable<string> roles)
    {
        var set = new HashSet<string>(roles, StringComparer.OrdinalIgnoreCase);
        if (set.Contains(Admin)) return Admin;
        if (set.Contains(Doctor)) return Doctor;
        if (set.Contains(Receptionist)) return Receptionist;
        if (set.Contains(Patient)) return Patient;
        return "";
    }

    public static string DefaultRoute(IEnumerable<string> roles) => Primary(roles) switch
    {
        Doctor => "/triage",
        Admin => "/dashboard",
        Receptionist => "/reception/visits/new",
        Patient => "/home",
        _ => "/"
    };
}
