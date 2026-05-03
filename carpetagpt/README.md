# OmniDownloader - version con mejoras GPT

Esta carpeta es una copia separada del proyecto original con cambios pensados para mejorar estabilidad, claridad y experiencia de uso.

## Cambios aplicados

- Se arreglo la ruta `/api/download`: ahora lee correctamente el parametro `mp3`, valida URLs y maneja errores del servidor remoto.
- Se elimino la dependencia directa a `node-fetch` y se usa `fetch` nativo de Node con streaming compatible.
- Se agrego validacion de URL en frontend y backend antes de analizar enlaces.
- Se limpiaron textos con codificacion rota y placeholders poco claros.
- Se mejoro la interfaz con chips de plataformas soportadas, estados informativos y radios visuales mas consistentes.
- Se agrego fallback visual cuando no llega miniatura.
- Se permite cambiar el puerto con `PORT=3001 npm run dev`.

## Como correr

1. Instalar dependencias:

```bash
npm install
```

2. Iniciar en desarrollo:

```bash
npm run dev
```

3. Abrir:

```text
http://localhost:3000
```

## Nota

Las descargas dependen de servicios externos y pueden fallar si una plataforma cambia sus bloqueos, cabeceras o formato de respuesta.
