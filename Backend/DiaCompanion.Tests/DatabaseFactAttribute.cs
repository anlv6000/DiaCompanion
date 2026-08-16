using Microsoft.Data.SqlClient;
using Xunit;

namespace DiaCompanion.Tests.Helpers;

/// <summary>
/// Chỉ bật test xuyên SQL Server khi người chạy đã cấu hình rõ một database test.
/// Điều này giúp <c>dotnet test</c> mặc định vẫn chạy được toàn bộ unit/contract
/// suite mà không vô tình chạm database phát triển hoặc database vận hành.
/// </summary>
public sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        var connectionString = Environment.GetEnvironmentVariable(
            "DIACOMPANION_TEST_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Skip = "Chưa cấu hình DIACOMPANION_TEST_CONNECTION_STRING.";
            return;
        }

        try
        {
            var database = new SqlConnectionStringBuilder(connectionString).InitialCatalog;
            if (!database.Contains("Test", StringComparison.OrdinalIgnoreCase))
                Skip = "Integration test chỉ chạy trên database có chữ 'Test' trong tên.";
        }
        catch (ArgumentException)
        {
            Skip = "DIACOMPANION_TEST_CONNECTION_STRING không hợp lệ.";
        }
    }
}
