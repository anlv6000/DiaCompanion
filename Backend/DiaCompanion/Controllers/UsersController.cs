using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DiaCompanion.Api.Common;
using DiaCompanion.Api.Dtos;
using DiaCompanion.Api.Services;

namespace DiaCompanion.Api.Controllers;

/// <summary>UC-06..11 — quản lý tài khoản nhân viên (Admin).</summary>
public class UsersController : BaseApiController
{
    private readonly IUsersService _service;

    public UsersController(IUsersService service) => _service = service;


    /// <summary>UC-06 — danh sách tài khoản nhân viên.</summary>
    [HttpGet]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<PagedResult<StaffUserDto>>> List(
    [FromQuery] string? q, [FromQuery] string? role, [FromQuery] bool? isActive,
    [FromQuery] PageQuery page)
    {
        return await _service.List(q, role, isActive, page);
    }


    /// <summary>UC-07 — chi tiết tài khoản.</summary>
    [HttpGet("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<StaffUserDto>> Get(int id)
    {
        return await _service.Get(id);
    }


    /// <summary>UC-08 — tạo tài khoản Admin, Bác sĩ hoặc Lễ tân.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<TempCredentialResponse>> Create(CreateStaffRequest req)
    {
        return await _service.Create(req);
    }


    /// <summary>UC-09 — cập nhật tài khoản.</summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Update(int id, UpdateStaffRequest req)
    {
        return await _service.Update(id, req);
    }


    /// <summary>
    /// UC-10 — khoá / mở tài khoản.
    /// BR-11: tài khoản KHÔNG bị xoá, chỉ khoá — để giữ vết các thao tác đã thực hiện.
    /// </summary>
    [HttpPut("{id:int}/active")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> SetActive(
        int id,
        ConcurrencyRequest req,
        [FromQuery] bool value)
    {
        return await _service.SetActive(id, value, req);
    }


    /// <summary>UC-11 — đặt lại mật khẩu cho nhân viên.</summary>
    [HttpPost("{id:int}/reset-password")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<TempCredentialResponse>> ResetPassword(
        int id,
        ConcurrencyRequest req)
    {
        return await _service.ResetPassword(id, req);
    }


    /// <summary>Danh sách bác sĩ để đổ vào dropdown (dùng ở nhiều màn).</summary>
    [HttpGet("doctors")]
    [Authorize(Roles = Roles.FrontDesk)]
    public async Task<IActionResult> Doctors()
    {
        return await _service.Doctors();
    }
}
