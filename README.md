# 📚 Biblioteca — Sistema de Gestión

Sistema de gestión para una biblioteca pequeña: catálogo de libros, registro de
usuarios, préstamos/devoluciones y un dashboard con estadísticas. Construido
100% con HTML5, CSS3 y JavaScript (ES2023+) usando módulos ES nativos y
LocalStorage como persistencia — sin frameworks ni build step.

## ▶️ Cómo ejecutarlo

Como el proyecto usa **módulos ES** (`<script type="module">`), los navegadores
bloquean su carga si abres `index.html` directamente con doble clic
(protocolo `file://`). Necesitas servirlo con un servidor HTTP local —
cualquiera de estas opciones funciona:

```bash
# Opción 1: Python (ya viene instalado en la mayoría de los sistemas)
cd biblioteca
python3 -m http.server 8080
# luego abre http://localhost:8080

# Opción 2: Node (npx, sin instalar nada global)
cd biblioteca
npx serve .

# Opción 3: extensión "Live Server" de VS Code
# clic derecho sobre index.html → "Open with Live Server"
```

La portada (`index.html`) es una landing real: explica el sistema y lleva al
dashboard mediante un botón, sin redirecciones automáticas.

Al abrir el sitio por primera vez se cargan automáticamente datos de ejemplo
(12 libros, 5 usuarios y 10 préstamos históricos) para que el dashboard y los
gráficos no se vean vacíos. Todo se guarda después en `localStorage`, así que
los cambios persisten entre recargas.

### Respaldo de los datos

Los datos viven solo en el navegador, por lo que conviene exportarlos:

- **Dashboard → Descargar respaldo**: genera un archivo JSON con libros,
  usuarios y préstamos.
- **Dashboard → Importar respaldo**: valida el archivo antes de reemplazar los
  datos actuales y pide confirmación.
- **Dashboard → Restaurar ejemplo**: vuelve al set inicial de demostración.

También puedes limpiar todo desde la consola del navegador:

```js
localStorage.clear(); location.reload();
```

## 🗂️ Estructura

```
biblioteca/
├── index.html          # Landing pública con CTA al panel
├── dashboard.html      # Métricas, gráficos (Chart.js) y respaldos
├── libros.html         # CRUD de libros, búsqueda, filtros, orden, PDF
├── usuarios.html       # CRUD de usuarios, búsqueda
├── prestamos.html      # Registrar préstamo/devolución, historial, PDF
├── robots.txt          # Directivas de rastreo para buscadores
├── sitemap.xml         # Mapa del sitio para buscadores
├── css/
│   ├── style.css       # Tokens de diseño, layout, componentes base
│   ├── dashboard.css   # Tarjetas de métricas, gráficos y mantenimiento
│   ├── forms.css       # Modales y formularios
│   └── responsive.css  # Adaptación a tablet/móvil
├── js/
│   ├── app.js           # Bootstrap común a todas las páginas
│   ├── storage.js       # Clases de modelo, repositorio y respaldos
│   ├── utils.js         # Validaciones, fechas, portadas y compresión de imágenes
│   ├── ui.js            # Modales, toasts, tema, drawer y helpers de formulario
│   ├── pdf.js           # Carga perezosa de jsPDF + exportación de tablas
│   ├── dashboard.js     # Métricas, gráficos y respaldos del panel
│   ├── libros.js        # Lógica de la página de libros
│   ├── usuarios.js      # Lógica de la página de usuarios
│   └── prestamos.js     # Lógica de la página de préstamos
├── assets/
│   ├── icons/           # Favicon SVG y apple-touch-icon
│   └── images/          # Imagen Open Graph para compartir en redes
└── data/                # (reservado — los datos viven en LocalStorage)
```

## ✅ Funcionalidades implementadas

- **Dashboard:** total de libros, prestados, disponibles, usuarios
  registrados, gráfico de préstamos por mes (barras), categorías más
  populares (dona) y rankings de libros/usuarios con más préstamos. Los
  gráficos tienen resumen textual para lectores de pantalla y un aviso de
  respaldo si Chart.js no carga.
- **Libros:** alta, edición, eliminación (bloqueada si el libro está
  prestado), búsqueda en tiempo real (título/autor/ISBN), filtro por
  categoría y estado, orden por columnas (accesible con teclado y con un
  selector propio en móvil), validación de ISBN-10/13 y de año,
  **autocompletado por título** y **portadas**: al escribir un título se
  buscan coincidencias en Open Library y, al elegir una, se completan autor,
  categoría, ISBN, año y portada. Las portadas también se buscan por ISBN, se
  pueden subir desde el equipo (se recortan y comprimen a WebP ~300×450) o
  indicar con una URL. La miniatura aparece en la tabla y en el ranking del
  dashboard.
- **Usuarios:** registro, edición, eliminación (bloqueada si tiene
  préstamos activos), búsqueda en tiempo real, validación de RUT chileno
  (dígito verificador real), correo y teléfono.
- **Préstamos:** selección de usuario y libro disponible, fecha de
  devolución estimada (no permite fechas pasadas), registro de devolución,
  historial completo con búsqueda y filtro por estado, marca visual de
  atraso.
- **Respaldo:** exportación/importación JSON validada y restauración de los
  datos de ejemplo desde el dashboard.
- **Extras:** modo oscuro (con detección de preferencia del sistema),
  exportación a PDF de libros y préstamos (jsPDF cargado solo al pulsar el
  botón), búsqueda con debounce, diseño responsive y navegación móvil por
  tab bar inferior con modales tipo *bottom sheet*.

### Autocompletado por título

- Al escribir al menos **3 letras** del título, aparece una lista con hasta
  seis coincidencias de la
  [API de búsqueda de Open Library](https://openlibrary.org/developers/api).
  Cada sugerencia muestra título, autor y año para distinguir ediciones.
- Al elegir una sugerencia con el mouse, con el dedo o con **↑ ↓ + Enter**, se
  completan título, autor, categoría, ISBN, año y portada. La categoría se
  deduce de los temas del libro y siempre se puede cambiar antes de guardar.
- No se completa nada hasta que eliges una sugerencia: así se evita guardar
  una edición u obra equivocada solo porque coincidía el título.
- Si ya subiste o pegaste una portada manual, el autocompletado **no la
  reemplaza**. La búsqueda se hace directamente desde el navegador a
  Open Library, sin API key ni servidor propio, y requiere conexión.
- El campo funciona como un *combobox* accesible: lista `listbox`, opciones con
  `aria-selected`, navegación con flechas, cierre con Escape y avisos en una
  región `aria-live`.

### Portadas de libros

- **Automáticas:** al escribir un ISBN válido se busca la portada en
  [Open Library](https://openlibrary.org/) (`covers.openlibrary.org`). Si no
  existe, se muestra un ícono con el color de la categoría. Al elegir una
  sugerencia por título también se usa la portada de esa edición cuando está
  disponible.
- **Subidas:** se aceptan imágenes de hasta 10 MB que el navegador pueda
  decodificar (PNG, JPEG, WebP, GIF, AVIF, etc.); la imagen se recorta al
  centro (2:3) y se comprime a WebP de 300×450 antes de guardarse. Una portada
  típica pesa ~30–60 KB.
- **URL manual:** también puedes pegar un enlace `https://…` o una ruta local
  como `assets/images/portada.jpg`.
- **Quitar:** oculta la portada y desactiva la búsqueda automática para ese
  libro; puedes volver a activarla con *Buscar por ISBN*.
- Las portadas subidas se guardan en LocalStorage y por eso **entran en el
  respaldo JSON**. Si guardas muchos libros con imagen, revisa el espacio
  disponible del navegador. Las portadas remotas solo guardan la URL y
  necesitan conexión para verse.

### Accesibilidad y rendimiento

- Etiquetas semánticas, *skip link*, foco visible y contraste AA.
- Modales con trampa de foco, cierre con Escape, atributo `inert` y
  `aria-hidden` para que lo cerrado no sea enfocable ni anunciado.
- Errores de formulario enlazados con `aria-invalid` y `aria-describedby`.
- El autocompletado de títulos usa el patrón accesible *combobox/listbox*, con
  navegación por teclado y avisos `aria-live`.
- Encabezados de tabla ordenables con `aria-sort`; avisos con `aria-live`.
- Sincronización entre pestañas: si editas en una, las demás se actualizan.
- Chart.js y jsPDF se cargan desde CDN con **SRI** (integridad verificada);
  jsPDF solo se descarga al exportar.
- Fuentes recortadas a DM Serif Display y Source Sans 3 (400/500/600/700);
  el resto usa la pila del sistema.

## 🧠 Decisiones técnicas

- **Sin frameworks:** todo el DOM se actualiza manualmente para practicar
  manipulación directa, delegación de eventos y plantillas con template
  strings.
- **Repositorio genérico (`Repositorio`)** en `storage.js`: una sola clase
  con `obtenerTodos/agregar/actualizar/eliminar` reutilizada por libros,
  usuarios y préstamos — evita repetir lógica de LocalStorage tres veces.
- **Shell estático por página:** la navegación y la topbar se repiten en cada
  HTML en lugar de inyectarse por JS. Es deliberado: evita un parpadeo al
  cargar y permite que los buscadores lean el contenido sin ejecutar scripts.
- **El "sello" de estado "Prestado"** (`.stamp` en `style.css`) y la etiqueta
  de categoría tipo lomo (`.spine-tag`) son el detalle visual distintivo:
  imitan las marcas de una ficha de préstamo de biblioteca física.
- **CDN usados:** Chart.js (`dashboard.html`) y jsPDF (`js/pdf.js`). Si
  necesitas trabajar sin conexión, descarga ambas librerías y cambia las URLs
  por rutas locales.

## 🔎 SEO y despliegue

- Cada página tiene `title`, `description`, canonical relativo, favicon,
  Open Graph/Twitter y `lang="es-CL"`.
- `robots.txt` bloquea solo `/data/` y permite CSS/JS/assets.
- **Antes de publicar**, reemplaza `https://biblioteca-ejemplo.com` por tu
  dominio real en: `og:image`/`twitter:image` de los HTML, JSON-LD,
  `robots.txt` y `sitemap.xml`. La imagen de compartir está en
  `assets/images/og-cover.png` (1200×630).

## 🚀 Posibles siguientes pasos

Tal como sugiere la guía del proyecto, esta misma aplicación se puede
reconstruir más adelante con React + Node.js/Express + MySQL, reemplazando
`storage.js` por llamadas a una API REST — el resto de la lógica de negocio
(validaciones, reglas de préstamo) se traslada casi sin cambios.

---

Proyecto desarrollado por **Matías Torres Sandoval** como pieza de portafolio — Ingeniero Civil Informático (UNAB).
