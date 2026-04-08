@echo off
chcp 65001 >nul
title Admin Residencial - Crear Respaldo

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         ADMIN RESIDENCIAL - CREAR RESPALDO                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Crear carpeta de respaldos si no existe
if not exist "backups" mkdir backups

:: Obtener fecha actual
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set fecha=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%%datetime:~10,2%

set backup_dir=backups\backup_%fecha%

echo Creando respaldo en: %backup_dir%
echo.

:: Crear respaldo dentro del contenedor
docker exec admin-residencial-mongodb mongodump --out /backup/dump_%fecha%
if %errorlevel% neq 0 (
    echo ❌ Error al crear respaldo en MongoDB.
    pause
    exit /b 1
)

:: Copiar respaldo al host
docker cp admin-residencial-mongodb:/backup/dump_%fecha% %backup_dir%
if %errorlevel% neq 0 (
    echo ❌ Error al copiar respaldo.
    pause
    exit /b 1
)

:: Limpiar respaldo temporal en contenedor
docker exec admin-residencial-mongodb rm -rf /backup/dump_%fecha%

echo.
echo ✅ Respaldo creado exitosamente en:
echo    %cd%\%backup_dir%
echo.

pause
