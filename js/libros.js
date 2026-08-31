// ==========================================================================
// BIBLIOTECA — libros.js
// CRUD completo de libros: render de tabla, búsqueda en tiempo real,
// filtros por categoría/estado, orden por columnas, modal de alta/edición,
// confirmación de borrado y exportación a PDF.
// ==========================================================================

import { repoLibros, repoPrestamos, Libro } from "./storage.js";
import { debounce, escapeHTML, colorPorTexto } from "./utils.js";
import { abrirModal, cerrarModal, conectarCierreModal, confirmar, mostrarToast, ICONOS } from "./ui.js";

export const CATEGORIAS = ["Literatura", "Ciencia Ficción", "Tecnología", "Historia", "Ciencia", "Biografía", "Infantil", "Otro"];

const estadoTabla = {
  busqueda: "",
  categoria: "",
  estado: "",
  ordenCampo: "titulo",
  ordenDireccion: 1,
};

let idEnEdicion = null;

/* -------------------------------------------------------------------------
   Validación de ISBN (acepta ISBN-10 o ISBN-13, con o sin guiones)
   ------------------------------------------------------------------------- */
function validarISBN(valor) {
  const limpio = valor.replace(/[-\s]/g, "").toUpperCase();
  return /^\d{9}[\dX]$/.test(limpio) || /^\d{13}$/.test(limpio);
}

/* -------------------------------------------------------------------------
   Render de la tabla
   ------------------------------------------------------------------------- */
function obtenerLibrosFiltrados() {
  const termino = estadoTabla.busqueda.trim().toLowerCase();

  let lista = repoLibros.obtenerTodos().filter((libro) => {
    const coincideTexto =
      !termino ||
      libro.titulo.toLowerCase().includes(termino) ||
      libro.autor.toLowerCase().includes(termino) ||
      libro.isbn.toLowerCase().includes(termino);
    const coincideCategoria = !estadoTabla.categoria || libro.categoria === estadoTabla.categoria;
    const coincideEstado = !estadoTabla.estado || libro.estado === estadoTabla.estado;
    return coincideTexto && coincideCategoria && coincideEstado;
  });

  lista.sort((a, b) => {
    const campo = estadoTabla.ordenCampo;
    const va = a[campo];
    const vb = b[campo];
    const comparacion = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
    return comparacion * estadoTabla.ordenDireccion;
  });

  return lista;
}

function renderTabla() {
  const cuerpo = document.querySelector("[data-libros-cuerpo]");
  const vacio = document.querySelector("[data-libros-vacio]");
  const contador = document.querySelector("[data-libros-contador]");
  const lista = obtenerLibrosFiltrados();

  contador.textContent = `${lista.length} ${lista.length === 1 ? "libro" : "libros"}`;

  if (lista.length === 0) {
    cuerpo.innerHTML = "";
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  cuerpo.innerHTML = lista
    .map((libro) => {
      const color = colorPorTexto(libro.categoria);
      const estadoMarca =
        libro.estado === "prestado"
          ? `<span class="stamp">Prestado</span>`
          : `<span class="badge badge--teal">Disponible</span>`;
      return `
        <tr data-id="${libro.id}">
          <td data-label="Título"><strong>${escapeHTML(libro.titulo)}</strong></td>
          <td data-label="Autor">${escapeHTML(libro.autor)}</td>
          <td data-label="Categoría"><span class="spine-tag" style="--cat-color:${color}">${escapeHTML(libro.categoria)}</span></td>
          <td data-label="ISBN"><span class="code">${escapeHTML(libro.isbn)}</span></td>
          <td data-label="Año">${libro.anio}</td>
          <td data-label="Estado">${estadoMarca}</td>
          <td data-label="Acciones" class="col-actions">
            <span class="row-actions">
              <button class="btn btn--ghost btn--icon btn--sm" data-accion="editar" aria-label="Editar ${escapeHTML(libro.titulo)}">${ICONOS.editar}</button>
              <button class="btn btn--ghost btn--icon btn--sm" data-accion="eliminar" aria-label="Eliminar ${escapeHTML(libro.titulo)}">${ICONOS.eliminar}</button>
            </span>
          </td>
        </tr>`;
    })
    .join("");
}

/* -------------------------------------------------------------------------
   Formulario (alta / edición)
   ------------------------------------------------------------------------- */
function poblarSelectCategorias() {
  const select = document.querySelector("#campo-categoria");
  select.innerHTML = CATEGORIAS.map((cat) => `<option value="${cat}">${cat}</option>`).join("");
}

function limpiarErrores(form) {
  form.querySelectorAll(".field").forEach((campo) => campo.classList.remove("has-error"));
}

function marcarError(campoId) {
  document.querySelector(`#${campoId}`).closest(".field").classList.add("has-error");
}

function validarFormulario(datos) {
  limpiarErrores(document.querySelector("#form-libro"));
  let valido = true;

  if (!datos.titulo.trim()) { marcarError("campo-titulo"); valido = false; }
  if (!datos.autor.trim()) { marcarError("campo-autor"); valido = false; }
  if (!datos.categoria) { marcarError("campo-categoria"); valido = false; }

  if (!validarISBN(datos.isbn)) { marcarError("campo-isbn"); valido = false; }

  const anioNum = Number(datos.anio);
  const anioActual = new Date().getFullYear();
  if (!datos.anio || Number.isNaN(anioNum) || anioNum < 1450 || anioNum > anioActual) {
    marcarError("campo-anio");
    valido = false;
  }

  // ISBN duplicado (ignorando el propio libro en edición)
  const duplicado = repoLibros
    .obtenerTodos()
    .some((l) => l.isbn.replace(/[-\s]/g, "") === datos.isbn.replace(/[-\s]/g, "") && l.id !== idEnEdicion);
  if (duplicado) { marcarError("campo-isbn"); valido = false; }

  return valido;
}

function abrirFormulario(libro = null) {
  const overlay = document.getElementById("modal-libro");
  const form = document.getElementById("form-libro");
  form.reset();
  limpiarErrores(form);
  idEnEdicion = libro?.id ?? null;

  document.querySelector("#modal-libro-titulo").textContent = libro ? "Editar libro" : "Agregar libro";
  document.querySelector("#modal-libro-submit").textContent = libro ? "Guardar cambios" : "Agregar libro";

  if (libro) {
    form.titulo.value = libro.titulo;
    form.autor.value = libro.autor;
    form.categoria.value = libro.categoria;
    form.isbn.value = libro.isbn;
    form.anio.value = libro.anio;
  }

  abrirModal(overlay);
}

function manejarEnvioFormulario(evento) {
  evento.preventDefault();
  const form = evento.target;
  const datos = {
    titulo: form.titulo.value,
    autor: form.autor.value,
    categoria: form.categoria.value,
    isbn: form.isbn.value,
    anio: form.anio.value,
  };

  if (!validarFormulario(datos)) return;

  if (idEnEdicion) {
    repoLibros.actualizar(idEnEdicion, datos);
    mostrarToast("Libro actualizado correctamente.");
  } else {
    const libro = new Libro({ ...datos, estado: "disponible" });
    repoLibros.agregar(libro);
    mostrarToast("Libro agregado a la colección.");
  }

  cerrarModal(document.getElementById("modal-libro"));
  renderTabla();
}

/* -------------------------------------------------------------------------
   Eliminar
   ------------------------------------------------------------------------- */
async function manejarEliminar(id) {
  const libro = repoLibros.obtenerPorId(id);
  if (!libro) return;

  if (libro.estado === "prestado") {
    mostrarToast("No se puede eliminar: el libro tiene un préstamo activo.", "error");
    return;
  }

  const tieneHistorial = repoPrestamos.obtenerTodos().some((p) => p.libroId === id);
  const ok = await confirmar({
    titulo: "Eliminar libro",
    mensaje: tieneHistorial
      ? `"${libro.titulo}" tiene historial de préstamos, pero se eliminará igualmente. Esta acción no se puede deshacer.`
      : `¿Eliminar "${libro.titulo}" de la colección? Esta acción no se puede deshacer.`,
    textoConfirmar: "Eliminar",
  });
  if (!ok) return;

  repoLibros.eliminar(id);
  // Limpiar préstamos históricos asociados para evitar datos huérfanos.
  const prestamosAsociados = repoPrestamos.obtenerTodos().filter((p) => p.libroId === id);
  prestamosAsociados.forEach((p) => repoPrestamos.eliminar(p.id));
  mostrarToast("Libro eliminado.", "warning");
  renderTabla();
}

/* -------------------------------------------------------------------------
   Exportar a PDF
   ------------------------------------------------------------------------- */
function exportarPDF() {
  if (typeof window.jspdf === "undefined") {
    mostrarToast("No se pudo cargar el generador de PDF.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const lista = obtenerLibrosFiltrados();

  doc.setFontSize(16);
  doc.text("Biblioteca — Catálogo de libros", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-CL")} · ${lista.length} libros`, 14, 24);

  let y = 36;
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(154, 43, 59);
  doc.rect(14, y - 5, 182, 7, "F");
  doc.text("Título", 16, y);
  doc.text("Autor", 80, y);
  doc.text("Categoría", 130, y);
  doc.text("Estado", 168, y);
  y += 8;

  doc.setTextColor(30, 30, 30);
  lista.forEach((libro) => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(libro.titulo.slice(0, 32), 16, y);
    doc.text(libro.autor.slice(0, 26), 80, y);
    doc.text(libro.categoria.slice(0, 18), 130, y);
    doc.text(libro.estado === "prestado" ? "Prestado" : "Disponible", 168, y);
    y += 7;
  });

  doc.save("catalogo-libros.pdf");
  mostrarToast("PDF generado correctamente.");
}

/* -------------------------------------------------------------------------
   Inicialización
   ------------------------------------------------------------------------- */
function iniciar() {
  poblarSelectCategorias();
  document.querySelector("#filtro-categoria").innerHTML =
    `<option value="">Todas las categorías</option>` + CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join("");

  renderTabla();

  document.querySelector("[data-libros-buscar]").addEventListener(
    "input",
    debounce((e) => { estadoTabla.busqueda = e.target.value; renderTabla(); }, 200)
  );

  document.querySelector("#filtro-categoria").addEventListener("change", (e) => {
    estadoTabla.categoria = e.target.value;
    renderTabla();
  });

  document.querySelector("#filtro-estado").addEventListener("change", (e) => {
    estadoTabla.estado = e.target.value;
    renderTabla();
  });

  document.querySelectorAll("[data-ordenar]").forEach((th) => {
    th.addEventListener("click", () => {
      const campo = th.dataset.ordenar;
      if (estadoTabla.ordenCampo === campo) {
        estadoTabla.ordenDireccion *= -1;
      } else {
        estadoTabla.ordenCampo = campo;
        estadoTabla.ordenDireccion = 1;
      }
      document.querySelectorAll("[data-ordenar]").forEach((h) => h.removeAttribute("data-orden-activo"));
      th.setAttribute("data-orden-activo", estadoTabla.ordenDireccion === 1 ? "asc" : "desc");
      renderTabla();
    });
  });

  document.querySelector("[data-abrir-modal-libro]").addEventListener("click", () => abrirFormulario());
  document.querySelector("#form-libro").addEventListener("submit", manejarEnvioFormulario);
  conectarCierreModal(document.getElementById("modal-libro"));

  document.querySelector("[data-libros-cuerpo]").addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;
    const id = boton.closest("tr").dataset.id;
    if (boton.dataset.accion === "editar") abrirFormulario(repoLibros.obtenerPorId(id));
    if (boton.dataset.accion === "eliminar") manejarEliminar(id);
  });

  document.querySelector("[data-exportar-pdf]")?.addEventListener("click", exportarPDF);
}

document.addEventListener("DOMContentLoaded", iniciar);
