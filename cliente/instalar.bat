@echo off
chcp 65001 >nul
title Admin Residencial - Instalador

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     ADMIN RESIDENCIAL - INSTALADOR                           ║
echo ║     Sistema de Administración para Conjuntos Residenciales    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar Docker
echo [1/4] Verificando Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker Desktop no está instalado.
    echo    Descargue desde: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
echo ✅ Docker Desktop encontrado.

:: Verificar que Docker esté corriendo
echo.
echo [2/4] Verificando que Docker esté ejecutándose...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Desktop no está corriendo. Ábralo y espere que inicie.
    pause
    exit /b 1
)
echo ✅ Docker está ejecutándose.

:: Verificar configuración
echo.
echo [3/4] Verificando configuración...
if not exist ".env.local" (
    if exist ".env.local.example" (
        copy ".env.local.example" ".env.local" >nul
        echo ⚠️  Archivo .env.local creado. Edítelo con sus credenciales.
        notepad .env.local
        pause
    ) else (
        echo ❌ ERROR: No se encontró archivo de configuración.
        pause
        exit /b 1
    )
) else (
    echo ✅ Configuración encontrada.
)

:: Descargar imágenes e iniciar
echo.
echo [4/4] Descargando e instalando (puede tardar varios minutos)...
docker-compose pull
docker-compose up -d

if %errorlevel% equ 0 (
    echo.
    echo ╔══════════════════════════════════════════════════════════════╗
    echo ║  ✅ INSTALACIÓN COMPLETADA                                  ║
    echo ║                                                              ║
    echo ║  Acceda al sistema: http://localhost:5000                   ║
    echo ╚══════════════════════════════════════════════════════════════╝
    timeout /t 5 /nobreak >nul
    start http://localhost:5000
) else (
    echo ❌ Error en la instalación.
)

pause
