using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;

namespace DiaCompanion.Api.Services;

public interface IUsersService
{
    Task<ActionResult<PagedResult<StaffUserDto>>> List(
        [FromQuery] string? q, [FromQuery] string? role, [FromQuery] bool? isActive,
        [FromQuery] PageQuery page);
    Task<ActionResult<StaffUserDto>> Get(int id);
    Task<ActionResult<TempCredentialResponse>> Create(CreateStaffRequest req);
    Task<IActionResult> Update(int id, UpdateStaffRequest req);
    Task<IActionResult> SetActive(int id, bool value, ConcurrencyRequest req);
    Task<ActionResult<TempCredentialResponse>> ResetPassword(int id, ConcurrencyRequest req);
    Task<IActionResult> Doctors();
}
