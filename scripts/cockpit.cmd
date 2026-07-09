@echo off
rem Daily driver: build (seconds when cached) + serve the cockpit on
rem http://127.0.0.1:3000. Double-click this file or run it from any shell.
title atlas-cockpit
cd /d "%~dp0.."
call npm run cockpit
pause
