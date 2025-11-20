ARG REGISTRY=""
ARG DOTNET_SDK_IMAGE=mcr.microsoft.com/dotnet/sdk:9.0-alpine3.22
ARG DOTNET_RUNTIME_IMAGE=mcr.microsoft.com/dotnet/aspnet:9.0-alpine3.22

# Use `${REGISTRY}${DOTNET_*_IMAGE}` so an empty `REGISTRY` doesn't produce
# an invalid image reference like `/dotnet/aspnet:...` (happens when REGISTRY="").
# If you set `REGISTRY`, include a trailing slash (e.g. `myreg.example.com/`).
FROM ${DOTNET_SDK_IMAGE} AS builder

# Copy project files
WORKDIR /source
COPY ./*.csproj .

# Restore
RUN dotnet restore

# Copy all source code
COPY . .

# Publish
WORKDIR /source
RUN dotnet publish "backend.csproj" -c Release -o /publish

# Runtime
FROM ${DOTNET_RUNTIME_IMAGE}
WORKDIR /app
COPY --from=builder /publish .

EXPOSE 4000

RUN addgroup -S runner && adduser -S runner -G runner
USER runner
ENTRYPOINT ["dotnet", "backend.dll"]

