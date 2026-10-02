@echo off
setlocal

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js no encontrado / Node.js not found.
    echo Instalalo desde / Install it from: https://nodejs.org/en
    pause
    exit /b 1
)

echo Node.js:
node --version

if not exist "node_modules" (
    echo Instalando dependencias / Installing dependencies...
    call npm i
    if %errorlevel% neq 0 (
        echo Fallo npm i / npm i failed
        pause
        exit /b 1
    )
)

call npm start

endlocal
pause
