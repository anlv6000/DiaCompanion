using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Repositories;
using DiaCompanion.Api.Entities;

namespace DiaCompanion.Api.Services;

/// <summary>
/// Đăng nhập bằng OTP cho bệnh nhân.
///
/// PHẠM VI v1.0: hệ thống SINH và XÁC MINH mã, nhưng KHÔNG gửi SMS —
/// tích hợp cổng SMS nằm ngoài phạm vi đồ án (LI-5). Trong demo, mã được
/// nhân viên quầy tiếp đón đọc cho bệnh nhân. Nếu sau này có cổng SMS thì
/// chỉ cần cắm thêm ISmsSender vào đây, không đổi phần còn lại.
/// </summary>
public interface IOtpService
{
    Task<string> IssueAsync(string phone, OtpPurpose purpose, int? issuedBy);
    Task<bool> VerifyAsync(string phone, string code, OtpPurpose purpose);
}

public class OtpService : IOtpService
{
    private readonly IRepository _repository;
    private readonly IPasswordHasher _hasher;
    private readonly IConfigService _cfg;

    public OtpService(IRepository repository, IPasswordHasher hasher, IConfigService cfg)
    { _repository = repository; _hasher = hasher; _cfg = cfg; }

    public async Task<string> IssueAsync(string phone, OtpPurpose purpose, int? issuedBy)
    {
        var ttl = await _cfg.GetIntAsync(ConfigKeys.OtpTtlSeconds, 300);

        // Vô hiệu các mã cũ chưa dùng — tránh nhiều mã cùng hiệu lực một lúc
        var old = await _repository.OtpCodes
            .Where(o => o.Phone == phone && o.Purpose == purpose && o.ConsumedAt == null)
            .ToListAsync();
        foreach (var o in old) o.ConsumedAt = DateTime.UtcNow;

        var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100_000, 999_999).ToString();

        _repository.OtpCodes.Add(new OtpCode
        {
            Phone = phone,
            CodeHash = _hasher.Hash(code),   // không lưu mã thô
            Purpose = purpose,
            ExpiresAt = DateTime.UtcNow.AddSeconds(ttl),
            IssuedBy = issuedBy
        });
        await _repository.SaveChangesAsync();
        return code;
    }

    public async Task<bool> VerifyAsync(string phone, string code, OtpPurpose purpose)
    {
        var maxAttempts = await _cfg.GetIntAsync(ConfigKeys.OtpMaxAttempts, 5);

        var otp = await _repository.OtpCodes
            .Where(o => o.Phone == phone && o.Purpose == purpose && o.ConsumedAt == null)
            .OrderByDescending(o => o.Id)
            .FirstOrDefaultAsync();

        if (otp is null || otp.ExpiresAt < DateTime.UtcNow) return false;

        // Chặn dò mã: 6 số chỉ có 900.000 khả năng, không giới hạn số lần thử
        // thì dò được trong thời gian ngắn.
        if (otp.AttemptCount >= maxAttempts)
        {
            otp.ConsumedAt = DateTime.UtcNow;
            await _repository.SaveChangesAsync();
            return false;
        }

        otp.AttemptCount++;
        var ok = _hasher.Verify(code, otp.CodeHash);
        if (ok) otp.ConsumedAt = DateTime.UtcNow;
        await _repository.SaveChangesAsync();
        return ok;
    }
}
