@echo off
chcp 65001 >nul
title Admin Residencial - Iniciar Servicios

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         ADMIN RESIDENCIAL - INICIAR SERVICIOS                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar si Docker está corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Desktop no está corriendo.
    echo    Por favor abra Docker Desktop y espere a que el icono esté verde.
    pause
    exit /b 1
)

echo Iniciando servicios...
docker-compose -f docker-compose-local.yml up -d

if %errorlevel% equ 0 (
    echo.
    echo ✅ Servicios iniciados correctamente.
    echo.
    echo    Acceda al sistema: http://localhost:5000
    echo.
) else (
    echo.
    echo ❌ Error al iniciar servicios.
    echo    Ejecute: docker-compose -f docker-compose-local.yml logs
    echo.
)

pause
