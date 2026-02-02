@echo off
chcp 65001 >nul
title Admin Residencial - Publicar Imágenes a Docker Hub

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     ADMIN RESIDENCIAL - PUBLICAR IMÁGENES A DOCKER HUB       ║
echo ║                                                              ║
echo ║  Este script construye y sube las imágenes a Docker Hub     ║
echo ║  para distribuir a clientes SIN código fuente               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Configuración - Tu usuario de Docker Hub
set DOCKER_USERNAME=fegama1206
set APP_IMAGE=%DOCKER_USERNAME%/adminresidencial
set PLATE_IMAGE=%DOCKER_USERNAME%/plate-recognition
set QR_IMAGE=%DOCKER_USERNAME%/qr-scanner
set VERSION=latest

echo ⚠️  IMPORTANTE: Asegúrese de haber iniciado sesión en Docker Hub
echo    Ejecute: docker login
echo.
echo Presione una tecla cuando haya iniciado sesión...
pause

:: Verificar que Docker está corriendo
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Docker no está corriendo. Abra Docker Desktop y espere.
    echo.
    pause
    exit /b 1
)
echo ✅ Docker está corriendo. Continuando...

echo.
echo [1/6] Construyendo imagen de la aplicación Node.js...
docker build -t %APP_IMAGE%:%VERSION% -f Dockerfile .
if %errorlevel% neq 0 (
    echo ❌ Error construyendo imagen de aplicación
    pause
    exit /b 1
)
echo ✅ Imagen de aplicación construida

echo.
echo [2/6] Construyendo imagen de reconocimiento de placas...
docker build -t %PLATE_IMAGE%:%VERSION% -f Reconocimiento/Dockerfile.local ./Reconocimiento
if %errorlevel% neq 0 (
    echo ❌ Error construyendo imagen de reconocimiento de placas
    pause
    exit /b 1
)
echo ✅ Imagen de reconocimiento de placas construida

echo.
echo [3/6] Construyendo imagen de escáner QR...
docker build -t %QR_IMAGE%:%VERSION% -f qr-scanner/Dockerfile.local ./qr-scanner
if %errorlevel% neq 0 (
    echo ❌ Error construyendo imagen de escáner QR
    pause
    exit /b 1
)
echo ✅ Imagen de escáner QR construida

echo.
echo [4/6] Subiendo imagen de aplicación a Docker Hub...
docker push %APP_IMAGE%:%VERSION%
if %errorlevel% neq 0 (
    echo ❌ Error subiendo imagen de aplicación
    pause
    exit /b 1
)
echo ✅ Imagen de aplicación subida

echo.
echo [5/6] Subiendo imagen de reconocimiento de placas a Docker Hub...
docker push %PLATE_IMAGE%:%VERSION%
if %errorlevel% neq 0 (
    echo ❌ Error subiendo imagen de reconocimiento
    pause
    exit /b 1
)
echo ✅ Imagen de reconocimiento subida

echo.
echo [6/6] Subiendo imagen de escáner QR a Docker Hub...
docker push %QR_IMAGE%:%VERSION%
if %errorlevel% neq 0 (
    echo ❌ Error subiendo imagen de escáner QR
    pause
    exit /b 1
)
echo ✅ Imagen de escáner QR subida

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║  ✅ IMÁGENES PUBLICADAS EXITOSAMENTE                        ║
echo ║                                                              ║
echo ║  Imágenes disponibles:                                      ║
echo ║    - %APP_IMAGE%:%VERSION%
echo ║    - %PLATE_IMAGE%:%VERSION%
echo ║    - %QR_IMAGE%:%VERSION%
echo ║                                                              ║
echo ║  Ahora puede distribuir la carpeta 'cliente' a sus clientes ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
