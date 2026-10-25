# ==============================================================================
# StreamFlow — Script de Gestión y Despliegue para PowerShell (Windows)
# ==============================================================================
param (
    [Parameter(Position = 0)]
    [string]$Command = "up",

    [Parameter(Position = 1)]
    [string]$Service = "",

    [switch]$Prod,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Generate-Secret([int]$Length = 32) {
    $bytes = New-Object byte[] ($Length)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $result = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
    return $result
}

function Init-Env {
    $envPath = Join-Path $ScriptDir ".env"
    $examplePath = Join-Path $ScriptDir ".env.example"

    if (Test-Path $envPath) {
        Write-Host "ℹ️  El archivo .env ya existe. No se sobreescribirá." -ForegroundColor Yellow
        return
    }

    Write-Host "==> Generando configuración inicial con secretos criptográficos..." -ForegroundColor Cyan

    if (-not (Test-Path $examplePath)) {
        Write-Error "No se encontró .env.example para copiar."
        return
    }

    $pgPass = Generate-Secret 32
    $jwtSec = Generate-Secret 64
    $s3Sec  = Generate-Secret 32

    $content = Get-Content $examplePath -Raw
    $content = $content.Replace("POSTGRES_PASSWORD=streamflow", "POSTGRES_PASSWORD=$pgPass")
    $content = $content.Replace(":streamflow@postgres:5432", ":$pgPass@postgres:5432")
    $content = $content.Replace("JWT_SECRET=change-this-in-production", "JWT_SECRET=$jwtSec")
    $content = $content.Replace("S3_SECRET_KEY=minioadmin", "S3_SECRET_KEY=$s3Sec")

    Set-Content -Path $envPath -Value $content -Encoding UTF8

    $s3JsonPath = Join-Path $ScriptDir "docker\seaweedfs-s3.json"
    if (Test-Path $s3JsonPath) {
        $s3Config = @"
{
  "identities": [
    {
      "name": "streamflow",
      "credentials": [
        {
          "accessKey": "minioadmin",
          "secretKey": "$s3Sec"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
"@
        Set-Content -Path $s3JsonPath -Value $s3Config -Encoding UTF8
    }

    Write-Host "✅ Archivo .env generado exitosamente con secretos seguros." -ForegroundColor Green
    Write-Host "✅ docker/seaweedfs-s3.json sincronizado con credenciales S3." -ForegroundColor Green
}

function Check-Docker {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-Error "Docker no está instalado o no se encuentra en el PATH."
        exit 1
    }
}

switch ($Command.ToLower()) {
    "init" {
        Init-Env
    }
    { $_ -in "up", "start" } {
        Check-Docker
        Init-Env
        $profileArgs = @()
        if ($Prod) {
            $profileArgs += "--profile", "production"
        }
        Write-Host "==> Construyendo y levantando servicios de StreamFlow..." -ForegroundColor Cyan
        & docker compose @profileArgs up -d --build

        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "🚀 StreamFlow está levantado y en ejecución." -ForegroundColor Green
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "  🌐 Frontend:  http://localhost:3000" -ForegroundColor Cyan
        Write-Host "  🔌 API:       http://localhost:3001" -ForegroundColor Cyan
        Write-Host "  📦 SeaweedFS: http://localhost:8888 (Filer UI)" -ForegroundColor Cyan
        if ($Prod) {
            Write-Host "  🛡️  Nginx:     http://localhost (o tu dominio)" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "Para ver logs en vivo: .\streamflow.ps1 logs"
    }
    { $_ -in "down", "stop" } {
        Check-Docker
        Write-Host "==> Deteniendo servicios..." -ForegroundColor Yellow
        & docker compose --profile production down
        Write-Host "✅ Servicios detenidos." -ForegroundColor Green
    }
    "logs" {
        Check-Docker
        if ($Service) {
            & docker compose logs -f $Service
        } else {
            & docker compose logs -f
        }
    }
    { $_ -in "ps", "status" } {
        Check-Docker
        & docker compose ps
    }
    "migrate" {
        Check-Docker
        Write-Host "==> Ejecutando migraciones de base de datos..." -ForegroundColor Cyan
        & docker compose exec api node apps/api/dist/db/migrate.js
        Write-Host "✅ Migraciones completadas." -ForegroundColor Green
    }
    "reset" {
        Check-Docker
        if (-not $Force) {
            $confirm = Read-Host "⚠️  ATENCIÓN: Esto eliminará todos los volúmenes (base de datos y videos en S3). ¿Continuar? [s/N]"
            if ($confirm -notmatch '^[sSyY]$') {
                Write-Host "Operación cancelada."
                exit 0
            }
        }
        Write-Host "==> Eliminando contenedores y volúmenes persistentes..." -ForegroundColor Yellow
        & docker compose --profile production down -v
        Write-Host "✅ Entorno reiniciado desde cero." -ForegroundColor Green
    }
    default {
        Write-Host "Uso: .\streamflow.ps1 [COMANDO] [-Prod] [-Force] [-Service <nombre>]"
        Write-Host ""
        Write-Host "Comandos disponibles:"
        Write-Host "  up [-Prod]      Inicializa .env si falta, compila y levanta los contenedores"
        Write-Host "  down            Detiene todos los contenedores"
        Write-Host "  logs [servicio] Muestra los logs en tiempo real"
        Write-Host "  ps              Muestra el estado de los servicios"
        Write-Host "  migrate         Ejecuta manualmente las migraciones Drizzle"
        Write-Host "  reset [-Force]  Detiene y borra volúmenes persistentes (DB y S3)"
        Write-Host "  init            Genera el archivo .env inicial con secretos seguros"
    }
}
