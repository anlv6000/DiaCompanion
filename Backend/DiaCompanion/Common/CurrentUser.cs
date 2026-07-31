using System.Security.Claims;

namespace DiaCompanion.Api.Common;

public interface ICurrentUser
{
    int? Id { get; }
    string? FullName { get; }
    UserRole? Role { get; }
    int? PatientId { get; }
    string? Ip { get; }
    bool IsInRole(params UserRole[] roles);
    int RequireId();
}

public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _http;
    public CurrentUser(IHttpContextAccessor http) => _http = http;

    private ClaimsPrincipal? P => _http.HttpContext?.User;

    public int? Id => int.TryParse(P?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var i) ? i : null;
    public string? FullName => P?.FindFirst("fullName")?.Value;
    public UserRole? Role => Enum.TryParse<UserRole>(P?.FindFirst(ClaimTypes.Role)?.Value, out var r) ? r : null;
    public int? PatientId => int.TryParse(P?.FindFirst("patientId")?.Value, out var i) ? i : null;
    public string? Ip => _http.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public bool IsInRole(params UserRole[] roles) => Role.HasValue && roles.Contains(Role.Value);

    public int RequireId() => Id ?? throw AppException.Unauthorized(Msg.SessionExpired, "Phiên đăng nhập đã hết hạn.");
}
