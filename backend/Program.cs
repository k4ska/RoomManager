using System.Reflection;
using backend.Data;
using backend.Data.Repos;
using backend.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSwaggerGen(o =>
{
    var xml = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    o.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xml), true);
});
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        // Kasuta JSON-is camelCase kuju, et vastaks frontendi ootustele
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Ühenda andmebaasiga: eelisjärjekorras ConnectionStrings:Default, muidu DATABASE_URL (toetab postgres://)
static string BuildConnectionString(IConfiguration cfg)
{
    // Konteineris eelistame keskkonnamuutujat DATABASE_URL; varuvariandina ConnectionStrings:Default
    var conn = Environment.GetEnvironmentVariable("DATABASE_URL") ?? cfg.GetConnectionString("Default") ?? string.Empty;
    if (string.IsNullOrWhiteSpace(conn))
        return "Host=localhost;Port=5432;Database=room_manager;Username=postgres;Password=postgres";
    if (conn.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) || conn.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(conn);
            var userInfo = uri.UserInfo.Split(':', 2);
            var username = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(0) ?? "");
            var password = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "");
            var db = uri.AbsolutePath.TrimStart('/');
            var port = uri.Port > 0 ? uri.Port : 5432;
            return $"Host={uri.Host};Port={port};Database={db};Username={username};Password={password}";
        }
        catch { }
    }
    return conn;
}

var dbConn = BuildConnectionString(builder.Configuration);

builder.Services
    .AddDbContext<DataContext>(options => options.UseNpgsql(dbConn))
    .AddScoped<FurnitureRepo>()
    .AddScoped<UsersRepo>()
    .AddScoped<RoomsRepo>()
    .AddScoped<ItemsRepo>();

// Autentimise ja krüpto teenused
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();

// CORS: luba seadistatud frontendi päritolud (komadega eraldatud)
var corsOriginsRaw = Environment.GetEnvironmentVariable("CORS_ORIGIN") ?? "http://localhost:3000";
var corsOrigins = corsOriginsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));


var app = builder.Build();

// Tagab minimaalse skeemi (loo vajalikud tabelid, kui puuduvad)
using (var scope = ((IApplicationBuilder)app).ApplicationServices.GetRequiredService<IServiceScopeFactory>().CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DataContext>();
    var conn = context.Database.GetDbConnection();
    await conn.OpenAsync();
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
      CREATE TABLE IF NOT EXISTS ""Users"" (
        ""Id"" SERIAL PRIMARY KEY,
        ""Email"" TEXT NOT NULL UNIQUE,
        ""PasswordHash"" TEXT NOT NULL,
        ""Name"" TEXT NULL,
        ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ""UpdatedAt"" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ""Rooms"" (
        ""Id"" SERIAL PRIMARY KEY,
        ""UserId"" INT NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE,
        ""Name"" TEXT NOT NULL,
        ""Shape"" TEXT NOT NULL DEFAULT '[]',
        ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ""UpdatedAt"" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ""Furniture"" (
        ""Id"" SERIAL PRIMARY KEY,
        ""RoomId"" INT NOT NULL REFERENCES ""Rooms""(""Id"") ON DELETE CASCADE,
        ""Type"" INT NOT NULL,
        ""X"" INT NOT NULL,
        ""Y"" INT NOT NULL,
        ""W"" INT NOT NULL,
        ""H"" INT NOT NULL,
        ""Rotation"" INT NOT NULL,
        ""Emoji"" TEXT NOT NULL,
        ""Name"" TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS ""Items"" (
        ""Id"" SERIAL PRIMARY KEY,
        ""FurnitureId"" INT NOT NULL REFERENCES ""Furniture""(""Id"") ON DELETE CASCADE,
        ""Name"" TEXT NOT NULL,
        ""Quantity"" INT NOT NULL
      );";
    await cmd.ExecuteNonQueryAsync();
}

// Seadista HTTP päringute toru
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Luba CORS (arendus/Docker keskkond)
app.UseCors("frontend");

// Tervisekontrolli endpoint kiireks kontrolliks
app.MapGet("/api/health", (IHostEnvironment env) => Results.Json(new { ok = true, service = "backend", env = env.EnvironmentName }));
app.MapControllers();
app.Run();
