@echo off
chcp 65001 >nul
docker-compose up -d
echo ✅ Servicios iniciados. Acceda a: http://localhost:5000
pause
