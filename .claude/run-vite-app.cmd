@echo off
rem Dev server for the Vite app in "full code\app" (path contains a space,
rem so preview_start can't invoke vite there directly).
cd /d "C:\Users\User\OneDrive\Desktop\Admitica\full code\app"
"node_modules\.bin\vite.cmd" --base / --port 5191 --strictPort --host
