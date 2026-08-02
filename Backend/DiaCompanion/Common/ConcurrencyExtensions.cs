using DiaCompanion.Api.Entities;
using DiaCompanion.Api.Repositories;
using Microsoft.EntityFrameworkCore;

namespace DiaCompanion.Api.Common;

public static class ConcurrencyExtensions
{
    public static void ApplyOriginalRowVersion<TEntity>(
        this IRepository repository,
        TEntity entity,
        string? encodedRowVersion)
        where TEntity : class, IHasRowVersion
    {
        repository.Entry(entity)
            .Property(x => x.RowVer)
            .OriginalValue = Decode(encodedRowVersion);
    }

    public static void ApplyOriginalRowVersion<TEntity>(
        this DbContext db,
        TEntity entity,
        string? encodedRowVersion)
        where TEntity : class, IHasRowVersion
    {
        db.Entry(entity)
            .Property(x => x.RowVer)
            .OriginalValue = Decode(encodedRowVersion);
    }

    public static string ToRowVersion(this IHasRowVersion entity) =>
        Convert.ToBase64String(entity.RowVer);

    private static byte[] Decode(string? encodedRowVersion)
    {
        if (string.IsNullOrWhiteSpace(encodedRowVersion))
        {
            throw AppException.BadRequest(
                Msg.RequiredFields,
                "Thiếu RowVersion. Vui lòng tải lại dữ liệu trước khi lưu.");
        }

        byte[] original;
        try
        {
            original = Convert.FromBase64String(encodedRowVersion);
        }
        catch (FormatException)
        {
            throw AppException.BadRequest(
                Msg.InvalidData,
                "RowVersion không hợp lệ. Vui lòng tải lại dữ liệu.");
        }

        if (original.Length != 8)
        {
            throw AppException.BadRequest(
                Msg.InvalidData,
                "RowVersion không hợp lệ. Vui lòng tải lại dữ liệu.");
        }

        return original;
    }
}
