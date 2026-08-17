using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using DiaCompanion.Tests.Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Xunit;
using Microsoft.VisualStudio.TestPlatform.TestHost;

namespace DiaCompanion.Tests.Integration;

/// <summary>
/// Bốn ID trong Report 5.2 có bằng chứng Database E2E trực tiếp; hai ca EXT-L2
/// bổ sung kiểm tra lỗi đăng nhập và yêu cầu ẩn danh nhưng không chiếm một dòng
/// riêng trong danh mục endpoint.
///
/// Khác biệt căn bản với unit test: KHÔNG giả lập tầng nào. Request đi qua đúng
/// chuỗi Controller → Service → Repository → SQL Server như lúc chạy thật, nên
/// nó bắt được những lỗi mà unit test không thể thấy: định tuyến sai, thiếu
/// đăng ký dịch vụ trong DI, ràng buộc CHECK của cơ sở dữ liệu, lệch tên trường
/// khi tuần tự hoá JSON, và phân quyền ở tầng middleware.
///
/// Chính vì vậy nó cần một cơ sở dữ liệu THẬT. Trỏ vào một database riêng cho
/// kiểm thử, không dùng database vận hành.
/// </summary>
public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
            builder.UseSetting("ConnectionStrings:Default",
                GetTestConnectionString()));
    }

    private static string GetTestConnectionString()
    {
        var connectionString = Environment.GetEnvironmentVariable(
            "DIACOMPANION_TEST_CONNECTION_STRING")
            ?? "Server=localhost;Database=DiaCompanion_Test;Trusted_Connection=True;TrustServerCertificate=True";

        var builder = new SqlConnectionStringBuilder(connectionString);
        if (!builder.InitialCatalog.Contains("Test", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Integration test chỉ được phép chạy trên database có chữ 'Test' trong tên.");

        return connectionString;
    }

    private async Task<HttpClient> SignInAsync(string loginId, string password)
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { loginId, password });
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<LoginBody>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", body!.token);
        return client;
    }

    private sealed record LoginBody(string token, string role, string defaultRoute);

    // ------------------------------------------------------------------ auth

    [DatabaseFact(DisplayName = "TC-INT-Auth-003 — Đăng nhập đúng trả token và tuyến mặc định theo vai trò")]
    [Trait("Level", "L2-Database")]
    public async Task Login_With_Valid_Credentials_Returns_Token()
    {
        var client = _factory.CreateClient();

        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { loginId = "doctor@hospital.test", password = "Doctor@123" });

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await res.Content.ReadFromJsonAsync<LoginBody>();
        body!.token.Should().NotBeNullOrWhiteSpace();
        body.defaultRoute.Should().NotBeNullOrWhiteSpace();
    }

    [DatabaseFact(DisplayName = "EXT-L2-Auth-Login-WrongPassword — Sai mật khẩu trả 401")]
    [Trait("Level", "L2-Database")]
    public async Task Login_With_Wrong_Password_Returns_401()
    {
        var client = _factory.CreateClient();

        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { loginId = "doctor@hospital.test", password = "sai-mat-khau" });

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ------------------------------------------------------------------ RBAC

    [DatabaseFact(DisplayName = "TC-INT-Admin-006-AUTH — Bác sĩ gọi endpoint quản trị mô hình bị chặn")]
    [Trait("Level", "L2-Database")]
    public async Task Doctor_Cannot_Call_Admin_Endpoint()
    {
        // Đây là điều unit test KHÔNG kiểm được: phân quyền do thuộc tính
        // [Authorize(Roles = ...)] thực thi ở đường ống HTTP, không nằm trong
        // thân phương thức của service.
        var client = await SignInAsync("doctor@hospital.test", "Doctor@123");

        var res = await client.GetAsync("/api/admin/models");

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [DatabaseFact(DisplayName = "EXT-L2-Authorization-Anonymous — Không có token thì endpoint nghiệp vụ trả 401")]
    [Trait("Level", "L2-Database")]
    public async Task Anonymous_Request_Is_Rejected()
    {
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/api/patients?page=1&pageSize=10");

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ------------------------------------------------------------------ concurrency

    [DatabaseFact(DisplayName = "TC-INT-Patients-011 — rowVersion cũ bị từ chối bằng 409")]
    [Trait("Level", "L2-Database")]
    public async Task Stale_RowVersion_Returns_Conflict()
    {
        // Xung đột đồng thời chỉ tái hiện được với SQL Server thật, vì giá trị
        // rowversion do chính cơ sở dữ liệu sinh ra ở mỗi lần ghi.
        var client = await SignInAsync("reception@hospital.test", "Reception@123");

        var created = await client.PostAsJsonAsync("/api/patients", new
        {
            fullName = "Kiem Thu Dong Thoi",
            phone = "0911111111",
            dateOfBirth = "1980-01-01",
            gender = 1,
            createAccount = false,
        });
        created.EnsureSuccessStatusCode();
        var patient = await created.Content.ReadFromJsonAsync<PatientBody>();

        // Lần cập nhật thứ nhất thành công và làm rowVersion cũ hết hiệu lực.
        var first = await client.PutAsJsonAsync($"/api/patients/{patient!.id}", new
        {
            fullName = "Ten Da Sua Lan Mot",
            rowVersion = patient.rowVersion,
        });
        first.EnsureSuccessStatusCode();

        // Lần thứ hai dùng lại rowVersion cũ — mô phỏng hai người sửa cùng lúc.
        var second = await client.PutAsJsonAsync($"/api/patients/{patient.id}", new
        {
            fullName = "Ten Da Sua Lan Hai",
            rowVersion = patient.rowVersion,
        });

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    private sealed record PatientBody(int id, string patientCode, string rowVersion);

    // ------------------------------------------------------------------ void

    [DatabaseFact(DisplayName = "TC-INT-Visits-001 — Bản ghi đã thu hồi biến mất khỏi danh sách lượt khám")]
    [Trait("Level", "L2-Database")]
    public async Task Voided_Record_Is_Hidden_By_Global_Query_Filter()
    {
        // Bộ lọc truy vấn toàn cục của EF Core chỉ có tác dụng khi chạy qua
        // DbContext thật, nên đây bắt buộc là integration test.
        var client = await SignInAsync("doctor@hospital.test", "Doctor@123");

        var list = await client.GetAsync("/api/visits?page=1&pageSize=50");
        list.EnsureSuccessStatusCode();

        var json = await list.Content.ReadAsStringAsync();
        json.Should().NotContain("\"isVoided\":true",
            because: "bản ghi đã thu hồi phải bị bộ lọc toàn cục loại khỏi kết quả");
    }
}
