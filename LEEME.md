# Mis marcas

Al abrir la web ves las publicaciones recientes de Instagram de tus marcas. Arriba a la derecha hay un botón de menú con el índice de marcas, ordenado de la A a la Z y con el logo de cada una. Al elegir una marca se abre su web dentro de la app (pestaña Tienda); en la pestaña Novedades ves sus artículos, publicaciones de Instagram y blog. Se actualiza sola cada 6 horas.

Instálala en el móvil: ábrela en el navegador y elige “Añadir a pantalla de inicio”. Así funciona como una app.

**Guardados:** toca el corazón de cualquier artículo (pestaña Novedades de cada marca) y aparece en Guardados, que reúne los de todas las marcas. También puedes añadir un artículo pegando su enlace (útil con tiendas sin catálogo público). En Guardados puedes crear tus propios grupos (por ejemplo, Invierno, Regalos o Boda): pulsa «+ Nuevo grupo», y en cada artículo el botón de grupos para meterlo en uno o varios. Puedes filtrar por grupo y por marca a la vez, y renombrar o eliminar grupos (los artículos no se borran). Los guardados y los grupos se almacenan en el propio dispositivo: no se comparten entre móvil y ordenador, y la app instalada en el iPhone guarda aparte de Safari.

## 1. Puesta en marcha (una sola vez)
1. Crea una cuenta gratuita en github.com y un repositorio público (por ejemplo `mis-marcas`).
2. Sube todo el contenido de esta carpeta (Add file > Upload files). Comprueba que se sube `.github/workflows`; si no, créalo con Add file > Create new file con el nombre `.github/workflows/actualizar.yml` y pega su contenido.
3. Settings > Pages: Source = Deploy from a branch, Branch = `main`, carpeta `/ (root)`.
4. Settings > Actions > General > Workflow permissions: "Read and write permissions".
5. Actions > "Actualizar artículos" > Run workflow.
6. Tu web: `https://TU-USUARIO.github.io/mis-marcas/`

## 2. Tus marcas
`marcas.json` ya incluye las 56 cuentas que sigues en Instagram. Con Instagram conectado (paso 3), la web rellena sola el nombre, el logo y la web de cada marca a partir de su perfil. Sin conectarlo, ya verás el índice, y las marcas sin web aparecen con su usuario de Instagram. Para ocho de ellas he puesto la web directamente.

Para añadir otra marca basta con su usuario de Instagram:

    { "instagram": "usuario_de_la_marca" }

Y si quieres cambiar algo, puedes añadir estos campos opcionales:

    { "instagram": "usuario", "nombre": "Nombre", "web": "https://www.marca.com", "logo": "https://...", "incrustar": false, "feed": "https://..." }

- `nombre` y `web`: mandan sobre lo que se detecte en Instagram.
- Los artículos se leen del catálogo público de la tienda (muy bien con tiendas Shopify y con muchas que publican mapa del sitio con imágenes). Los grandes grupos no ofrecen catálogo público.
- Muchas webs (casi todas las grandes) prohíben mostrarse dentro de otra página. Con ellas, el botón “Abrir” las abre en una ventana aparte; si tienes la web instalada en el móvil, normalmente se abre dentro de la app y vuelves con un toque. `incrustar` (`true` o `false`) fuerza una u otra opción.
- `feed`: dirección del blog de la marca si no se detecta sola.
- Las cuentas personales (no profesionales) no se pueden leer por la API de Instagram: esas se quedan sin publicaciones ni datos automáticos. Si alguna lo es, puedes quitarla de `marcas.json` o ponerle `nombre` y `web` a mano.

## 3. Conectar Instagram (opcional, pero necesario para ver las publicaciones)
Instagram no permite leer una cuenta personal con usuario y contraseña: solo ofrece su API oficial. **No compartas tu contraseña con nadie, ni conmigo ni con ninguna herramienta.** La vía oficial y gratuita es esta:

1. Tu cuenta de Instagram debe ser profesional (Ajustes > Tipo de cuenta > Cambiar a cuenta profesional, es gratis) y estar vinculada a una página de Facebook.
2. En developers.facebook.com crea una app de tipo Business con el caso de uso de Instagram, y conéctala a tu cuenta.
3. Genera un token de acceso de larga duración con los permisos `instagram_basic`, `pages_show_list` y `pages_read_engagement`, y apunta el ID de tu cuenta de Instagram profesional.
4. En tu repositorio: Settings > Secrets and variables > Actions > New repository secret. Crea dos: `IG_USER_ID` (tu ID) e `IG_TOKEN` (el token).

Con eso, la web lee las publicaciones públicas de las cuentas profesionales de `marcas.json` (Business Discovery). No lee a quién sigues: la lista de marcas es la de `marcas.json`.
Los tokens caducan; si las publicaciones dejan de salir, genera uno nuevo y actualiza el secreto `IG_TOKEN`.
