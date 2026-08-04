namespace DiaCompanion.Api.Common;

/// <summary>Nhóm vai trò dùng cho authorization của web/API.</summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Doctor = "Doctor";
    public const string Patient = "Patient";
    public const string Receptionist = "Receptionist";

    public const string DoctorOnly = Doctor;
    public const string DoctorOrAdmin = "Admin,Doctor";
    public const string DoctorOrReception = "Doctor,Receptionist";
    public const string FrontDesk = "Admin,Doctor,Receptionist";
    public const string FrontDeskOrAdmin = "Admin,Receptionist";
    public const string Staff = "Admin,Doctor";
    public const string StaffPatient = "Doctor,Receptionist";
    public const string VisitView = "Doctor,Patient";
    public const string AllRole = "Admin,Doctor,Receptionist,Patient";
}
