using System.Data;
using Microsoft.EntityFrameworkCore;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Data;

namespace DiaCompanion.Api.Repositories;

/// <summary>
/// EF Core implementation. Đây là lớp duy nhất (cùng các partial của nó)
/// được phép làm việc trực tiếp với AppDbContext trong application layer.
/// </summary>
public sealed partial class EfRepository : IRepository
{
    private readonly AppDbContext _db;

    public EfRepository(AppDbContext db) => _db = db;

    public void Add<TEntity>(TEntity entity) where TEntity : class => _db.Set<TEntity>().Add(entity);

    public void AddRange<TEntity>(IEnumerable<TEntity> entities) where TEntity : class =>
        _db.Set<TEntity>().AddRange(entities);

    public void Remove<TEntity>(TEntity entity) where TEntity : class => _db.Set<TEntity>().Remove(entity);

    public void ApplyOriginalRowVersion<TEntity>(TEntity entity, string rowVersion)
        where TEntity : class
    {
        _db.Entry(entity).Property("RowVer").OriginalValue = RowVersionCodec.Decode(rowVersion);
    }

    public Task<int> CommitAsync(CancellationToken cancellationToken = default) =>
        _db.SaveChangesAsync(cancellationToken);

    public async Task<bool> TryCommitAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    public Task<bool> CanConnectAsync(CancellationToken cancellationToken = default) =>
        _db.Database.CanConnectAsync(cancellationToken);

    public async Task ExecuteInTransactionAsync(
        Func<Task> action,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(isolationLevel, cancellationToken);
            try
            {
                await action();
                await tx.CommitAsync(cancellationToken);
            }
            catch
            {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<TResult> ExecuteInTransactionAsync<TResult>(
        Func<Task<TResult>> action,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        TResult? result = default;
        await ExecuteInTransactionAsync(async () =>
        {
            result = await action();
        }, isolationLevel, cancellationToken);
        return result!;
    }
}
