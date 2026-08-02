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
    
    public const string DoctorOrReception = "Doctor,Receptionist";


    public const string Staff = "Admin,Doctor,Nurse";
    public const string FrontDesk = "Admin,Doctor,Nurse,Receptionist";
    public const string FrontDeskOrAdmin = "Admin,Receptionist";
    public const string StaffPatient = "Doctor,Nurse,Receptionist";
    public const string VisitView = "Doctor,Patient,Nurse";
    public const string QualityImage = "Doctor,Nurse";
}
