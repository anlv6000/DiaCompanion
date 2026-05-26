
using DiaCompanion.Models;
using DiaCompanion.Services;

namespace DiaCompanion
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.Configure<MongoDbSettings>(
            builder.Configuration.GetSection("MongoDbSettings"));
            builder.Services.Configure<JwtSettings>(
            builder.Configuration.GetSection("JwtSettings"));
            builder.Services.AddSingleton<MongoDbService>();
            builder.Services.AddScoped<PatientService>();
            builder.Services.AddScoped<AuthService>();
            builder.Services.AddCors(options =>
                {
                    options.AddPolicy("AllowFrontend",
                        policy =>
                        {
                            policy.WithOrigins("http://localhost:3000", "http://localhost:5173") // địa chỉ frontend
                                .AllowAnyHeader()
                                .AllowAnyMethod();
                        });
                });

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            app.UseAuthentication();

            app.UseAuthorization();

            app.UseCors("AllowFrontend");

            app.MapControllers();

            app.Run();
        }
    }
}
