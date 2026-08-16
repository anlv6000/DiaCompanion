using System.Reflection;
using System.Text.RegularExpressions;
using DiaCompanion.Tests.Catalog;
using FluentAssertions;
using Xunit;

namespace DiaCompanion.Tests.Traceability;

/// <summary>
/// Thực thi một dòng test cho mỗi ca L1 trong Report 5.1.
///
/// Nhóm này kiểm tra hợp đồng truy vết của toàn bộ ma trận: lớp và phương thức
/// phải tồn tại trong assembly hiện tại; nhánh AppException được tài liệu hoá
/// phải còn tồn tại trong mã nguồn. Các kiểm thử hành vi chuyên sâu nằm ở các
/// lớp *ServiceTests tương ứng.
/// </summary>
public class DocumentationTraceabilityTests
{
    [Theory(DisplayName = "L1 — mọi test case phải truy được về mã nguồn hiện tại")]
    [MemberData(nameof(TestCaseCatalog.UnitCaseRows), MemberType = typeof(TestCaseCatalog))]
    [Trait("Level", "L1-Traceability")]
    public void Unit_case_maps_to_current_service_contract(UnitTestCase testCase)
    {
        testCase.Id.Should().StartWith("TC-UNIT-");
        testCase.Scenario.Should().NotBeNullOrWhiteSpace();
        testCase.Given.Should().NotBeNullOrWhiteSpace();
        testCase.When.Should().NotBeNullOrWhiteSpace();
        testCase.Then.Should().NotBeNullOrWhiteSpace();
        testCase.Priority.Should().BeOneOf("Critical", "High", "Medium", "Low");

        var serviceType = typeof(Program).Assembly.GetType(
            $"DiaCompanion.Api.Services.{testCase.ClassUnderTest}");

        serviceType.Should().NotBeNull(
            because: $"{testCase.Id} tham chiếu lớp {testCase.ClassUnderTest}");

        var methods = serviceType!.GetMethods(
            BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);
        methods.Should().Contain(
            method => method.Name == testCase.MethodUnderTest,
            because: $"{testCase.Id} tham chiếu phương thức {testCase.MethodUnderTest}");

        VerifyDocumentedExceptionBranch(testCase);
    }

    [Fact(DisplayName = "L1 — mã test case không được trùng")]
    [Trait("Level", "L1-Traceability")]
    public void Unit_case_ids_are_unique()
    {
        var duplicates = TestCaseCatalog.UnitCases
            .GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        duplicates.Should().BeEmpty();
    }

    private static void VerifyDocumentedExceptionBranch(UnitTestCase testCase)
    {
        var match = Regex.Match(
            testCase.Covers,
            @"AppException\.(?<factory>[A-Za-z]+)\(Msg\.(?<message>[A-Za-z0-9_]+)\)");

        if (!match.Success)
            return;

        var sourcePath = FindServiceSource(testCase.ClassUnderTest);
        var source = File.ReadAllText(sourcePath);
        var factory = match.Groups["factory"].Value;
        var message = match.Groups["message"].Value;

        source.Should().Contain($"AppException.{factory}",
            because: $"{testCase.Id} mô tả factory AppException.{factory}");
        source.Should().Contain($"Msg.{message}",
            because: $"{testCase.Id} mô tả mã Msg.{message}");
    }

    private static string FindServiceSource(string className)
    {
        DirectoryInfo? current = new(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "DiaCompanion", "Services", $"{className}.cs");
            if (File.Exists(candidate))
                return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Không tìm thấy mã nguồn Services/{className}.cs.");
    }
}
