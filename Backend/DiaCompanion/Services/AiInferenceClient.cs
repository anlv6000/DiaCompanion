using System.Text.Json.Serialization;
using DiaCompanion.Api.Common;

namespace DiaCompanion.Api.Services;

/// <summary>
/// Cầu nối tới dịch vụ suy luận Python. Một lần chạy dùng ba model độc lập:
/// </summary>
public interface IAiInferenceClient
{
    Task<AiInferenceResponse> RunAsync(
        string imageRelativePath,
        string drModelPath,
        string lesionModelPath,
        string fractalModelPath,
        string? eye,
        CancellationToken ct = default);
}

public class AiInferenceResponse
{
    [JsonPropertyName("dr_grade")]          public byte DrGrade { get; set; }
    [JsonPropertyName("confidence")]        public decimal Confidence { get; set; }
    [JsonPropertyName("probabilities")]     public decimal[]? Probabilities { get; set; }
    [JsonPropertyName("lesion_grade")]      public byte? LesionGradeImplied { get; set; }
    [JsonPropertyName("lesion_mask_path")]  public string? LesionMaskPath { get; set; }
    [JsonPropertyName("count_ma")]          public int? CountMA { get; set; }
    [JsonPropertyName("count_he")]          public int? CountHE { get; set; }
    [JsonPropertyName("count_ex")]          public int? CountEX { get; set; }
    [JsonPropertyName("count_se")]          public int? CountSE { get; set; }
    [JsonPropertyName("area_ma")]           public decimal? AreaMA { get; set; }
    [JsonPropertyName("area_he")]           public decimal? AreaHE { get; set; }
    [JsonPropertyName("area_ex")]           public decimal? AreaEX { get; set; }
    [JsonPropertyName("area_se")]           public decimal? AreaSE { get; set; }
    [JsonPropertyName("fractal_dimension")] public decimal? FractalDimension { get; set; }
    [JsonPropertyName("fractal_st")] public decimal? FractalSt { get; set; }
    [JsonPropertyName("fractal_sn")] public decimal? FractalSn { get; set; }
    [JsonPropertyName("fractal_it")] public decimal? FractalIt { get; set; }
    [JsonPropertyName("fractal_in")] public decimal? FractalIn { get; set; }
    [JsonPropertyName("fractal_asymmetry")] public decimal? FractalAsymmetry { get; set; }
    [JsonPropertyName("fractal_tn")] public decimal? FractalTn { get; set; }
    [JsonPropertyName("lacunarity")] public decimal? Lacunarity { get; set; }
    [JsonPropertyName("vessel_mask_path")]  public string? VesselMaskPath { get; set; }
    [JsonPropertyName("fractal_note")]       public string? FractalNote { get; set; }
    [JsonPropertyName("inference_ms")]       public int? InferenceMs { get; set; }
}

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
    [JsonPropertyName("fractal_st")] public decimal? FractalSt { get; set; }
    [JsonPropertyName("fractal_sn")] public decimal? FractalSn { get; set; }
    [JsonPropertyName("fractal_it")] public decimal? FractalIt { get; set; }
    [JsonPropertyName("fractal_in")] public decimal? FractalIn { get; set; }
    [JsonPropertyName("fractal_asymmetry")] public decimal? FractalAsymmetry { get; set; }
    [JsonPropertyName("fractal_tn")] public decimal? FractalTn { get; set; }
    [JsonPropertyName("lacunarity")] public decimal? Lacunarity { get; set; }
    [JsonPropertyName("fractal_note")]      public string? FractalNote { get; set; }
    [JsonPropertyName("vessel_mask_path")]  public string? VesselMaskPath { get; set; }
    [JsonPropertyName("inference_ms")]      public int? InferenceMs { get; set; }
}

public class AiInferenceClient : IAiInferenceClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AiInferenceClient> _log;

    public AiInferenceClient(HttpClient http, ILogger<AiInferenceClient> log)
    {
        _http = http;
        _log = log;
    }

    /// <summary>
    /// Gọi dịch vụ AI để phân tích một ảnh đáy mắt bằng 3 mô hình:
    /// 1. DR model      -> phân loại mức độ bệnh võng mạc tiểu đường.
    /// 2. Lesion model  -> phát hiện/tính toán các tổn thương.
    /// 3. Fractal model -> phân tích đặc trưng hệ mạch võng mạc.
    ///
    /// Ba request được gửi song song để giảm thời gian chờ.
    /// Sau khi cả 3 hoàn thành, kết quả được gộp thành AiInferenceResponse.
    /// </summary>
    public async Task<AiInferenceResponse> RunAsync(
        string imageRelativePath,
        string drModelPath,
        string lesionModelPath,
        string fractalModelPath,
        string? eye,
        CancellationToken ct = default)
    {
        try
        {
            // ================================================================
            // 1. Gọi model DR
            // ================================================================
            // Gửi đường dẫn ảnh và model DR sang AI Server.
            //
            // Ví dụ request:
            // POST /infer/dr
            // {
            //     "image_path": "...",
            //     "model_path": "..."
            // }
            //
            // Không await ngay để request này có thể chạy song song
            // với Lesion và Fractal bên dưới.
            var drTask = PostAsync<DrResult>("/infer/dr", new
            {
                image_path = imageRelativePath,
                model_path = drModelPath
            }, ct);

            // ================================================================
            // 2. Gọi model Lesion
            // ================================================================
            // Model này phân tích các tổn thương trên võng mạc như:
            // MA - Microaneurysm
            // HE - Hemorrhage
            // EX - Exudate
            // SE - Soft Exudate / Cotton-wool spot (tùy định nghĩa model)
            var lesionTask = PostAsync<LesionResult>("/infer/lesion", new
            {
                image_path = imageRelativePath,
                model_path = lesionModelPath
            }, ct);

            // ================================================================
            // 3. Gọi model Fractal
            // ================================================================
            // Phân tích hệ mạch và các chỉ số fractal.
            //
            // eye được truyền thêm vì một số chỉ số/phân vùng có thể phụ thuộc
            // ảnh mắt phải (OD) hay mắt trái (OS).
            var fractalTask = PostAsync<FractalResult>("/infer/fractal", new
            {
                image_path = imageRelativePath,
                model_path = fractalModelPath,
                eye = eye
            }, ct);

            // ================================================================
            // 4. Chờ cả 3 model hoàn tất
            // ================================================================
            // DR, Lesion và Fractal đang chạy song song.
            //
            // Nếu một trong ba task lỗi thì WhenAll cũng sẽ lỗi và
            // không tiếp tục tạo AiInferenceResponse.
            await Task.WhenAll(
                drTask,
                lesionTask,
                fractalTask);

            // Lấy kết quả từng model sau khi chắc chắn cả 3 đã hoàn tất.
            var dr = await drTask;
            var lesion = await lesionTask;
            var fractal = await fractalTask;

            // Tổng thời gian inference mà từng AI service báo về.
            //
            // LƯU Ý:
            // Đây là tổng thời gian xử lý của 3 model,
            // KHÔNG phải thời gian thực tế người dùng phải chờ,
            // vì 3 model đang chạy song song.
            var totalMs =
                (dr.InferenceMs ?? 0)
                + (lesion.InferenceMs ?? 0)
                + (fractal.InferenceMs ?? 0);

            // ================================================================
            // 5. Gộp kết quả của 3 model về một object chung
            // ================================================================
            return new AiInferenceResponse
            {
                // ---------------- DR ----------------

                // Mức độ DR mà model dự đoán.
                DrGrade = dr.DrGrade,

                // Độ tin cậy của dự đoán DR.
                Confidence = dr.Confidence,

                // Xác suất của từng class DR.
                Probabilities = dr.Probabilities,


                // ---------------- Lesion ----------------

                // Grade được suy ra từ kết quả tổn thương.
                LesionGradeImplied = lesion.LesionGrade,

                // Đường dẫn mask tổn thương do AI tạo.
                LesionMaskPath = lesion.LesionMaskPath,

                // Số lượng từng loại tổn thương.
                CountMA = lesion.CountMA,
                CountHE = lesion.CountHE,
                CountEX = lesion.CountEX,
                CountSE = lesion.CountSE,

                // Diện tích từng loại tổn thương.
                AreaMA = lesion.AreaMA,
                AreaHE = lesion.AreaHE,
                AreaEX = lesion.AreaEX,
                AreaSE = lesion.AreaSE,


                // ---------------- Fractal ----------------

                FractalDimension = fractal.FractalDimension,
                FractalSt = fractal.FractalSt,
                FractalSn = fractal.FractalSn,
                FractalIt = fractal.FractalIt,
                FractalIn = fractal.FractalIn,
                FractalAsymmetry = fractal.FractalAsymmetry,
                FractalTn = fractal.FractalTn,
                Lacunarity = fractal.Lacunarity,

                // Mask hệ mạch do model Fractal tạo ra.
                VesselMaskPath = fractal.VesselMaskPath,

                // Ghi chú bổ sung từ model Fractal.
                FractalNote = fractal.FractalNote,

                // Nếu AI Server không trả thời gian thì lưu null.
                InferenceMs = totalMs > 0
                    ? totalMs
                    : null
            };
        }
        catch (Exception ex)
            when (ex is HttpRequestException or TaskCanceledException)
        {
            // HttpRequestException:
            // - AI server không chạy
            // - sai địa chỉ/port
            // - mất kết nối
            // - connection refused...
            //
            // TaskCanceledException:
            // - request bị timeout
            // - request bị cancellation

            _log.LogError(
                ex,
                "Không gọi được dịch vụ suy luận AI cho ảnh {Path}",
                imageRelativePath);

            // Không đưa lỗi kỹ thuật của AI Server trực tiếp ra frontend.
            // Chuyển thành lỗi nghiệp vụ dễ hiểu hơn.
            throw AppException.BadRequest(
                Msg.AiUnavailable,
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
