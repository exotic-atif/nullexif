@echo off
title NullExif Server (v2.1.0)
if not exist "dist\bundle.js" (
    echo Building frontend assets...
    call npm run build
)
echo Starting NullExif on http://localhost:6767 ...
start "" http://localhost:6767
php -S localhost:6767