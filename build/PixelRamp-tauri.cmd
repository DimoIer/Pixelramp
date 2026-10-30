@echo off
cd /d "%~dp0"
if not defined PIXELRAMP_USER_DATA set "PIXELRAMP_USER_DATA=%~dp0PixelRampData"
if not defined WEBVIEW2_USER_DATA_FOLDER set "WEBVIEW2_USER_DATA_FOLDER=%~dp0PixelRampWebView"
start "" "PixelRamp.exe"
