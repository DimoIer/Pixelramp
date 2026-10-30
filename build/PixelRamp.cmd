@echo off
cd /d "%~dp0"
if not defined PIXELRAMP_USER_DATA set "PIXELRAMP_USER_DATA=%~dp0PixelRampData"
start "" "PixelRamp.exe" --no-sandbox
