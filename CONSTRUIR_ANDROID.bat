@echo off
echo ==========================================
echo    CONSTRUYENDO OMNIDOWNLOADER ANDROID
echo ==========================================
echo.
echo [1/4] Instalando herramientas de Android...
call npm install @capacitor/core @capacitor/cli @capacitor/android

echo.
echo [2/4] Compilando proyecto React...
call npm run build

echo.
echo [3/4] Sincronizando con Android...
if not exist "android" (
    echo Inicializando carpeta nativa...
    call npx cap init OmniDownloader com.omnidownloader.app --web-dir dist
    call npx cap add android
) else (
    echo Actualizando archivos...
    call npx cap copy
    call npx cap sync android
)

echo.
echo [4/4] Abriendo Android Studio...
echo.
echo IMPORTANTE: Una vez abierto, ve a 'Build' -> 'Build APK'
call npx cap open android

echo.
echo ==========================================
echo    PROCESO COMPLETADO
echo ==========================================
pause
