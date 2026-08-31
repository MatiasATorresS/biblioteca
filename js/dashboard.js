// ==========================================================================
// BIBLIOTECA — dashboard.js
// Calcula las métricas del panel principal y dibuja los gráficos con
// Chart.js (cargado globalmente vía CDN en dashboard.html).
// ==========================================================================

import { repoLibros, repoUsuarios, repoPrestamos } from "./storage.js";
import { MESES_CORTOS, colorPorTexto, truncar, escapeHTML } from "./utils.js";

let chartPrestamos = null;
let chartCategorias = null;

function obtenerColorVariable(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

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

function renderGraficoPrestamos() {
  const prestamos = repoPrestamos.obtenerTodos();
  const meses = ultimosMeses(6);

  const conteos = meses.map(({ clave }) =>
    prestamos.filter((p) => p.fechaPrestamo.startsWith(clave)).length
  );

  const ctx = document.getElementById("grafico-prestamos");
  if (!ctx || typeof Chart === "undefined") return;

  if (chartPrestamos) chartPrestamos.destroy();
  chartPrestamos = new Chart(ctx, {
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

function renderGraficoCategorias() {
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
  const ctx = document.getElementById("grafico-categorias");
  const leyenda = document.querySelector("[data-leyenda-categorias]");

  if (entradas.length === 0) {
    leyenda.innerHTML = `<p class="muted">Aún no hay préstamos registrados.</p>`;
    return;
  }

  const colores = entradas.map(([categoria]) => colorPorTexto(categoria));

  if (ctx && typeof Chart !== "undefined") {
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: entradas.map(([categoria]) => categoria),
        datasets: [{ data: entradas.map(([, conteo]) => conteo), backgroundColor: colores, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: "68%",
      },
    });
  }

  leyenda.innerHTML = entradas
    .map(
      ([categoria, conteo], i) => `
      <div class="donut-legend__item">
        <span class="donut-legend__swatch" style="background:${colores[i]}"></span>
        <span>${categoria}</span>
        <strong>${conteo}</strong>
      </div>`
    )
    .join("");
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
    .map(
      (item, i) => `
      <div class="ranking-item">
        <span class="ranking-item__rank">${i + 1}</span>
        <div class="ranking-item__body">
          <div class="ranking-item__title">${escapeHTML(truncar(item.libro.titulo, 34))}</div>
          <div class="ranking-item__sub">${escapeHTML(item.libro.autor)}</div>
        </div>
        <span class="ranking-item__count">${item.total} ${item.total === 1 ? "préstamo" : "préstamos"}</span>
      </div>`
    )
    .join("");
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

function renderGraficos() {
  renderGraficoPrestamos();
  renderGraficoCategorias();
}

function iniciar() {
  renderStats();
  renderGraficos();
  renderRankingLibros();
  renderRankingUsuarios();

  // Observar cambios de tema para redibujar gráficos con colores actualizados.
  const observer = new MutationObserver(() => {
    // Esperar un frame para que las CSS custom properties se actualicen.
    requestAnimationFrame(() => renderGraficos());
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

document.addEventListener("DOMContentLoaded", iniciar);
