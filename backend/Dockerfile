ARG REGISTRY=""
ARG DOTNET_SDK_IMAGE=dotnet/sdk:9.0-alpine3.22
ARG DOTNET_RUNTIME_IMAGE=dotnet/aspnet:9.0-alpine3.22

# Define base image
FROM ${REGISTRY}${DOTNET_SDK_IMAGE} AS builder

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
FROM ${REGISTRY}${DOTNET_RUNTIME_IMAGE}
WORKDIR /app
COPY --from=builder /publish .

EXPOSE 4000

RUN addgroup -S runner && adduser -S runner -G runner
USER runner
ENTRYPOINT ["dotnet", "backend.dll"]

