@echo off
chcp 65001 >nul
title Admin Residencial - Detener Servicios

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         ADMIN RESIDENCIAL - DETENER SERVICIOS                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo Deteniendo servicios...
docker-compose -f docker-compose-local.yml down

if %errorlevel% equ 0 (
    echo.
    echo ✅ Servicios detenidos correctamente.
    echo.
) else (
    echo.
    echo ⚠️ Hubo un problema al detener los servicios.
    echo.
)

pause
