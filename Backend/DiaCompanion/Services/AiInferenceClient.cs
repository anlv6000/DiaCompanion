using System.Text.Json;
using System.Text.Json.Serialization;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Services;

/// <summary>
/// NF-01..NF-08. Cầu nối tới dịch vụ suy luận Python.
///
/// NGUYÊN TẮC (NT-3): dịch vụ này TRẢ VỀ DỰ ĐOÁN, không bao giờ ghi kết luận.
/// FinalGrade chỉ được ghi bởi thao tác duyệt/ghi đè của bác sĩ.
/// </summary>
public interface IAiInferenceClient
{
    Task<AiInferenceResponse> RunAsync(string imageRelativePath, string modelPath, CancellationToken ct = default);
}

public class AiInferenceResponse
{
    [JsonPropertyName("dr_grade")]        public byte DrGrade { get; set; }
    [JsonPropertyName("confidence")]      public decimal Confidence { get; set; }
    [JsonPropertyName("probabilities")]   public decimal[]? Probabilities { get; set; }
    [JsonPropertyName("lesion_grade")]    public byte? LesionGradeImplied { get; set; }
    [JsonPropertyName("lesion_mask_path")]public string? LesionMaskPath { get; set; }
    [JsonPropertyName("count_ma")]        public int? CountMA { get; set; }
    [JsonPropertyName("count_he")]        public int? CountHE { get; set; }
    [JsonPropertyName("count_ex")]        public int? CountEX { get; set; }
    [JsonPropertyName("count_se")]        public int? CountSE { get; set; }
    [JsonPropertyName("area_ma")]         public decimal? AreaMA { get; set; }
    [JsonPropertyName("area_he")]         public decimal? AreaHE { get; set; }
    [JsonPropertyName("area_ex")]         public decimal? AreaEX { get; set; }
    [JsonPropertyName("area_se")]         public decimal? AreaSE { get; set; }
    [JsonPropertyName("fractal_dimension")] public decimal? FractalDimension { get; set; }
    [JsonPropertyName("vessel_mask_path")]  public string? VesselMaskPath { get; set; }
    [JsonPropertyName("fractal_note")]      public string? FractalNote { get; set; }
    [JsonPropertyName("inference_ms")]      public int? InferenceMs { get; set; }
}

public class AiInferenceClient : IAiInferenceClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _cfg;
    private readonly ILogger<AiInferenceClient> _log;

    public AiInferenceClient(HttpClient http, IConfiguration cfg, ILogger<AiInferenceClient> log)
    { _http = http; _cfg = cfg; _log = log; }

    public async Task<AiInferenceResponse> RunAsync(string imageRelativePath, string modelPath, CancellationToken ct = default)
    {
        // Chế độ stub để chạy được toàn hệ thống khi chưa dựng dịch vụ Python.
        // Bật/tắt bằng AiService:UseStub trong appsettings.
        if (_cfg.GetValue<bool>("AiService:UseStub"))
            return Stub(imageRelativePath);

        try
        {
            var payload = new { image_path = imageRelativePath, model_path = modelPath };
            using var resp = await _http.PostAsJsonAsync("/infer", payload, ct);
            resp.EnsureSuccessStatusCode();

            return await resp.Content.ReadFromJsonAsync<AiInferenceResponse>(cancellationToken: ct)
                ?? throw AppException.BadRequest(Msg.AiUnavailable, "Dịch vụ suy luận trả về dữ liệu rỗng.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _log.LogError(ex, "Không gọi được dịch vụ suy luận AI cho ảnh {Path}", imageRelativePath);
            // E2 của UC-25: KHÔNG tạo bản ghi kết quả nào khi dịch vụ lỗi.
            throw AppException.BadRequest(Msg.AiUnavailable,
                "Không kết nối được dịch vụ suy luận AI. Vui lòng thử lại.");
        }
    }

    /// <summary>
    /// Sinh kết quả tất định theo đường dẫn ảnh, để demo và kiểm thử lặp lại được.
    /// Cố ý tạo đủ các tình huống: tin cậy thấp, bất đồng cao, và ca bình thường.
    /// </summary>
    private static AiInferenceResponse Stub(string path)
    {
        var seed = Math.Abs(path.GetHashCode());
        var grade = (byte)(seed % 5);
        var lesion = (byte)((grade + (seed % 3 == 0 ? 2 : 0)) % 5);

        return new AiInferenceResponse
        {
            DrGrade = grade,
            Confidence = Math.Round(0.58m + (seed % 40) / 100m, 4),
            Probabilities = new[] { 0.05m, 0.10m, 0.25m, 0.45m, 0.15m },
            LesionGradeImplied = lesion,
            LesionMaskPath = path.Replace(".jpg", "_lesion.png"),
            CountMA = seed % 40, CountHE = seed % 18, CountEX = seed % 12, CountSE = seed % 5,
            AreaMA = (seed % 40) * 0.000012m, AreaHE = (seed % 18) * 0.000085m,
            AreaEX = (seed % 12) * 0.000110m, AreaSE = (seed % 5) * 0.000140m,
            FractalDimension = Math.Round(1.42m + (seed % 25) / 100m, 4),
            VesselMaskPath = path.Replace(".jpg", "_vessel.png"),
            InferenceMs = 3200 + seed % 4000
        };
    }
}
