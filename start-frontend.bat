@echo off
echo Starting SNP Inward Frontend...
cd /d "%~dp0frontend"

IF NOT EXIST "node_modules" (
    echo Installing npm dependencies...
    npm install
)

echo.
echo Frontend starting at http://localhost:3000
echo.
npm run dev
