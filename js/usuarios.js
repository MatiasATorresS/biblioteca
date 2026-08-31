// ==========================================================================
// BIBLIOTECA — usuarios.js
// CRUD de usuarios registrados: validación de RUT/documento, correo y
// teléfono, búsqueda en tiempo real y bloqueo de borrado si el usuario
// tiene un préstamo activo.
// ==========================================================================

import { repoUsuarios, repoPrestamos, repoLibros, Usuario } from "./storage.js";
import { debounce, escapeHTML, validarCorreo, validarTelefono, validarDocumento, formatearDocumento, formatearFecha } from "./utils.js";
import { abrirModal, cerrarModal, conectarCierreModal, confirmar, mostrarToast, ICONOS } from "./ui.js";

let busquedaActual = "";
let idEnEdicion = null;

function obtenerUsuariosFiltrados() {
  const termino = busquedaActual.trim().toLowerCase();
  let lista = repoUsuarios.obtenerTodos();
  if (termino) {
    lista = lista.filter(
      (u) =>
        u.nombre.toLowerCase().includes(termino) ||
        u.documento.toLowerCase().includes(termino) ||
        u.correo.toLowerCase().includes(termino)
    );
  }
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function contarPrestamosActivos(usuarioId) {
  return repoPrestamos.obtenerTodos().filter((p) => p.usuarioId === usuarioId && p.estado === "activo").length;
}

function renderTabla() {
  const cuerpo = document.querySelector("[data-usuarios-cuerpo]");
  const vacio = document.querySelector("[data-usuarios-vacio]");
  const contador = document.querySelector("[data-usuarios-contador]");
  const lista = obtenerUsuariosFiltrados();

  contador.textContent = `${lista.length} ${lista.length === 1 ? "usuario" : "usuarios"}`;

  if (lista.length === 0) {
    cuerpo.innerHTML = "";
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  cuerpo.innerHTML = lista
    .map((usuario) => {
      const activos = contarPrestamosActivos(usuario.id);
      return `
      <tr data-id="${usuario.id}">
        <td data-label="Nombre"><strong>${escapeHTML(usuario.nombre)}</strong></td>
        <td data-label="Documento"><span class="code">${escapeHTML(usuario.documento)}</span></td>
        <td data-label="Correo">${escapeHTML(usuario.correo)}</td>
        <td data-label="Teléfono">${escapeHTML(usuario.telefono)}</td>
        <td data-label="Registrado">${formatearFecha(usuario.fechaRegistro)}</td>
        <td data-label="Préstamos activos">${
          activos > 0 ? `<span class="badge badge--amber">${activos}</span>` : `<span class="badge badge--neutral">0</span>`
        }</td>
        <td data-label="Acciones" class="col-actions">
          <span class="row-actions">
            <button class="btn btn--ghost btn--icon btn--sm" data-accion="editar" aria-label="Editar ${escapeHTML(usuario.nombre)}">${ICONOS.editar}</button>
            <button class="btn btn--ghost btn--icon btn--sm" data-accion="eliminar" aria-label="Eliminar ${escapeHTML(usuario.nombre)}">${ICONOS.eliminar}</button>
          </span>
        </td>
      </tr>`;
    })
    .join("");
}

function limpiarErrores(form) {
  form.querySelectorAll(".field").forEach((campo) => campo.classList.remove("has-error"));
}
function marcarError(campoId) {
  document.querySelector(`#${campoId}`).closest(".field").classList.add("has-error");
}

function validarFormulario(datos) {
  limpiarErrores(document.querySelector("#form-usuario"));
  let valido = true;

  if (!datos.nombre.trim() || datos.nombre.trim().length < 3) { marcarError("campo-nombre"); valido = false; }
  if (!validarDocumento(datos.documento)) { marcarError("campo-documento"); valido = false; }
  if (!validarCorreo(datos.correo)) { marcarError("campo-correo"); valido = false; }
  if (!validarTelefono(datos.telefono)) { marcarError("campo-telefono"); valido = false; }

  const docLimpio = datos.documento.replace(/[.\s]/g, "").toUpperCase();
  const duplicado = repoUsuarios
    .obtenerTodos()
    .some((u) => u.documento.replace(/[.\s]/g, "").toUpperCase() === docLimpio && u.id !== idEnEdicion);
  if (duplicado) { marcarError("campo-documento"); valido = false; }

  return valido;
}

function abrirFormulario(usuario = null) {
  const overlay = document.getElementById("modal-usuario");
  const form = document.getElementById("form-usuario");
  form.reset();
  limpiarErrores(form);
  idEnEdicion = usuario?.id ?? null;

  document.querySelector("#modal-usuario-titulo").textContent = usuario ? "Editar usuario" : "Registrar usuario";
  document.querySelector("#modal-usuario-submit").textContent = usuario ? "Guardar cambios" : "Registrar usuario";

  if (usuario) {
    form.nombre.value = usuario.nombre;
    form.documento.value = usuario.documento;
    form.correo.value = usuario.correo;
    form.telefono.value = usuario.telefono;
  }

  abrirModal(overlay);
}

function manejarEnvioFormulario(evento) {
  evento.preventDefault();
  const form = evento.target;
  const datos = {
    nombre: form.nombre.value,
    documento: formatearDocumento(form.documento.value),
    correo: form.correo.value.trim(),
    telefono: form.telefono.value.trim(),
  };

  if (!validarFormulario(datos)) return;

  if (idEnEdicion) {
    repoUsuarios.actualizar(idEnEdicion, datos);
    mostrarToast("Usuario actualizado correctamente.");
  } else {
    repoUsuarios.agregar(new Usuario(datos));
    mostrarToast("Usuario registrado correctamente.");
  }

  cerrarModal(document.getElementById("modal-usuario"));
  renderTabla();
}

async function manejarEliminar(id) {
  const usuario = repoUsuarios.obtenerPorId(id);
  if (!usuario) return;

  if (contarPrestamosActivos(id) > 0) {
    mostrarToast("No se puede eliminar: el usuario tiene préstamos activos.", "error");
    return;
  }

  const ok = await confirmar({
    titulo: "Eliminar usuario",
    mensaje: `¿Eliminar a ${usuario.nombre} del registro? Esta acción no se puede deshacer.`,
    textoConfirmar: "Eliminar",
  });
  if (!ok) return;

  repoUsuarios.eliminar(id);
  // Limpiar préstamos históricos asociados para evitar datos huérfanos.
  const prestamosAsociados = repoPrestamos.obtenerTodos().filter((p) => p.usuarioId === id);
  prestamosAsociados.forEach((p) => {
    const libro = repoLibros.obtenerPorId(p.libroId);
    if (libro && libro.estado === "prestado") {
      repoLibros.actualizar(libro.id, { estado: "disponible" });
    }
    repoPrestamos.eliminar(p.id);
  });
  mostrarToast("Usuario eliminado.", "warning");
  renderTabla();
}

function iniciar() {
  renderTabla();

  document.querySelector("[data-usuarios-buscar]").addEventListener(
    "input",
    debounce((e) => { busquedaActual = e.target.value; renderTabla(); }, 200)
  );

  document.querySelector("[data-abrir-modal-usuario]").addEventListener("click", () => abrirFormulario());
  document.querySelector("#form-usuario").addEventListener("submit", manejarEnvioFormulario);
  conectarCierreModal(document.getElementById("modal-usuario"));

  document.querySelector("[data-usuarios-cuerpo]").addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;
    const id = boton.closest("tr").dataset.id;
    if (boton.dataset.accion === "editar") abrirFormulario(repoUsuarios.obtenerPorId(id));
    if (boton.dataset.accion === "eliminar") manejarEliminar(id);
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
