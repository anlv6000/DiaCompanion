using System.Text.Json;

namespace DiaCompanion.Tests.Catalog;

public sealed record UnitTestCase(
    string Id,
    string ClassUnderTest,
    string MethodUnderTest,
    string Traceability,
    string Scenario,
    string TestType,
    string DesignTechnique,
    string Covers,
    string Given,
    string When,
    string Then,
    string Priority,
    string Status,
    string DefectId,
    string Sheet);

public sealed record IntegrationTestCase(
    string Id,
    string IntegrationPoint,
    string Endpoint,
    string HttpMethod,
    string AuthorisedRole,
    string InterfacesExercised,
    string Scenario,
    string Precondition,
    string Steps,
    string ExpectedResult,
    string Priority,
    string Status,
    string DefectId,
    string Sheet);

public static class TestCaseCatalog
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static IReadOnlyList<UnitTestCase> UnitCases { get; } =
        Load<UnitTestCase>("unit-cases.json");

    public static IReadOnlyList<IntegrationTestCase> IntegrationCases { get; } =
        Load<IntegrationTestCase>("integration-cases.json");

    public static IEnumerable<object[]> UnitCaseRows() =>
        UnitCases.Select(item => new object[] { item });

    public static IEnumerable<object[]> IntegrationCaseRows() =>
        IntegrationCases.Select(item => new object[] { item });

    private static IReadOnlyList<T> Load<T>(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "TestCases", fileName);
        if (!File.Exists(path))
            throw new FileNotFoundException($"Không tìm thấy danh mục test case: {path}", path);

        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<List<T>>(json, Options)
               ?? throw new InvalidDataException($"Không đọc được danh mục test case {fileName}.");
    }
}
