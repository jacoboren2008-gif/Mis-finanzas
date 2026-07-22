# Mis Finanzas — Guía de uso

Esta es tu app personal de finanzas. Vive completamente en tu navegador: no hay
servidor ni cuenta en la nube, todos tus datos se guardan solo en este
dispositivo. Por eso los respaldos (ver más abajo) son importantes.

## 1. Usarla ahora mismo en tu computador

No necesitas instalar nada (Node, Python, etc.). Solo necesitas Windows con
PowerShell, que ya viene incluido.

1. Haz doble clic en `tools/serve.ps1` **o** abre PowerShell en esta carpeta y ejecuta:

   ```
   powershell -ExecutionPolicy Bypass -File tools/serve.ps1
   ```

2. Abre tu navegador en **http://localhost:8080**
3. Para detener el servidor, cierra la ventana de PowerShell o presiona `Ctrl+C`.

Mientras uses esta dirección `localhost`, la app funciona offline y se puede
"instalar" como aplicación de escritorio (ícono de instalar en la barra de
direcciones de Chrome/Edge).

## 2. Instalarla de verdad en tu celular

Aquí hay un detalle técnico importante: para que un navegador permita instalar
una app y que funcione sin internet, el sitio debe cargar por **HTTPS**. Tu
propio computador sirviendo la app en tu red WiFi (`http://192.168.x.x:8080`)
no cumple esto, así que el celular podría crear un simple acceso directo, pero
no una instalación real con soporte offline.

La forma más sencilla y gratuita de lograrlo es subir la carpeta del proyecto
a **GitHub Pages** o **Cloudflare Pages** — ambos te dan una dirección HTTPS
gratis y no necesitas saber de código ni de la terminal, solo arrastrar
archivos. Con GitHub:

1. Crea una cuenta gratuita en [github.com](https://github.com) si no tienes una.
2. Crea un repositorio nuevo (puede ser privado).
3. Sube todos los archivos de esta carpeta (arrastrar y soltar funciona desde
   la web de GitHub).
4. Ve a **Settings → Pages**, elige la rama principal como fuente y guarda.
5. GitHub te da una dirección como `https://tu-usuario.github.io/tu-repo/`.
6. Abre esa dirección desde el navegador de tu celular (Chrome en Android,
   Safari en iPhone) y usa la opción **"Agregar a la pantalla de inicio"** o
   **"Instalar app"**.

Con Cloudflare Pages el proceso es similar y también admite arrastrar y
soltar la carpeta directamente, sin necesidad de Git.

> Si prefieres que te acompañe paso a paso creando la cuenta y subiendo los
> archivos, dímelo y lo hacemos juntos — esa parte la tienes que hacer tú
> porque implica crear una cuenta.

## 3. Tus datos — respaldos (muy importante)

Como no hay nube, **tu único respaldo es el que tú generes**. Ve a
**Perfil → Exportar respaldo (JSON)** y guarda ese archivo en un lugar seguro
(correo, Drive, USB) de vez en cuando, sobre todo antes de cambiar de celular
o formatear el computador.

Si algún día necesitas recuperarlo, usa **Perfil → Restaurar desde un
respaldo**. Antes de reemplazar tus datos, la app descarga automáticamente
una copia de seguridad de lo que tengas en ese momento, por si acaso.

Si borras los datos del sitio en el navegador, desinstalas la app o cambias
de dispositivo sin haber exportado un respaldo, **la información se pierde
para siempre** — no hay forma de recuperarla.

## 4. El PIN de acceso

El PIN que puedes configurar en Perfil es un **candado local**, no una cuenta
segura ni cifrado real: solo evita que alguien que tome tu celular vea tus
finanzas a simple vista. Si olvidas el PIN, la única opción es borrar los
datos del dispositivo y, si tenías un respaldo exportado, restaurarlo.

Por seguridad, la app te pide el PIN de nuevo si la dejas en segundo plano
más de unos segundos (por ejemplo, si cambias de app y vuelves).

## 5. Estructura del proyecto (por si quieres tocar el código)

```
index.html            Punto de entrada de la app
css/styles.css         Todos los estilos
manifest.webmanifest    Configuración de instalación PWA
service-worker.js       Caché offline (sube CACHE_VERSION al editar archivos)
js/db.js                Toda la base de datos (IndexedDB)
js/app.js               Arranque: onboarding, PIN, ruteo
js/views/               Cada pantalla principal
js/components/          Piezas reutilizables (formularios, modal, tarjetas)
js/charts.js            Gráficas hechas a mano, sin librerías
tools/serve.ps1         Servidor local sin dependencias
tests.html              Chequeos internos de la lógica más delicada
```

No hay paso de "build": puedes editar cualquier archivo `.js`/`.css`/`.html`
y solo recargar el navegador para ver el cambio (borra la caché del
Service Worker o entra en una pestaña de incógnito si no ves tu cambio).
