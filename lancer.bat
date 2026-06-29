@echo off
chcp 65001 >nul
title Lanceur Tournois DBL

echo ================================================
echo   TOURNOIS DBL - API + WhatsApp + Discord
echo ================================================
echo.

echo Arret des instances DBL deja en cours...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*DBLTournoois*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" 2>nul
timeout /t 2 /nobreak >nul

echo [1/2] Demarrage de l'API centrale (port 3000)...
start "DBL - API" /D "%~dp0api" cmd /k node "%~dp0api\src\index.js"

echo       Attente du demarrage de l'API (6s)...
timeout /t 6 /nobreak >nul

echo [2/3] Demarrage du bot WhatsApp...
start "DBL - WhatsApp" /D "%~dp0whatsapp-bot" cmd /k node "%~dp0whatsapp-bot\src\index.js"

echo [3/3] Demarrage du bot Discord...
start "DBL - Discord" /D "%~dp0discord-bot" cmd /k node "%~dp0discord-bot\src\index.js"

echo.
echo ------------------------------------------------
echo  Trois fenetres ouvertes :
echo    - "DBL - API"       (MongoDB Atlas, port 3000)
echo    - "DBL - WhatsApp"  (code d'appairage / QR au 1er lancement)
echo    - "DBL - Discord"   (slash commands)
echo.
echo  Pour arreter : fermez ces deux fenetres.
echo  Cette fenetre peut etre fermee.
echo ------------------------------------------------
echo.
pause
