using System.Text.Json;
using System.Text.Json.Serialization;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Services;

/// <summary>
/// NF-01..NF-08. Cầu nối tới dịch vụ suy luận Python (FastAPI).
///
/// NGUYÊN TẮC (NT-3): dịch vụ này TRẢ VỀ DỰ ĐOÁN, không bao giờ ghi kết luận.
/// FinalGrade chỉ được ghi bởi thao tác duyệt/ghi đè của bác sĩ.
///
/// Kiến trúc: dịch vụ Python phơi 3 endpoint riêng. Client gọi lần lượt rồi GỘP
/// thành một AiInferenceResponse cho phần còn lại của backend dùng như cũ:
///   POST /infer/dr       -> dr_grade, confidence, probabilities
///   POST /infer/lesion   -> lesion_grade, count_*, area_*, lesion_mask_path
///   POST /infer/fractal  -> fractal_dimension, fractal_note, vessel_mask_path
/// </summary>
public interface IAiInferenceClient
{
    Task<AiInferenceResponse> RunAsync(string imageRelativePath, string modelPath, CancellationToken ct = default);
}

/// <summary>Kết quả AI đã GỘP từ 3 model — giữ nguyên shape mà DiagnosesService dùng.</summary>
public class AiInferenceResponse
{
    [JsonPropertyName("dr_grade")]         public byte DrGrade { get; set; }
    [JsonPropertyName("confidence")]       public decimal Confidence { get; set; }
    [JsonPropertyName("probabilities")]    public decimal[]? Probabilities { get; set; }
    [JsonPropertyName("lesion_grade")]     public byte? LesionGradeImplied { get; set; }
    [JsonPropertyName("lesion_mask_path")] public string? LesionMaskPath { get; set; }
    [JsonPropertyName("count_ma")]         public int? CountMA { get; set; }
    [JsonPropertyName("count_he")]         public int? CountHE { get; set; }
    [JsonPropertyName("count_ex")]         public int? CountEX { get; set; }
    [JsonPropertyName("count_se")]         public int? CountSE { get; set; }
    [JsonPropertyName("area_ma")]          public decimal? AreaMA { get; set; }
    [JsonPropertyName("area_he")]          public decimal? AreaHE { get; set; }
    [JsonPropertyName("area_ex")]          public decimal? AreaEX { get; set; }
    [JsonPropertyName("area_se")]          public decimal? AreaSE { get; set; }
    [JsonPropertyName("fractal_dimension")] public decimal? FractalDimension { get; set; }
    [JsonPropertyName("vessel_mask_path")]  public string? VesselMaskPath { get; set; }
    [JsonPropertyName("fractal_note")]      public string? FractalNote { get; set; }
    [JsonPropertyName("inference_ms")]      public int? InferenceMs { get; set; }
}

// --- Các DTO khớp response TỪNG endpoint Python (snake_case) -----------------

file class DrResult
{
    [JsonPropertyName("dr_grade")]      public byte DrGrade { get; set; }
    [JsonPropertyName("confidence")]    public decimal Confidence { get; set; }
    [JsonPropertyName("probabilities")] public decimal[]? Probabilities { get; set; }
    [JsonPropertyName("inference_ms")]  public int? InferenceMs { get; set; }
}

file class LesionResult
{
    [JsonPropertyName("lesion_grade")]     public byte? LesionGrade { get; set; }
    [JsonPropertyName("count_ma")]         public int? CountMA { get; set; }
    [JsonPropertyName("count_he")]         public int? CountHE { get; set; }
    [JsonPropertyName("count_ex")]         public int? CountEX { get; set; }
    [JsonPropertyName("count_se")]         public int? CountSE { get; set; }
    [JsonPropertyName("area_ma")]          public decimal? AreaMA { get; set; }
    [JsonPropertyName("area_he")]          public decimal? AreaHE { get; set; }
    [JsonPropertyName("area_ex")]          public decimal? AreaEX { get; set; }
    [JsonPropertyName("area_se")]          public decimal? AreaSE { get; set; }
    [JsonPropertyName("lesion_mask_path")] public string? LesionMaskPath { get; set; }
    [JsonPropertyName("inference_ms")]     public int? InferenceMs { get; set; }
}

file class FractalResult
{
    [JsonPropertyName("fractal_dimension")] public decimal? FractalDimension { get; set; }
    [JsonPropertyName("fractal_note")]      public string? FractalNote { get; set; }
    [JsonPropertyName("vessel_mask_path")]  public string? VesselMaskPath { get; set; }
    [JsonPropertyName("inference_ms")]      public int? InferenceMs { get; set; }
}

public class AiInferenceClient : IAiInferenceClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AiInferenceClient> _log;

    public AiInferenceClient(HttpClient http, ILogger<AiInferenceClient> log)
    { _http = http; _log = log; }

    public async Task<AiInferenceResponse> RunAsync(
        string imageRelativePath, string modelPath, CancellationToken ct = default)
    {
        var payload = new { image_path = imageRelativePath, model_path = modelPath };

        try
        {
            // Gọi 3 endpoint. Có thể chạy song song vì độc lập nhau.
            var drTask      = PostAsync<DrResult>("/infer/dr", payload, ct);
            var lesionTask  = PostAsync<LesionResult>("/infer/lesion", payload, ct);
            var fractalTask = PostAsync<FractalResult>("/infer/fractal", payload, ct);

            await Task.WhenAll(drTask, lesionTask, fractalTask);

            var dr = drTask.Result;
            var lesion = lesionTask.Result;
            var fractal = fractalTask.Result;

            // Tổng thời gian suy luận = cộng dồn 3 model (nếu có).
            var totalMs = (dr.InferenceMs ?? 0) + (lesion.InferenceMs ?? 0) + (fractal.InferenceMs ?? 0);

            return new AiInferenceResponse
            {
                // Model 1 — DR
                DrGrade = dr.DrGrade,
                Confidence = dr.Confidence,
                Probabilities = dr.Probabilities,
                // Model 2 — Lesion
                LesionGradeImplied = lesion.LesionGrade,
                LesionMaskPath = lesion.LesionMaskPath,
                CountMA = lesion.CountMA, CountHE = lesion.CountHE,
                CountEX = lesion.CountEX, CountSE = lesion.CountSE,
                AreaMA = lesion.AreaMA, AreaHE = lesion.AreaHE,
                AreaEX = lesion.AreaEX, AreaSE = lesion.AreaSE,
                // Model 3 — Fractal
                FractalDimension = fractal.FractalDimension,
                VesselMaskPath = fractal.VesselMaskPath,
                FractalNote = fractal.FractalNote,
                // Tổng hợp
                InferenceMs = totalMs > 0 ? totalMs : null
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _log.LogError(ex, "Không gọi được dịch vụ suy luận AI cho ảnh {Path}", imageRelativePath);
            // E2 của UC-25: KHÔNG tạo bản ghi kết quả nào khi dịch vụ lỗi.
            throw AppException.BadRequest(Msg.AiUnavailable,
                "Không kết nối được dịch vụ suy luận AI. Vui lòng thử lại.");
        }
    }

    private async Task<T> PostAsync<T>(string route, object payload, CancellationToken ct)
    {
        using var resp = await _http.PostAsJsonAsync(route, payload, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<T>(cancellationToken: ct)
            ?? throw AppException.BadRequest(Msg.AiUnavailable,
                $"Dịch vụ suy luận trả về dữ liệu rỗng ở {route}.");
    }
}
