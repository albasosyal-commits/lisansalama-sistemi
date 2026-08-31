@echo off
chcp 65001 >nul
title GitHub Otomatik Push Servisi
echo GitHub Otomatik Senkronizasyon baslatiliyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-push.ps1"
pause
