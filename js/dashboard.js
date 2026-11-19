// ==========================================================================
// BIBLIOTECA — dashboard.js
// Calcula las métricas del panel principal, dibuja los gráficos con Chart.js
// y gestiona el respaldo (exportar / importar / restaurar) de los datos.
// ==========================================================================

import {
  repoLibros,
  repoUsuarios,
  repoPrestamos,
  crearRespaldo,
  validarRespaldo,
  importarRespaldo,
  reiniciarDatos,
} from "./storage.js";
import { MESES_CORTOS, colorPorTexto, truncar, escapeHTML, hoyISO, descargarJSON, portadaDeLibro } from "./utils.js";
import { confirmar, mostrarToast, ICONOS } from "./ui.js";

let chartPrestamos = null;
let chartCategorias = null;
const portadasFallidas = new Set();

function obtenerColorVariable(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/* -------------------------------------------------------------------------
   Fallback de gráficos (sin conexión / CDN bloqueado)
   ------------------------------------------------------------------------- */
function alternarFallback(holder, visible, mensaje = "") {
  if (!holder) return;
  const canvas = holder.querySelector("canvas");
  let fallback = holder.querySelector(".chart-fallback");

  if (visible) {
    if (!fallback) {
      fallback = document.createElement("p");
      fallback.className = "chart-fallback";
      holder.appendChild(fallback);
    }
    fallback.textContent = mensaje;
    if (canvas) canvas.style.display = "none";
  } else {
    fallback?.remove();
    if (canvas) canvas.style.display = "";
  }
}

/* -------------------------------------------------------------------------
   Métricas
   ------------------------------------------------------------------------- */
function renderStats() {
  const libros = repoLibros.obtenerTodos();
  const usuarios = repoUsuarios.obtenerTodos();
  const prestamos = repoPrestamos.obtenerTodos();

  const prestados = libros.filter((l) => l.estado === "prestado").length;
  const disponibles = libros.length - prestados;

  document.querySelector("[data-stat-total-libros]").textContent = libros.length;
  document.querySelector("[data-stat-prestados]").textContent = prestados;
  document.querySelector("[data-stat-disponibles]").textContent = disponibles;
  document.querySelector("[data-stat-usuarios]").textContent = usuarios.length;

  const hoy = new Date();
  const prestamosDelMes = prestamos.filter((p) => {
    const [a, m] = p.fechaPrestamo.split("-").map(Number);
    return a === hoy.getFullYear() && m - 1 === hoy.getMonth();
  }).length;
  const elMes = document.querySelector("[data-stat-mes]");
  if (elMes) elMes.textContent = prestamosDelMes;
}

/** Construye los últimos 6 meses (incluyendo el actual) como {clave, etiqueta}. */
function ultimosMeses(cantidad = 6) {
  const meses = [];
  const base = new Date();
  for (let i = cantidad - 1; i >= 0; i--) {
    const fecha = new Date(base.getFullYear(), base.getMonth() - i, 1);
    meses.push({
      clave: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: `${MESES_CORTOS[fecha.getMonth()]}`,
    });
  }
  return meses;
}

function renderGraficoPrestamos(animar = true) {
  const canvas = document.getElementById("grafico-prestamos");
  if (!canvas) return;

  const holder = canvas.closest(".chart-holder");
  if (typeof Chart === "undefined") {
    alternarFallback(holder, true, "El gráfico no está disponible sin conexión.");
    return;
  }
  alternarFallback(holder, false);

  const prestamos = repoPrestamos.obtenerTodos();
  const meses = ultimosMeses(6);

  const conteos = meses.map(({ clave }) =>
    prestamos.filter((p) => p.fechaPrestamo.startsWith(clave)).length
  );

  const resumen = document.querySelector("[data-resumen-prestamos]");
  if (resumen) {
    resumen.textContent = `Préstamos por mes: ${meses
      .map((mes, i) => `${mes.etiqueta} ${conteos[i]}`)
      .join(", ")}.`;
  }

  if (chartPrestamos) chartPrestamos.destroy();
  chartPrestamos = new Chart(canvas, {
    type: "bar",
    data: {
      labels: meses.map((m) => m.etiqueta),
      datasets: [
        {
          label: "Préstamos",
          data: conteos,
          backgroundColor: obtenerColorVariable("--accent"),
          borderRadius: 6,
          maxBarThickness: 38,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animar ? undefined : false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: obtenerColorVariable("--text-secondary") } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: obtenerColorVariable("--text-secondary") },
          grid: { color: obtenerColorVariable("--border") },
        },
      },
    },
  });
}

function renderGraficoCategorias(animar = true) {
  const canvas = document.getElementById("grafico-categorias");
  const leyenda = document.querySelector("[data-leyenda-categorias]");
  if (!canvas || !leyenda) return;

  const holder = canvas.closest(".chart-holder");
  const libros = repoLibros.obtenerTodos();
  const prestamos = repoPrestamos.obtenerTodos();
  const porLibro = new Map(libros.map((l) => [l.id, l]));

  const conteoPorCategoria = new Map();
  prestamos.forEach((p) => {
    const libro = porLibro.get(p.libroId);
    if (!libro) return;
    conteoPorCategoria.set(libro.categoria, (conteoPorCategoria.get(libro.categoria) ?? 0) + 1);
  });

  const entradas = [...conteoPorCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  if (entradas.length === 0) {
    leyenda.innerHTML = `<p class="muted">Aún no hay préstamos registrados.</p>`;
    alternarFallback(holder, true, "Sin préstamos para graficar.");
    chartCategorias?.destroy();
    chartCategorias = null;
    return;
  }

  if (typeof Chart === "undefined") {
    alternarFallback(holder, true, "El gráfico no está disponible sin conexión.");
    return;
  }
  alternarFallback(holder, false);

  const colores = entradas.map(([categoria]) => colorPorTexto(categoria));

  if (chartCategorias) chartCategorias.destroy();
  chartCategorias = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: entradas.map(([categoria]) => categoria),
      datasets: [{ data: entradas.map(([, conteo]) => conteo), backgroundColor: colores, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animar ? undefined : false,
      plugins: { legend: { display: false } },
      cutout: "68%",
    },
  });

  // escapeHTML: la categoría viene de datos editables por el usuario.
  leyenda.innerHTML = entradas
    .map(
      ([categoria, conteo], i) => `
      <div class="donut-legend__item">
        <span class="donut-legend__swatch" style="background:${colores[i]}"></span>
        <span>${escapeHTML(categoria)}</span>
        <strong>${conteo}</strong>
      </div>`
    )
    .join("");

  const resumen = document.querySelector("[data-resumen-categorias]");
  if (resumen) {
    resumen.textContent = `Categorías más prestadas: ${entradas
      .map(([categoria, conteo]) => `${categoria}, ${conteo} préstamos`)
      .join("; ")}.`;
  }
}

function renderRankingLibros() {
  const libros = repoLibros.obtenerTodos();
  const prestamos = repoPrestamos.obtenerTodos();
  const porLibro = new Map(libros.map((l) => [l.id, l]));

  const conteo = new Map();
  prestamos.forEach((p) => conteo.set(p.libroId, (conteo.get(p.libroId) ?? 0) + 1));

  const top = [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([libroId, total]) => ({ libro: porLibro.get(libroId), total }))
    .filter((item) => item.libro);

  const contenedor = document.querySelector("[data-ranking-libros]");
  if (top.length === 0) {
    contenedor.innerHTML = `<p class="muted">Sin préstamos todavía.</p>`;
    return;
  }

  contenedor.innerHTML = top
    .map((item, i) => {
      const portada = portadaDeLibro(item.libro, "S");
      const mostrarPortada = portada && !portadasFallidas.has(portada);
      return `
      <div class="ranking-item">
        <span class="ranking-item__rank">${i + 1}</span>
        <span class="book-thumb book-thumb--sm" style="--cat-color:${colorPorTexto(item.libro.categoria)}" aria-hidden="true">
          ${ICONOS.libro}
          ${mostrarPortada ? `<img src="${escapeHTML(portada)}" alt="" width="30" height="45" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-portada="${escapeHTML(portada)}" />` : ""}
        </span>
        <div class="ranking-item__body">
          <div class="ranking-item__title">${escapeHTML(truncar(item.libro.titulo, 34))}</div>
          <div class="ranking-item__sub">${escapeHTML(item.libro.autor)}</div>
        </div>
        <span class="ranking-item__count">${item.total} ${item.total === 1 ? "préstamo" : "préstamos"}</span>
      </div>`;
    })
    .join("");

  contenedor.querySelectorAll("img[data-portada]").forEach((imagen) => {
    imagen.addEventListener(
      "error",
      () => {
        portadasFallidas.add(imagen.dataset.portada);
        imagen.remove();
      },
      { once: true }
    );
  });
}

function renderRankingUsuarios() {
  const usuarios = repoUsuarios.obtenerTodos();
  const prestamos = repoPrestamos.obtenerTodos();
  const porUsuario = new Map(usuarios.map((u) => [u.id, u]));

  const conteo = new Map();
  prestamos.forEach((p) => conteo.set(p.usuarioId, (conteo.get(p.usuarioId) ?? 0) + 1));

  const top = [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([usuarioId, total]) => ({ usuario: porUsuario.get(usuarioId), total }))
    .filter((item) => item.usuario);

  const contenedor = document.querySelector("[data-ranking-usuarios]");
  if (top.length === 0) {
    contenedor.innerHTML = `<p class="muted">Sin préstamos todavía.</p>`;
    return;
  }

  contenedor.innerHTML = top
    .map(
      (item, i) => `
      <div class="ranking-item">
        <span class="ranking-item__rank">${i + 1}</span>
        <div class="ranking-item__body">
          <div class="ranking-item__title">${escapeHTML(item.usuario.nombre)}</div>
          <div class="ranking-item__sub">${escapeHTML(item.usuario.correo)}</div>
        </div>
        <span class="ranking-item__count">${item.total} ${item.total === 1 ? "préstamo" : "préstamos"}</span>
      </div>`
    )
    .join("");
}

function renderGraficos(animar = true) {
  renderGraficoPrestamos(animar);
  renderGraficoCategorias(animar);
}

/* -------------------------------------------------------------------------
   Datos y respaldo
   ------------------------------------------------------------------------- */
function descargarRespaldo() {
  const respaldo = crearRespaldo();
  descargarJSON(`biblioteca-respaldo-${hoyISO()}.json`, respaldo);
  mostrarToast("Respaldo JSON descargado.");
}

async function importarDesdeArchivo(evento) {
  const archivo = evento.target.files?.[0];
  evento.target.value = "";
  if (!archivo) return;

  let datos;
  try {
    datos = JSON.parse(await archivo.text());
  } catch {
    mostrarToast("El archivo no contiene un JSON válido.", "error");
    return;
  }

  const error = validarRespaldo(datos);
  if (error) {
    mostrarToast(error, "error", 5600);
    return;
  }

  const ok = await confirmar({
    titulo: "Importar respaldo",
    mensaje: `Se reemplazarán los datos actuales por ${datos.libros.length} libros, ${datos.usuarios.length} usuarios y ${datos.prestamos.length} préstamos. Esta acción no se puede deshacer.`,
    textoConfirmar: "Importar",
    variante: "primary",
  });
  if (!ok) return;

  const errorImportacion = importarRespaldo(datos);
  if (errorImportacion) {
    mostrarToast(errorImportacion, "error", 5600);
    return;
  }

  mostrarToast("Respaldo importado. Recargando…");
  setTimeout(() => location.reload(), 700);
}

async function restaurarDatosEjemplo() {
  const ok = await confirmar({
    titulo: "Restaurar datos de ejemplo",
    mensaje: "Se borrarán todos los libros, usuarios y préstamos actuales y se cargarán los datos de demostración. Esta acción no se puede deshacer.",
    textoConfirmar: "Restaurar",
  });
  if (!ok) return;

  reiniciarDatos();
  mostrarToast("Datos de ejemplo restaurados. Recargando…");
  setTimeout(() => location.reload(), 700);
}

function iniciarRespaldo() {
  document.querySelector("[data-exportar-respaldo]")?.addEventListener("click", descargarRespaldo);

  const inputArchivo = document.querySelector("[data-archivo-respaldo]");
  document.querySelector("[data-importar-respaldo]")?.addEventListener("click", () => inputArchivo?.click());
  inputArchivo?.addEventListener("change", importarDesdeArchivo);

  document.querySelector("[data-restaurar-datos]")?.addEventListener("click", restaurarDatosEjemplo);
}

/* -------------------------------------------------------------------------
   Inicialización
   ------------------------------------------------------------------------- */
function iniciar() {
  renderStats();
  renderGraficos(true);
  renderRankingLibros();
  renderRankingUsuarios();
  iniciarRespaldo();

  // Otra pestaña modificó los datos: refrescar todo el panel.
  document.addEventListener("biblioteca:datos-actualizados", (evento) => {
    if (evento.detail?.clave === "biblioteca_tema") return;
    renderStats();
    renderGraficos(false);
    renderRankingLibros();
    renderRankingUsuarios();
  });

  // Observar cambios de tema para redibujar gráficos con colores actualizados.
  const observer = new MutationObserver(() => {
    // Esperar un frame para que las CSS custom properties se actualicen.
    requestAnimationFrame(() => renderGraficos(false));
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

document.addEventListener("DOMContentLoaded", iniciar);
