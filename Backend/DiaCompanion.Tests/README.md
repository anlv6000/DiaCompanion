# DiaCompanion test suite

This project keeps the executable test code and the Report 5.1–5.4 test-case
catalogue in sync.

## Coverage layers

- **L1 behavioural tests:** direct xUnit tests with concrete assertions for
  `DeferralService`, `ClinicClock`, `ConfigService`, `FileStorageService`,
  `PasswordHasher`, `SymptomAdviceService`, `JwtTokenService`,
  `NotificationService`, `AuditService`, `AdherenceService`, `OtpService`, and
  `CurrentUser`. The tests follow the original `DiaCompanion.Tests` style:
  case ID in `DisplayName`, real production class as SUT, Moq only at external
  boundaries, and FluentAssertions for the outcome.
- **L1 traceability contracts:** 466 rows from Report 5.1 execute as xUnit
  theory data. Each row must resolve to the current service class/method and
  every documented `AppException` branch must still exist in source.
- **L2 endpoint contracts:** all 215 valid rows from Report 5.2 execute as xUnit
  theory data and must resolve to a current controller route and HTTP verb.
- **L2 database integration:** `ApiIntegrationTests` performs real HTTP calls
  through Controller → Service → Repository → SQL Server for authentication,
  RBAC, optimistic concurrency, and global-query-filter checks.
- **L3/L4:** system and user-acceptance cases are manual by nature. The updated
  workbooks contain execution/evidence fields and must not be marked Passed
  without screenshots, database evidence, or an attached defect reference.

The contract suites do not replace behavioural tests. Their purpose is to
ensure that every documented case remains executable, uniquely identified, and
traceable after source-code changes.

## Test naming convention

Every behavioural test keeps its testcase ID in the xUnit display name:

```csharp
[Fact(DisplayName = "TC-UNIT-OtpService-002 — Đúng OTP chỉ dùng một lần")]
public async Task VerifyAsync_Consumes_Valid_Code()
```

Use `Theory` only when the arrange/act/assert flow is identical and the input
is the only changing dimension. Database tests use `DatabaseFact` so a normal
test run can never touch an unapproved database.

## Safe database configuration

Integration tests refuse to run against a database whose name does not contain
`Test`.

PowerShell:

```powershell
$env:DIACOMPANION_TEST_CONNECTION_STRING = "Server=localhost;Database=DiaCompanion_Test;Trusted_Connection=True;TrustServerCertificate=True"
```

## Commands

```powershell
# Recommended: writes a TRX result file; database tests are excluded by default
.\run-tests.ps1

# Same suite with line/branch coverage
.\run-tests.ps1 -Coverage

# Real SQL Server integration tests
.\run-tests.ps1 -WithDatabase

# Real SQL Server integration tests with coverage
.\run-tests.ps1 -WithDatabase -Coverage
```

The six tests marked `Level=L2-Database` are automatically skipped unless
`DIACOMPANION_TEST_CONNECTION_STRING` exists and its database name contains
`Test`. Contract tests do not require SQL Server.

## Regenerating the catalogues

When Report 5.1 or 5.2 changes, run `tools/generate_test_manifests.py` from the
bundle root before committing. The generated JSON files are copied to the test
output directory and consumed by xUnit.
