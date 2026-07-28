namespace DiaCompanion.Api.Common;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Doctor = "Doctor";
    public const string Nurse = "Nurse";
    public const string Patient = "Patient";
    public const string Receptionist = "Receptionist";

    public const string Clinical = "Admin,Doctor,Nurse";
    public const string DoctorOnly = "Doctor";
    public const string DoctorOrAdmin = "Admin,Doctor";
    public const string Staff = "Admin,Doctor,Nurse";
}
