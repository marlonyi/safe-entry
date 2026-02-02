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

:: Configuración - CAMBIAR ESTOS VALORES
set DOCKER_USERNAME=adminresidencial
set APP_IMAGE=%DOCKER_USERNAME%/app
set PLATE_IMAGE=%DOCKER_USERNAME%/plate-recognition
set VERSION=latest

echo ⚠️  IMPORTANTE: Asegúrese de haber iniciado sesión en Docker Hub
echo    Ejecute: docker login
echo.
pause

:: Verificar login
docker info | findstr "Username" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ No ha iniciado sesión en Docker Hub.
    echo    Ejecute: docker login
    echo.
    pause
    exit /b 1
)

echo.
echo [1/4] Construyendo imagen de la aplicación Node.js...
docker build -t %APP_IMAGE%:%VERSION% -f Dockerfile .
if %errorlevel% neq 0 (
    echo ❌ Error construyendo imagen de aplicación
    pause
    exit /b 1
)
echo ✅ Imagen de aplicación construida

echo.
echo [2/4] Construyendo imagen de reconocimiento de placas...
docker build -t %PLATE_IMAGE%:%VERSION% -f Reconocimiento/Dockerfile.local ./Reconocimiento
if %errorlevel% neq 0 (
    echo ❌ Error construyendo imagen de reconocimiento
    pause
    exit /b 1
)
echo ✅ Imagen de reconocimiento construida

echo.
echo [3/4] Subiendo imagen de aplicación a Docker Hub...
docker push %APP_IMAGE%:%VERSION%
if %errorlevel% neq 0 (
    echo ❌ Error subiendo imagen de aplicación
    pause
    exit /b 1
)
echo ✅ Imagen de aplicación subida

echo.
echo [4/4] Subiendo imagen de reconocimiento a Docker Hub...
docker push %PLATE_IMAGE%:%VERSION%
if %errorlevel% neq 0 (
    echo ❌ Error subiendo imagen de reconocimiento
    pause
    exit /b 1
)
echo ✅ Imagen de reconocimiento subida

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║  ✅ IMÁGENES PUBLICADAS EXITOSAMENTE                        ║
echo ║                                                              ║
echo ║  Imágenes disponibles:                                      ║
echo ║    - %APP_IMAGE%:%VERSION%
echo ║    - %PLATE_IMAGE%:%VERSION%
echo ║                                                              ║
echo ║  Ahora puede distribuir la carpeta 'cliente' a sus clientes ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
