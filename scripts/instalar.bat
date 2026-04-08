@echo off
chcp 65001 >nul
title Admin Residencial - Instalador Local

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     ADMIN RESIDENCIAL - INSTALADOR ON-PREMISE                ║
echo ║     Sistema de Administración para Conjuntos Residenciales    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Verificar si Docker está instalado
echo [1/5] Verificando Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Docker Desktop no está instalado.
    echo.
    echo Por favor instale Docker Desktop desde:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo Después de instalar, reinicie el equipo y ejecute este script nuevamente.
    echo.
    pause
    exit /b 1
)
echo ✅ Docker Desktop encontrado.

:: Verificar si Docker está corriendo
echo.
echo [2/5] Verificando que Docker esté ejecutándose...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Docker Desktop no está corriendo.
    echo.
    echo Por favor abra Docker Desktop y espere a que el icono esté verde.
    echo Luego ejecute este script nuevamente.
    echo.
    pause
    exit /b 1
)
echo ✅ Docker está ejecutándose.

:: Verificar archivo de configuración
echo.
echo [3/5] Verificando configuración...
if not exist ".env.local" (
    echo.
    echo ⚠️ Archivo .env.local no encontrado. Creando desde ejemplo...
    if exist ".env.local.example" (
        copy ".env.local.example" ".env.local" >nul
        echo ✅ Archivo .env.local creado.
        echo.
        echo ⚠️ IMPORTANTE: Edite el archivo .env.local con sus credenciales
        echo    antes de continuar.
        echo.
        notepad .env.local
        pause
    ) else (
        echo ❌ ERROR: No se encontró .env.local.example
        pause
        exit /b 1
    )
) else (
    echo ✅ Configuración encontrada.
)

:: Descargar imágenes y construir
echo.
echo [4/5] Descargando e instalando componentes...
echo     (Esto puede tardar varios minutos la primera vez)
echo.

docker-compose -f docker-compose-local.yml pull
if %errorlevel% neq 0 (
    echo ⚠️ Algunas imágenes no se pudieron descargar, intentando construir...
)

docker-compose -f docker-compose-local.yml build
if %errorlevel% neq 0 (
    echo ❌ ERROR: Falló la construcción de imágenes.
    pause
    exit /b 1
)

:: Iniciar servicios
echo.
echo [5/5] Iniciando servicios...
docker-compose -f docker-compose-local.yml up -d
if %errorlevel% neq 0 (
    echo ❌ ERROR: No se pudieron iniciar los servicios.
    echo Ejecute: docker-compose -f docker-compose-local.yml logs
    pause
    exit /b 1
)

:: Esperar a que los servicios estén listos
echo.
echo Esperando a que los servicios estén listos...
timeout /t 10 /nobreak >nul

:: Verificar que los servicios estén corriendo
docker ps | findstr "admin-residencial" >nul
if %errorlevel% neq 0 (
    echo ⚠️ Los servicios están iniciando, espere unos segundos más...
    timeout /t 10 /nobreak >nul
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║  ✅ INSTALACIÓN COMPLETADA EXITOSAMENTE                     ║
echo ║                                                              ║
echo ║  Acceda al sistema desde su navegador:                      ║
echo ║                                                              ║
echo ║     👉 http://localhost:5000                                ║
echo ║                                                              ║
echo ║  Para acceder desde otros dispositivos en la red:          ║
echo ║     👉 http://[IP-DE-ESTE-EQUIPO]:5000                      ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Presione cualquier tecla para abrir el navegador...
pause >nul

start http://localhost:5000
