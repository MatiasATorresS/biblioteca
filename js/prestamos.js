// ==========================================================================
// BIBLIOTECA — prestamos.js
// Flujo de préstamos: seleccionar usuario y libro disponible, registrar
// el préstamo, registrar la devolución y mostrar el historial completo
// con búsqueda, filtros y exportación a PDF.
// ==========================================================================

import { repoLibros, repoUsuarios, repoPrestamos, Prestamo } from "./storage.js";
import { debounce, escapeHTML, formatearFecha, hoyISO, sumarDiasISO, diferenciaDias } from "./utils.js";
import { abrirModal, cerrarModal, conectarCierreModal, confirmar, mostrarToast, ICONOS } from "./ui.js";

const estadoTabla = { busqueda: "", estado: "" };

/* -------------------------------------------------------------------------
   Helpers de datos cruzados
   ------------------------------------------------------------------------- */
function mapaLibros() {
  return new Map(repoLibros.obtenerTodos().map((l) => [l.id, l]));
}
function mapaUsuarios() {
  return new Map(repoUsuarios.obtenerTodos().map((u) => [u.id, u]));
}

function obtenerPrestamosEnriquecidos() {
  const libros = mapaLibros();
  const usuarios = mapaUsuarios();
  return repoPrestamos
    .obtenerTodos()
    .map((p) => ({ ...p, libro: libros.get(p.libroId), usuario: usuarios.get(p.usuarioId) }))
    .filter((p) => p.libro && p.usuario)
    .sort((a, b) => (a.fechaPrestamo < b.fechaPrestamo ? 1 : -1));
}

function obtenerFiltrados() {
  const termino = estadoTabla.busqueda.trim().toLowerCase();
  return obtenerPrestamosEnriquecidos().filter((p) => {
    const coincideTexto =
      !termino ||
      p.libro.titulo.toLowerCase().includes(termino) ||
      p.usuario.nombre.toLowerCase().includes(termino);
    const coincideEstado = !estadoTabla.estado || p.estado === estadoTabla.estado;
    return coincideTexto && coincideEstado;
  });
}

/* -------------------------------------------------------------------------
   Render del historial
   ------------------------------------------------------------------------- */
function renderTabla() {
  const cuerpo = document.querySelector("[data-prestamos-cuerpo]");
  const vacio = document.querySelector("[data-prestamos-vacio]");
  const contador = document.querySelector("[data-prestamos-contador]");
  const lista = obtenerFiltrados();

  contador.textContent = `${lista.length} ${lista.length === 1 ? "registro" : "registros"}`;

  if (lista.length === 0) {
    cuerpo.innerHTML = "";
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  const hoy = hoyISO();

  cuerpo.innerHTML = lista
    .map((p) => {
      const atrasado = p.estado === "activo" && diferenciaDias(p.fechaDevolucionEstimada, hoy) > 0;
      let estadoHTML;
      if (p.estado === "devuelto") {
        estadoHTML = `<span class="badge badge--teal">Devuelto</span>`;
      } else if (atrasado) {
        estadoHTML = `<span class="badge badge--danger">Atrasado</span>`;
      } else {
        estadoHTML = `<span class="stamp">En préstamo</span>`;
      }

      return `
      <tr data-id="${p.id}">
        <td data-label="Libro"><strong>${escapeHTML(p.libro.titulo)}</strong></td>
        <td data-label="Usuario">${escapeHTML(p.usuario.nombre)}</td>
        <td data-label="Préstamo">${formatearFecha(p.fechaPrestamo)}</td>
        <td data-label="Devolución estimada">${formatearFecha(p.fechaDevolucionEstimada)}</td>
        <td data-label="Devolución real">${p.fechaDevolucionReal ? formatearFecha(p.fechaDevolucionReal) : "—"}</td>
        <td data-label="Estado">${estadoHTML}</td>
        <td data-label="Acciones" class="col-actions">
          ${
            p.estado === "activo"
              ? `<button class="btn btn--secondary btn--sm" data-accion="devolver">${ICONOS.devolver}Devolver</button>`
              : `<span class="muted">—</span>`
          }
        </td>
      </tr>`;
    })
    .join("");
}

/* -------------------------------------------------------------------------
   Modal: registrar préstamo
   ------------------------------------------------------------------------- */
function poblarSelects() {
  const selectUsuario = document.querySelector("#campo-usuario");
  const selectLibro = document.querySelector("#campo-libro");

  const usuarios = repoUsuarios.obtenerTodos().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const disponibles = repoLibros
    .obtenerTodos()
    .filter((l) => l.estado === "disponible")
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));

  selectUsuario.innerHTML =
    `<option value="">Selecciona un usuario…</option>` +
    usuarios.map((u) => `<option value="${u.id}">${escapeHTML(u.nombre)} — ${escapeHTML(u.documento)}</option>`).join("");

  selectLibro.innerHTML =
    `<option value="">Selecciona un libro disponible…</option>` +
    disponibles.map((l) => `<option value="${l.id}">${escapeHTML(l.titulo)} — ${escapeHTML(l.autor)}</option>`).join("");

  if (disponibles.length === 0) {
    selectLibro.innerHTML = `<option value="">No hay libros disponibles</option>`;
  }

  document.querySelector("#campo-fecha-devolucion").value = sumarDiasISO(hoyISO(), 14);
}

function limpiarErrores(form) {
  form.querySelectorAll(".field").forEach((campo) => campo.classList.remove("has-error"));
}
function marcarError(campoId) {
  document.querySelector(`#${campoId}`).closest(".field").classList.add("has-error");
}

function abrirFormularioPrestamo() {
  const overlay = document.getElementById("modal-prestamo");
  const form = document.getElementById("form-prestamo");
  form.reset();
  limpiarErrores(form);
  poblarSelects();
  abrirModal(overlay);
}

function manejarEnvioPrestamo(evento) {
  evento.preventDefault();
  const form = evento.target;
  limpiarErrores(form);

  const usuarioId = form.usuario.value;
  const libroId = form.libro.value;
  const fechaDevolucionEstimada = form.fechaDevolucion.value;
  let valido = true;

  if (!usuarioId) { marcarError("campo-usuario"); valido = false; }
  if (!libroId) { marcarError("campo-libro"); valido = false; }
  if (!fechaDevolucionEstimada) { marcarError("campo-fecha-devolucion"); valido = false; }
  if (!valido) return;

  const libro = repoLibros.obtenerPorId(libroId);
  if (!libro || libro.estado !== "disponible") {
    mostrarToast("Ese libro ya no está disponible.", "error");
    poblarSelects();
    return;
  }

  const prestamo = new Prestamo({
    libroId,
    usuarioId,
    fechaPrestamo: hoyISO(),
    fechaDevolucionEstimada,
  });
  repoPrestamos.agregar(prestamo);
  repoLibros.actualizar(libroId, { estado: "prestado" });

  mostrarToast("Préstamo registrado correctamente.");
  cerrarModal(document.getElementById("modal-prestamo"));
  renderTabla();
}

/* -------------------------------------------------------------------------
   Registrar devolución
   ------------------------------------------------------------------------- */
async function manejarDevolucion(id) {
  const prestamo = repoPrestamos.obtenerPorId(id);
  if (!prestamo) return;
  const libro = repoLibros.obtenerPorId(prestamo.libroId);

  const ok = await confirmar({
    titulo: "Registrar devolución",
    mensaje: `¿Confirmar la devolución de "${libro?.titulo ?? "este libro"}"?`,
    textoConfirmar: "Registrar devolución",
    variante: "primary",
  });
  if (!ok) return;

  repoPrestamos.actualizar(id, { estado: "devuelto", fechaDevolucionReal: hoyISO() });
  if (libro) repoLibros.actualizar(libro.id, { estado: "disponible" });

  mostrarToast("Devolución registrada.");
  renderTabla();
}

/* -------------------------------------------------------------------------
   Exportar historial a PDF
   ------------------------------------------------------------------------- */
function exportarPDF() {
  if (typeof window.jspdf === "undefined") {
    mostrarToast("No se pudo cargar el generador de PDF.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const lista = obtenerFiltrados();

  doc.setFontSize(16);
  doc.text("Biblioteca — Historial de préstamos", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-CL")} · ${lista.length} registros`, 14, 24);

  let y = 36;
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(154, 43, 59);
  doc.rect(14, y - 5, 182, 7, "F");
  doc.text("Libro", 16, y);
  doc.text("Usuario", 78, y);
  doc.text("Préstamo", 128, y);
  doc.text("Estado", 168, y);
  y += 8;

  doc.setTextColor(30, 30, 30);
  lista.forEach((p) => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(p.libro.titulo.slice(0, 28), 16, y);
    doc.text(p.usuario.nombre.slice(0, 22), 78, y);
    doc.text(formatearFecha(p.fechaPrestamo), 128, y);
    doc.text(p.estado === "devuelto" ? "Devuelto" : "Activo", 168, y);
    y += 7;
  });

  doc.save("historial-prestamos.pdf");
  mostrarToast("PDF generado correctamente.");
}

/* -------------------------------------------------------------------------
   Inicialización
   ------------------------------------------------------------------------- */
function iniciar() {
  renderTabla();

  document.querySelector("[data-prestamos-buscar]").addEventListener(
    "input",
    debounce((e) => { estadoTabla.busqueda = e.target.value; renderTabla(); }, 200)
  );

  document.querySelector("#filtro-estado-prestamo").addEventListener("change", (e) => {
    estadoTabla.estado = e.target.value;
    renderTabla();
  });

  document.querySelector("[data-abrir-modal-prestamo]").addEventListener("click", abrirFormularioPrestamo);
  document.querySelector("#form-prestamo").addEventListener("submit", manejarEnvioPrestamo);
  conectarCierreModal(document.getElementById("modal-prestamo"));

  document.querySelector("[data-prestamos-cuerpo]").addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-accion='devolver']");
    if (!boton) return;
    const id = boton.closest("tr").dataset.id;
    manejarDevolucion(id);
  });

  document.querySelector("[data-exportar-pdf]")?.addEventListener("click", exportarPDF);
}

document.addEventListener("DOMContentLoaded", iniciar);
