using System.Reflection;
using DiaCompanion.Tests.Catalog;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace DiaCompanion.Tests.Integration;

/// <summary>
/// Một lượt kiểm tra cho mỗi ca L2 trong Report 5.2. Nhóm này phát hiện tài
/// liệu endpoint bị cũ sau khi đổi route hoặc HTTP verb. Các ca chạy xuyên
/// SQL Server nằm trong ApiIntegrationTests và chỉ chạy với database test.
/// </summary>
public class IntegrationEndpointContractTests
{
    private static readonly HashSet<string> CurrentEndpoints = DiscoverEndpoints();

    [Theory(DisplayName = "L2 — mọi test case phải ánh xạ tới endpoint hiện tại")]
    [MemberData(nameof(TestCaseCatalog.IntegrationCaseRows), MemberType = typeof(TestCaseCatalog))]
    [Trait("Level", "L2-Contract")]
    public void Integration_case_maps_to_current_endpoint(IntegrationTestCase testCase)
    {
        testCase.Id.Should().StartWith("TC-INT-");
        testCase.Endpoint.Should().StartWith("/api/");
        testCase.HttpMethod.Should().BeOneOf("GET", "POST", "PUT", "DELETE", "PATCH");
        testCase.Precondition.Should().NotBeNullOrWhiteSpace();
        testCase.Steps.Should().NotBeNullOrWhiteSpace();
        testCase.ExpectedResult.Should().NotBeNullOrWhiteSpace();

        var key = $"{testCase.HttpMethod.ToUpperInvariant()} {Normalize(testCase.Endpoint)}";
        CurrentEndpoints.Should().Contain(key,
            because: $"{testCase.Id} phải trỏ tới endpoint đang tồn tại");
    }

    [Fact(DisplayName = "L2 — mã test case không được trùng")]
    [Trait("Level", "L2-Contract")]
    public void Integration_case_ids_are_unique()
    {
        var duplicates = TestCaseCatalog.IntegrationCases
            .GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        duplicates.Should().BeEmpty();
    }

    private static HashSet<string> DiscoverEndpoints()
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var controllers = typeof(Program).Assembly.GetTypes()
            .Where(type => !type.IsAbstract && typeof(ControllerBase).IsAssignableFrom(type));

        foreach (var controller in controllers)
        {
            var controllerName = controller.Name.EndsWith("Controller", StringComparison.Ordinal)
                ? controller.Name[..^"Controller".Length]
                : controller.Name;
            var prefixes = controller.GetCustomAttributes<RouteAttribute>(inherit: true)
                .Select(attribute => attribute.Template.Replace("[controller]", controllerName,
                    StringComparison.OrdinalIgnoreCase))
                .DefaultIfEmpty(string.Empty);

            foreach (var method in controller.GetMethods(BindingFlags.Instance | BindingFlags.Public))
            foreach (var http in method.GetCustomAttributes<HttpMethodAttribute>(inherit: true))
            foreach (var prefix in prefixes)
            foreach (var verb in http.HttpMethods)
            {
                var route = Combine(prefix, http.Template);
                result.Add($"{verb.ToUpperInvariant()} {Normalize(route)}");
            }
        }

        return result;
    }

    private static string Combine(string? prefix, string? template)
    {
        var left = (prefix ?? string.Empty).Trim('/');
        var right = (template ?? string.Empty).Trim('/');
        return "/" + string.Join('/', new[] { left, right }.Where(value => value.Length > 0));
    }

    private static string Normalize(string route) =>
        "/" + route.Trim().Trim('/').ToLowerInvariant();
}
