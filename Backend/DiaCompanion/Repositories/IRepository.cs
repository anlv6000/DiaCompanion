namespace DiaCompanion.Api.Repositories;

/// <summary>
/// Cổng duy nhất từ tầng Service sang persistence. Service không nhận DbContext,
/// DbSet, IQueryable, DatabaseFacade hay EntityEntry. Mọi LINQ/EF Core nằm trong
/// các file partial EfRepository.* thuộc tầng Repository.
/// </summary>
public partial interface IRepository : IUnitOfWork
{
    void Add<TEntity>(TEntity entity) where TEntity : class;
    void AddRange<TEntity>(IEnumerable<TEntity> entities) where TEntity : class;
    void Remove<TEntity>(TEntity entity) where TEntity : class;

    void ApplyOriginalRowVersion<TEntity>(TEntity entity, string rowVersion)
        where TEntity : class;

    Task<bool> CanConnectAsync(CancellationToken cancellationToken = default);

}
