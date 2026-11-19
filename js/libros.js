// ==========================================================================
// BIBLIOTECA — libros.js
// CRUD completo de libros: render de tabla, búsqueda en tiempo real,
// filtros por categoría/estado, orden por columnas, modal de alta/edición,
// confirmación de borrado y exportación a PDF.
// ==========================================================================

import { repoLibros, repoPrestamos, Libro } from "./storage.js";
import {
  debounce,
  escapeHTML,
  colorPorTexto,
  portadaOpenLibrary,
  portadaOpenLibraryId,
  portadaDeLibro,
  esPortadaValida,
  comprimirImagen,
} from "./utils.js";
import {
  abrirModal,
  cerrarModal,
  conectarCierreModal,
  confirmar,
  mostrarToast,
  ICONOS,
  limpiarErrores,
  marcarError,
} from "./ui.js";
import { exportarTablaPDF } from "./pdf.js";

export const CATEGORIAS = ["Literatura", "Ciencia Ficción", "Tecnología", "Historia", "Ciencia", "Biografía", "Infantil", "Otro"];

const estadoTabla = {
  busqueda: "",
  categoria: "",
  estado: "",
  ordenCampo: "titulo",
  ordenDireccion: 1,
};

let idEnEdicion = null;

// Estado de la portada en el formulario.
let portadaActual = "";
let portadaManual = false;
let portadaAutoActual = true;
let buscandoPortada = false;
let busquedaPortadaToken = 0;
const portadasFallidas = new Set();

// Estado del autocompletado de títulos.
let sugerenciasTitulo = [];
let indiceSugerencia = -1;
let controladorSugerencias = null;
let punteroLista = null;

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
      const portada = portadaDeLibro(libro);
      const mostrarPortada = portada && !portadasFallidas.has(portada);
      return `
        <tr data-id="${libro.id}">
          <td data-label="Título">
            <div class="book-cell">
              <span class="book-thumb" style="--cat-color:${color}" aria-hidden="true">
                ${ICONOS.libro}
                ${mostrarPortada ? `<img src="${escapeHTML(portada)}" alt="" width="34" height="51" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-portada="${escapeHTML(portada)}" />` : ""}
              </span>
              <span class="book-cell__text"><strong>${escapeHTML(libro.titulo)}</strong></span>
            </div>
          </td>
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

  // Si una portada remota no existe, se oculta y queda el ícono de respaldo.
  cuerpo.querySelectorAll("img[data-portada]").forEach((imagen) => {
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

/* -------------------------------------------------------------------------
   Formulario (alta / edición)
   ------------------------------------------------------------------------- */
function poblarSelectCategorias() {
  const select = document.querySelector("#campo-categoria");
  select.innerHTML = CATEGORIAS.map((cat) => `<option value="${cat}">${cat}</option>`).join("");
}

/* -------------------------------------------------------------------------
   Portada: búsqueda automática por ISBN, subida optimizada y URL manual
   ------------------------------------------------------------------------- */
function mensajePortada(texto, error = false) {
  const estado = document.querySelector("[data-portada-estado]");
  if (!estado) return;
  estado.textContent = texto;
  estado.classList.toggle("is-error", error);
}

function actualizarPreviewPortada() {
  const preview = document.querySelector("[data-portada-preview]");
  if (!preview) return;
  const imagen = preview.querySelector("img");
  const placeholder = preview.querySelector(".cover-preview__placeholder");
  const quitar = document.querySelector("[data-quitar-portada]");

  if (portadaActual) {
    imagen.hidden = false;
    imagen.src = portadaActual;
    placeholder.hidden = true;
    quitar.hidden = false;
  } else {
    imagen.hidden = true;
    imagen.removeAttribute("src");
    placeholder.hidden = false;
    quitar.hidden = true;
  }
}

function establecerPortada(valor, { manual = false, auto = true, mensaje = "" } = {}) {
  cancelarBusquedaPortada();
  portadaActual = String(valor ?? "").trim();
  portadaManual = manual;
  portadaAutoActual = auto;

  const oculto = document.getElementById("campo-portada");
  if (oculto) oculto.value = portadaActual;

  const url = document.getElementById("campo-portada-url");
  if (url) url.value = portadaActual.startsWith("data:") ? "" : portadaActual;

  actualizarPreviewPortada();
  if (mensaje) mensajePortada(mensaje);
}

function esPortadaAuto(url) {
  return /^https:\/\/covers\.openlibrary\.org\//i.test(url);
}

/** Comprueba si la portada remota existe antes de mostrarla (404 = no existe). */
function probarPortadaRemota(url, tiempoMaximo = 9000) {
  return new Promise((resolve) => {
    const imagen = new Image();
    const limite = setTimeout(() => {
      imagen.src = "";
      resolve(false);
    }, tiempoMaximo);
    imagen.referrerPolicy = "no-referrer";
    imagen.onload = () => {
      clearTimeout(limite);
      resolve(imagen.naturalWidth > 1);
    };
    imagen.onerror = () => {
      clearTimeout(limite);
      resolve(false);
    };
    imagen.src = url;
  });
}

async function buscarPortada({ silencioso = false, forzar = false } = {}) {
  if (buscandoPortada) return;
  const form = document.getElementById("form-libro");
  const isbn = form?.isbn?.value ?? "";

  if (!validarISBN(isbn)) {
    if (!silencioso) {
      mensajePortada("Ingresa un ISBN válido (10 o 13 dígitos) para buscar la portada.", true);
    }
    return;
  }
  if (!forzar && portadaManual && portadaActual) return;

  // Buscar manualmente vuelve a habilitar la portada automática.
  portadaAutoActual = true;
  buscandoPortada = true;
  const token = ++busquedaPortadaToken;
  const boton = document.querySelector("[data-buscar-portada]");
  if (boton) boton.disabled = true;
  mensajePortada("Buscando portada en Open Library…");

  const url = portadaOpenLibrary(isbn);
  const existe = await probarPortadaRemota(url);

  // Otra acción (cerrar, subir imagen, quitar, cambiar ISBN) invalidó la búsqueda.
  if (token !== busquedaPortadaToken) return;

  buscandoPortada = false;
  if (boton) boton.disabled = false;

  // La búsqueda pudo terminar después de cerrar el modal o de elegir otra imagen.
  const modal = document.getElementById("modal-libro");
  if (!modal?.classList.contains("is-open") || (portadaManual && !forzar)) return;

  if (existe) {
    establecerPortada(url, {
      manual: false,
      auto: true,
      mensaje: "Portada encontrada en Open Library.",
    });
  } else if (!silencioso || !portadaActual) {
    mensajePortada("No encontramos portada para este ISBN. Puedes subir una imagen.", true);
  }
}

/** Invalida una búsqueda en curso para que no pise una elección más reciente. */
function cancelarBusquedaPortada() {
  if (!buscandoPortada) return;
  busquedaPortadaToken++;
  buscandoPortada = false;
  const boton = document.querySelector("[data-buscar-portada]");
  if (boton) boton.disabled = false;
}

async function manejarArchivoPortada(evento) {
  const archivo = evento.target.files?.[0];
  evento.target.value = "";
  if (!archivo) return;
  cancelarBusquedaPortada();

  if (archivo.size > 10 * 1024 * 1024) {
    mensajePortada("La imagen supera los 10 MB. Elige una más liviana.", true);
    return;
  }

  mensajePortada("Optimizando imagen…");
  try {
    const dataUrl = await comprimirImagen(archivo);
    if (dataUrl.length > 600000) {
      mensajePortada("La imagen quedó demasiado pesada. Prueba con otra.", true);
      return;
    }
    establecerPortada(dataUrl, {
      manual: true,
      auto: false,
      mensaje: "Portada cargada desde tu equipo (se guarda en este navegador).",
    });
  } catch (error) {
    console.error("No se pudo procesar la portada:", error);
    mensajePortada("No se pudo procesar la imagen. Prueba con otro archivo.", true);
  }
}

function configurarPortada() {
  const form = document.getElementById("form-libro");
  const archivo = document.getElementById("campo-portada-archivo");
  const url = document.getElementById("campo-portada-url");

  document.querySelector("[data-subir-portada]")?.addEventListener("click", () => archivo?.click());
  archivo?.addEventListener("change", manejarArchivoPortada);

  document.querySelector("[data-buscar-portada]")?.addEventListener("click", () => {
    buscarPortada({ forzar: true });
  });

  document.querySelector("[data-quitar-portada]")?.addEventListener("click", () => {
    establecerPortada("", {
      manual: true,
      auto: false,
      mensaje: "Portada eliminada. No se buscará automáticamente.",
    });
  });

  const buscarAuto = debounce(() => {
    if (portadaAutoActual && !portadaManual) buscarPortada({ silencioso: true });
  }, 650);

  form?.isbn?.addEventListener("input", () => {
    if (!portadaAutoActual) return;
    cancelarBusquedaPortada();
    if (!portadaManual && portadaActual) {
      establecerPortada("");
      mensajePortada("Ingresa un ISBN válido para buscar la portada.");
    }
    if (validarISBN(form.isbn.value)) buscarAuto();
  });

  const procesarUrl = () => {
    const valor = url?.value.trim() ?? "";
    if (!valor) {
      if (portadaActual && !portadaActual.startsWith("data:")) {
        establecerPortada("", { manual: true, auto: false });
        mensajePortada("");
      }
      return;
    }
    if (!esPortadaValida(valor)) {
      mensajePortada("Usa una URL http(s) o una ruta como assets/images/portada.jpg.", true);
      return;
    }
    establecerPortada(valor, { manual: true, auto: false });
    mensajePortada("Portada actualizada desde la URL.");
  };
  const aplicarUrl = debounce(procesarUrl, 600);
  url?.addEventListener("input", aplicarUrl);
  url?.addEventListener("change", procesarUrl);

  // Si la vista previa no carga, se muestra el ícono en su lugar.
  const imagen = document.querySelector("[data-portada-preview] img");
  const placeholder = document.querySelector(".cover-preview__placeholder");
  imagen?.addEventListener("error", () => {
    if (!portadaActual) return;
    imagen.hidden = true;
    placeholder.hidden = false;
    mensajePortada("No se pudo cargar la portada. Revisa la URL.", true);
  });
}

/* -------------------------------------------------------------------------
   Autocompletado del título con Open Library
   ------------------------------------------------------------------------- */
const REGLAS_CATEGORIA = [
  [
    "Biografía",
    ["biography", "biographical", "autobiography", "memoir", "memoirs", "diaries", "biografia", "biografias"],
  ],
  [
    "Infantil",
    [
      "juvenile",
      "children",
      "picture book",
      "picture books",
      "young adult",
      "fairy tale",
      "fairy tales",
      "infantil",
      "juvenil",
    ],
  ],
  [
    "Ciencia Ficción",
    ["science fiction", "sci-fi", "sci fi", "space opera", "dystopia", "dystopian", "ciencia ficcion"],
  ],
  ["Historia", ["history", "histories", "war", "wars", "historia", "historias"]],
  [
    "Tecnología",
    [
      "computer",
      "computers",
      "computing",
      "programming",
      "software",
      "internet",
      "engineering",
      "informatica",
      "tecnologia",
      "artificial intelligence",
    ],
  ],
  [
    "Ciencia",
    [
      "science",
      "sciences",
      "physics",
      "mathematics",
      "biology",
      "chemistry",
      "astronomy",
      "medicine",
      "evolution",
      "natural selection",
      "genetics",
      "ciencia",
      "ciencias",
      "matematica",
      "fisica",
      "evolucion",
      "seleccion natural",
    ],
  ],
  [
    "Literatura",
    [
      "fiction",
      "fictions",
      "novel",
      "novels",
      "literature",
      "poetry",
      "short stories",
      "drama",
      "fantasy",
      "fantasia",
      "literatura",
      "novela",
      "novelas",
      "poesia",
    ],
  ],
];

function normalizarTexto(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mensajeSugerencias(texto, error = false) {
  const estado = document.getElementById("sugerencias-titulo-estado");
  if (!estado) return;
  estado.textContent = texto;
  estado.classList.toggle("is-error", error);
}

function cerrarSugerencias({ limpiar = false } = {}) {
  const lista = document.getElementById("sugerencias-titulo");
  const input = document.getElementById("campo-titulo");
  if (lista) {
    lista.hidden = true;
    lista.classList.remove("autocomplete__list--arriba");
    lista.style.maxHeight = "";
  }
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  indiceSugerencia = -1;
  punteroLista = null;
  if (limpiar) {
    sugerenciasTitulo = [];
    if (lista) lista.innerHTML = "";
  }
}

function posicionarSugerencias() {
  const lista = document.getElementById("sugerencias-titulo");
  const contenedor = lista?.closest(".autocomplete");
  const input = document.getElementById("campo-titulo");
  if (!lista || !contenedor || !input || lista.hidden) return;

  lista.classList.remove("autocomplete__list--arriba");
  lista.style.maxHeight = "";

  const alturaLista = Math.min(lista.scrollHeight, 230);
  const rectContenedor = contenedor.getBoundingClientRect();
  const espacioAbajo = window.innerHeight - rectContenedor.bottom - 12;
  const espacioArriba = rectContenedor.top - 12;
  const haciaArriba = espacioAbajo < alturaLista && espacioArriba > espacioAbajo;

  if (haciaArriba) lista.classList.add("autocomplete__list--arriba");
  const disponible = haciaArriba ? espacioArriba : espacioAbajo;
  lista.style.maxHeight = `${Math.max(96, Math.min(230, disponible))}px`;

  // Si la lista quedó abierta, mantiene visible la opción activa.
  if (indiceSugerencia >= 0) {
    const activo = lista.querySelector(".autocomplete__item.is-active");
    activo?.scrollIntoView({ block: "nearest" });
  }
}

function reiniciarSugerencias() {
  controladorSugerencias?.abort();
  controladorSugerencias = null;
  cerrarSugerencias({ limpiar: true });
  mensajeSugerencias("");
}

function resaltarSugerencia(indice) {
  const lista = document.getElementById("sugerencias-titulo");
  const input = document.getElementById("campo-titulo");
  if (!lista || !input) return;
  const items = [...lista.querySelectorAll(".autocomplete__item")];
  if (items.length === 0) return;

  indiceSugerencia = ((indice % items.length) + items.length) % items.length;
  items.forEach((item, i) => {
    const activo = i === indiceSugerencia;
    item.classList.toggle("is-active", activo);
    item.setAttribute("aria-selected", activo ? "true" : "false");
  });
  input.setAttribute("aria-activedescendant", items[indiceSugerencia].id);
  items[indiceSugerencia].scrollIntoView({ block: "nearest" });
}

function moverSugerencia(delta) {
  if (sugerenciasTitulo.length === 0) return;
  const base = indiceSugerencia < 0 ? (delta > 0 ? -1 : 0) : indiceSugerencia;
  resaltarSugerencia(base + delta);
}

function autoresDeDoc(doc) {
  if (Array.isArray(doc?.author_name)) return doc.author_name.filter(Boolean).map(String);
  return doc?.author_name ? [String(doc.author_name)] : [];
}

function elegirIsbnOpenLibrary(doc) {
  const isbns = Array.isArray(doc?.isbn) ? doc.isbn : doc?.isbn ? [doc.isbn] : [];
  const validos = isbns.map((valor) => String(valor).replace(/[-\s]/g, "")).filter((valor) => validarISBN(valor));
  return validos.find((valor) => valor.length === 13) ?? validos[0] ?? "";
}

function categoriaDesdeSujetos(sujetos) {
  const lista = (Array.isArray(sujetos) ? sujetos : sujetos ? [sujetos] : [])
    .map((sujeto) => normalizarTexto(sujeto))
    .filter(Boolean);
  if (lista.length === 0) return "Otro";

  let mejor = "Otro";
  let mejorPuntaje = 0;
  for (const [categoria, claves] of REGLAS_CATEGORIA) {
    const puntaje = lista.reduce(
      (total, sujeto) => total + (claves.some((clave) => coincideClave(sujeto, clave)) ? 1 : 0),
      0
    );
    if (puntaje > mejorPuntaje) {
      mejor = categoria;
      mejorPuntaje = puntaje;
    }
  }
  return mejor;
}

function coincideClave(texto, clave) {
  const escapada = normalizarTexto(clave).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapada}\\b`).test(texto);
}

function renderSugerencias(docs) {
  const lista = document.getElementById("sugerencias-titulo");
  const input = document.getElementById("campo-titulo");
  if (!lista || !input) return;

  sugerenciasTitulo = docs;
  if (docs.length === 0) {
    cerrarSugerencias({ limpiar: true });
    mensajeSugerencias("Sin coincidencias. Prueba con menos palabras o completa los datos a mano.");
    return;
  }

  lista.innerHTML = docs
    .map((doc, i) => {
      const autores = autoresDeDoc(doc);
      const meta = [autores.slice(0, 2).join(", "), doc.first_publish_year].filter(Boolean).join(" · ");
      return `
        <li role="option" id="sugerencia-titulo-${i}" class="autocomplete__item" data-indice="${i}" aria-selected="false">
          <span class="autocomplete__item-title">${escapeHTML(doc.title)}</span>
          <span class="autocomplete__item-meta">${escapeHTML(meta || "Open Library")}</span>
        </li>`;
    })
    .join("");

  lista.hidden = false;
  input.setAttribute("aria-expanded", "true");
  indiceSugerencia = -1;
  posicionarSugerencias();
  mensajeSugerencias(
    `${docs.length} ${docs.length === 1 ? "coincidencia" : "coincidencias"}. Elige una o usa ↑ ↓ y Enter.`
  );
}

function aplicarSugerencia(doc) {
  const form = document.getElementById("form-libro");
  if (!form || !doc) return;

  const titulo = String(doc.title ?? "").trim();
  if (!titulo) return;

  const autores = autoresDeDoc(doc);
  const isbn = elegirIsbnOpenLibrary(doc);
  const anio = Number(doc.first_publish_year);
  const anioActual = new Date().getFullYear();

  form.titulo.value = titulo;
  form.autor.value = autores.slice(0, 3).join(", ");
  form.isbn.value = isbn;
  form.anio.value = Number.isFinite(anio) && anio >= 1450 && anio <= anioActual ? String(anio) : "";
  form.categoria.value = doc.categoriaSugerida ?? categoriaDesdeSujetos(doc.subject);
  limpiarErrores(form);

  // Si el usuario subió o pegó una portada propia, se respeta.
  if (!(portadaManual && portadaActual)) {
    const portada = doc.cover_i ? portadaOpenLibraryId(doc.cover_i) : "";
    if (portada) {
      establecerPortada(portada, {
        manual: false,
        auto: true,
        mensaje: "Portada encontrada en Open Library.",
      });
    } else {
      establecerPortada("", { manual: false, auto: true });
      if (isbn) buscarPortada({ silencioso: true });
    }
  }

  cerrarSugerencias({ limpiar: true });
  mensajeSugerencias("Datos completados desde Open Library. Revísalos antes de guardar.");
}

function seleccionarSugerencia(indice) {
  const doc = sugerenciasTitulo[indice];
  if (!doc) return;
  aplicarSugerencia(doc);
}

async function consultarOpenLibrary(url, signal) {
  let respuesta = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (respuesta.status === 429 || respuesta.status === 503) {
    mensajeSugerencias("Open Library está tardando; reintentando…");
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (signal.aborted) throw new DOMException("Búsqueda cancelada", "AbortError");
    respuesta = await fetch(url, { signal, headers: { Accept: "application/json" } });
  }
  return respuesta;
}

async function buscarCoincidenciasTitulo(consulta) {
  controladorSugerencias?.abort();
  const controlador = new AbortController();
  controladorSugerencias = controlador;
  mensajeSugerencias("Buscando coincidencias en Open Library…");

  const parametros = new URLSearchParams({
    title: consulta,
    limit: "8",
    fields: "key,title,author_name,first_publish_year,isbn,subject,cover_i",
  });

  try {
    const respuesta = await consultarOpenLibrary(
      `https://openlibrary.org/search.json?${parametros.toString()}`,
      controlador.signal
    );
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    if (controlador.signal.aborted) return;

    const input = document.getElementById("campo-titulo");
    const modalAbierto = document.getElementById("modal-libro")?.classList.contains("is-open");
    if (!modalAbierto || !input || input.value.trim() !== consulta) return;

    const recibidos = (Array.isArray(datos.docs) ? datos.docs : []).filter((doc) => doc && doc.title);

    // Algunas ediciones no traen `subject`; se aprovechan los temas de otras
    // ediciones de la misma obra para sugerir una categoría.
    const sujetosPorTitulo = new Map();
    for (const doc of recibidos) {
      if (!Array.isArray(doc.subject) || doc.subject.length === 0) continue;
      const clave = normalizarTexto(doc.title);
      const acumulados = sujetosPorTitulo.get(clave) ?? [];
      acumulados.push(...doc.subject);
      sujetosPorTitulo.set(clave, acumulados);
    }

    const vistos = new Set();
    const docs = recibidos
      .map((doc) => {
        const propios = Array.isArray(doc.subject) ? doc.subject : [];
        const sujetos = propios.length > 0 ? propios : sujetosPorTitulo.get(normalizarTexto(doc.title)) ?? [];
        return { ...doc, categoriaSugerida: categoriaDesdeSujetos(sujetos) };
      })
      .filter((doc) => {
        const clave = `${normalizarTexto(doc.title)}|${normalizarTexto(autoresDeDoc(doc).join(" "))}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
      .slice(0, 6);

    renderSugerencias(docs);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("No se pudo buscar en Open Library:", error);
    cerrarSugerencias({ limpiar: true });
    mensajeSugerencias("No se pudo buscar. Revisa tu conexión o completa los datos a mano.", true);
  } finally {
    if (controladorSugerencias === controlador) controladorSugerencias = null;
  }
}

function configurarAutocompletadoTitulo() {
  const input = document.getElementById("campo-titulo");
  const lista = document.getElementById("sugerencias-titulo");
  if (!input || !lista) return;

  const buscarDebounced = debounce((valor) => buscarCoincidenciasTitulo(valor), 480);

  input.addEventListener("input", () => {
    const valor = input.value.trim();
    controladorSugerencias?.abort();
    cerrarSugerencias({ limpiar: true });
    mensajeSugerencias("");
    if (valor.length < 3) return;
    buscarDebounced(valor);
  });

  input.addEventListener("keydown", (evento) => {
    if (evento.isComposing || lista.hidden) return;

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      moverSugerencia(1);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      moverSugerencia(-1);
    } else if (evento.key === "Enter" && indiceSugerencia >= 0) {
      evento.preventDefault();
      seleccionarSugerencia(indiceSugerencia);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      cerrarSugerencias();
    }
  });

  lista.addEventListener("pointerdown", (evento) => {
    const item = evento.target.closest("[data-indice]");
    if (!item) return;
    if (evento.pointerType === "mouse") {
      if (evento.button !== 0) return;
      evento.preventDefault(); // mantiene el foco en el input
    }
    punteroLista = { x: evento.clientX, y: evento.clientY, indice: Number(item.dataset.indice) };
  });

  lista.addEventListener("pointerup", (evento) => {
    if (!punteroLista) return;
    const { x, y, indice } = punteroLista;
    punteroLista = null;
    // Un arrastre (para desplazar la lista en móvil) no debe seleccionar.
    if (Math.hypot(evento.clientX - x, evento.clientY - y) < 10) {
      evento.preventDefault();
      seleccionarSugerencia(indice);
    }
  });

  lista.addEventListener("pointercancel", () => {
    punteroLista = null;
  });

  lista.addEventListener("pointermove", (evento) => {
    if (evento.pointerType !== "mouse") return;
    const item = evento.target.closest("[data-indice]");
    if (!item) return;
    const indice = Number(item.dataset.indice);
    if (indice !== indiceSugerencia) resaltarSugerencia(indice);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement !== input && !punteroLista) cerrarSugerencias();
    }, 150);
  });

  document.addEventListener("pointerdown", (evento) => {
    if (lista.hidden || evento.target.closest(".autocomplete")) return;
    cerrarSugerencias();
  });

  document.addEventListener("pointerup", (evento) => {
    if (!punteroLista || lista.contains(evento.target)) return;
    punteroLista = null;
    if (document.activeElement !== input) cerrarSugerencias();
  });

  window.addEventListener("resize", posicionarSugerencias);
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
  reiniciarSugerencias();
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

  const portada = libro?.portada ?? "";
  const auto = libro?.portadaAuto !== false;
  const manual = Boolean(portada) && (!esPortadaAuto(portada) || !auto);
  establecerPortada(portada, { manual, auto });
  mensajePortada(!portada && !auto ? "Portada automática desactivada." : "");

  abrirModal(overlay);

  // Libros antiguos sin portada: intentar traerla automáticamente del ISBN.
  if (auto && !portada && libro?.isbn) buscarPortada({ silencioso: true });
}

function manejarEnvioFormulario(evento) {
  evento.preventDefault();
  const form = evento.target;
  reiniciarSugerencias();

  // Sincroniza una URL escrita justo antes de guardar (sin esperar el debounce).
  const campoUrl = document.getElementById("campo-portada-url");
  const urlVisible = campoUrl ? campoUrl.value.trim() : "";
  if (urlVisible && urlVisible !== portadaActual) {
    if (!esPortadaValida(urlVisible)) {
      mensajePortada("Usa una URL http(s) o una ruta como assets/images/portada.jpg.", true);
      return;
    }
    portadaActual = urlVisible;
    portadaManual = true;
    portadaAutoActual = false;
  } else if (!urlVisible && portadaActual && !portadaActual.startsWith("data:")) {
    // Vaciar el campo equivale a quitar la portada remota.
    portadaActual = "";
    portadaManual = true;
    portadaAutoActual = false;
  }

  const datos = {
    titulo: form.titulo.value,
    autor: form.autor.value,
    categoria: form.categoria.value,
    isbn: form.isbn.value,
    anio: form.anio.value,
    portada: portadaActual,
    portadaAuto: portadaAutoActual,
  };

  if (!validarFormulario(datos)) return;

  if (!esPortadaValida(datos.portada)) {
    mensajePortada("La portada no tiene un formato válido.", true);
    return;
  }

  const guardado = idEnEdicion
    ? repoLibros.actualizar(idEnEdicion, datos)
    : repoLibros.agregar(new Libro({ ...datos, estado: "disponible" }));

  if (!guardado) {
    mostrarToast(
      "No se pudo guardar. Puede que el navegador no tenga espacio para la portada: prueba con una imagen más liviana.",
      "error",
      5600
    );
    return;
  }

  mostrarToast(idEnEdicion ? "Libro actualizado correctamente." : "Libro agregado a la colección.");
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
   Exportar a PDF (jsPDF se carga solo al pulsar el botón)
   ------------------------------------------------------------------------- */
async function exportarPDF() {
  const lista = obtenerLibrosFiltrados();
  await exportarTablaPDF({
    archivo: "catalogo-libros.pdf",
    titulo: "Biblioteca — Catálogo de libros",
    subtitulo: `Generado el ${new Date().toLocaleDateString("es-CL")} · ${lista.length} libros`,
    columnas: [
      { titulo: "Título", ancho: 66 },
      { titulo: "Autor", ancho: 52 },
      { titulo: "Categoría", ancho: 36 },
      { titulo: "Estado", ancho: 28 },
    ],
    filas: lista.map((libro) => [
      libro.titulo,
      libro.autor,
      libro.categoria,
      libro.estado === "prestado" ? "Prestado" : "Disponible",
    ]),
  });
}

/* -------------------------------------------------------------------------
   Orden por columnas (escritorio) y selector (móvil)
   ------------------------------------------------------------------------- */
function aplicarOrden(campo, direccion) {
  estadoTabla.ordenCampo = campo;
  estadoTabla.ordenDireccion = direccion;

  document.querySelectorAll("[data-ordenar]").forEach((th) => {
    if (th.dataset.ordenar === campo) {
      th.setAttribute("aria-sort", direccion === 1 ? "ascending" : "descending");
    } else {
      th.removeAttribute("aria-sort");
    }
  });

  const select = document.querySelector("#orden-libros");
  if (select) select.value = `${campo}:${direccion === 1 ? "asc" : "desc"}`;

  renderTabla();
}

/* -------------------------------------------------------------------------
   Inicialización
   ------------------------------------------------------------------------- */
function iniciar() {
  poblarSelectCategorias();
  configurarPortada();
  configurarAutocompletadoTitulo();
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

  const selectOrden = document.querySelector("#orden-libros");
  selectOrden?.addEventListener("change", (evento) => {
    const [campo, direccion] = evento.target.value.split(":");
    aplicarOrden(campo, direccion === "desc" ? -1 : 1);
  });

  document.querySelectorAll("[data-ordenar]").forEach((th) => {
    th.addEventListener("click", () => {
      const campo = th.dataset.ordenar;
      const direccion = estadoTabla.ordenCampo === campo ? estadoTabla.ordenDireccion * -1 : 1;
      aplicarOrden(campo, direccion);
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

  // Otra pestaña modificó el catálogo: refrescar la tabla.
  document.addEventListener("biblioteca:datos-actualizados", renderTabla);
}

document.addEventListener("DOMContentLoaded", iniciar);
