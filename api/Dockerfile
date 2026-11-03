# API de la tienda (.NET 10) — Render la construye con este archivo
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY TiendaApi/TiendaApi.csproj TiendaApi/
RUN dotnet restore TiendaApi/TiendaApi.csproj
COPY TiendaApi/ TiendaApi/
RUN dotnet publish TiendaApi/TiendaApi.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production DOTNET_CLI_TELEMETRY_OPTOUT=1
EXPOSE 8080
ENTRYPOINT ["dotnet", "TiendaApi.dll"]
