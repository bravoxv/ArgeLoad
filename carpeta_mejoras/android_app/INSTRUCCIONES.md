# Guía para compilar OmniDownloader en Android

Para convertir este código en una App de Android (.apk), sigue estos pasos:

## 1. Requisitos previos
*   Tener instalado **Node.js**.
*   Tener instalado **Android Studio**.
*   Tener tu servidor (`server.ts`) ejecutándose en una IP pública o accesible desde tu red local.

## 2. Preparación del Proyecto
Copia los archivos de esta carpeta a un nuevo directorio o inicializa Capacitor en tu raíz:

```bash
# Instalar dependencias de Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android
```

## 3. Configuración del Servidor
En el archivo `App.mobile.tsx`, cambia la línea:
`const API_BASE_URL = "http://TU_IP_O_DOMINIO:3000";`
por la dirección real de tu servidor. **Importante:** Android no permite `localhost`, debes usar la IP de tu PC (ej. `192.168.1.15`).

## 4. Compilación
Ejecuta los siguientes comandos:

```bash
# 1. Construir la aplicación web (el resultado irá a la carpeta /dist)
npm run build

# 2. Inicializar el proyecto Android
npx cap init OmniDownloader com.tuempresa.omnidownloader --web-dir dist

# 3. Añadir la plataforma Android
npx cap add android

# 4. Abrir en Android Studio
npx cap open android
```

## 5. Generar el APK
Una vez que se abra **Android Studio**:
1. Espera a que termine el indexado (Gradle sync).
2. Ve a `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
3. ¡Listo! El archivo estará en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Notas Importantes
*   **Backend:** El servidor Node.js no corre dentro del celular. Debe estar en un VPS (como Render o Heroku) o en tu PC encendido.
*   **Permisos:** El archivo `AndroidManifest.xml` generado por Capacitor ya incluye permisos de internet básicos.
