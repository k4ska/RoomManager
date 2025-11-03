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
        // ensure JSON uses camelCase to match the frontend expectations
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services
    .AddDbContext<DataContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("Default")))
    .AddScoped<FurnitureRepo>()
    .AddScoped<UsersRepo>()
    .AddScoped<RoomsRepo>()
    .AddScoped<ItemsRepo>();

// auth & crypto services
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();


var app = builder.Build();

using (var scope = ((IApplicationBuilder)app).ApplicationServices.GetRequiredService<IServiceScopeFactory>().CreateScope())
using (var context = scope.ServiceProvider.GetService<DataContext>())
{
    context?.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.MapControllers();
app.Run();