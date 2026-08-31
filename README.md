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

Al abrir el sitio por primera vez se cargan automáticamente datos de ejemplo
(12 libros, 5 usuarios y 10 préstamos históricos) para que el dashboard y los
gráficos no se vean vacíos. Todo se guarda después en `localStorage`, así que
los cambios persisten entre recargas. Si en algún momento quieres limpiar todo
y volver a los datos de ejemplo, abre la consola del navegador y ejecuta:

```js
localStorage.clear(); location.reload();
```

## 🗂️ Estructura

```
biblioteca/
├── index.html        # Pantalla de entrada (redirige a dashboard.html)
├── dashboard.html     # Métricas + gráficos (Chart.js)
├── libros.html        # CRUD de libros, búsqueda, filtros, orden, PDF
├── usuarios.html       # CRUD de usuarios, búsqueda
├── prestamos.html      # Registrar préstamo/devolución, historial, PDF
├── css/
│   ├── style.css       # Tokens de diseño, layout, componentes base
│   ├── dashboard.css   # Tarjetas de métricas y gráficos
│   ├── forms.css       # Modales y formularios
│   └── responsive.css  # Adaptación a tablet/móvil
├── js/
│   ├── app.js           # Bootstrap común a todas las páginas
│   ├── storage.js        # Clases de modelo + repositorio sobre LocalStorage
│   ├── utils.js           # Validaciones, fechas, helpers puros
│   ├── ui.js               # Modales, toasts, tema claro/oscuro, sidebar
│   ├── dashboard.js         # Métricas y gráficos del panel principal
│   ├── libros.js              # Lógica de la página de libros
│   ├── usuarios.js             # Lógica de la página de usuarios
│   └── prestamos.js             # Lógica de la página de préstamos
├── assets/
│   ├── icons/            # (reservado — los iconos actuales son SVG inline)
│   └── images/           # (reservado para uso futuro)
└── data/                  # (reservado — los datos viven en LocalStorage)
```

## ✅ Funcionalidades implementadas

- **Dashboard:** total de libros, prestados, disponibles, usuarios
  registrados, gráfico de préstamos por mes (barras), categorías más
  populares (dona) y rankings de libros/usuarios con más préstamos.
- **Libros:** alta, edición, eliminación (bloqueada si el libro está
  prestado), búsqueda en tiempo real (título/autor/ISBN), filtro por
  categoría y estado, orden por columnas (clic en el encabezado),
  validación de ISBN-10/13 y de año.
- **Usuarios:** registro, edición, eliminación (bloqueada si tiene
  préstamos activos), búsqueda en tiempo real, validación de RUT chileno
  (dígito verificador real), correo y teléfono.
- **Préstamos:** selección de usuario y libro disponible, fecha de
  devolución estimada editable, registro de devolución, historial completo
  con búsqueda y filtro por estado, marca visual de atraso.
- **Extras:** modo oscuro (con detección de preferencia del sistema),
  exportación a PDF de libros y préstamos (jsPDF), gráficos con Chart.js,
  búsqueda en tiempo real con debounce, diseño responsive (las tablas se
  convierten en tarjetas en móvil), animaciones suaves con CSS, y
  accesibilidad: etiquetas semánticas, *skip link*, navegación por teclado
  en los modales (trampa de foco + cierre con Escape), `aria-live` en las
  notificaciones y foco visible en todos los controles.

## 🧠 Decisiones técnicas

- **Sin frameworks:** todo el DOM se actualiza manualmente para practicar
  manipulación directa, delegación de eventos y plantillas con template
  strings.
- **Repositorio genérico (`Repositorio`)** en `storage.js`: una sola clase
  con `obtenerTodos/agregar/actualizar/eliminar` reutilizada por libros,
  usuarios y préstamos — evita repetir lógica de LocalStorage tres veces.
- **El "sello" de estado "Prestado"** (`.stamp` en `style.css`) es el
  detalle visual distintivo de la interfaz: imita el sello de tampón que
  se estampaba en las fichas de préstamo de una biblioteca física.
- **CDN usados:** Chart.js (`dashboard.html`) y jsPDF (`libros.html`,
  `prestamos.html`). Si necesitas trabajar sin conexión, descarga ambas
  librerías y cambia las URLs por rutas locales.

## 🚀 Posibles siguientes pasos

Tal como sugiere la guía del proyecto, esta misma aplicación se puede
reconstruir más adelante con React + Node.js/Express + MySQL, reemplazando
`storage.js` por llamadas a una API REST — el resto de la lógica de negocio
(validaciones, reglas de préstamo) se traslada casi sin cambios.
