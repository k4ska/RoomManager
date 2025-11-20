ARG REGISTRY=""

# Define base image
FROM ${REGISTRY}/dotnet/sdk:9.0-alpine3.22 AS builder

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
FROM ${REGISTRY}/dotnet/aspnet:9.0-alpine3.22
WORKDIR /app
COPY --from=builder /publish .

EXPOSE 4000

RUN addgroup -S runner && adduser -S runner -G runner
USER runner
ENTRYPOINT ["dotnet", "backend.dll"]

