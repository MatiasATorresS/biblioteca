// ==========================================================================
// BIBLIOTECA — utils.js
// Funciones puras de apoyo: ids, fechas, validaciones, debounce.
// ==========================================================================

/** Genera un id corto y único basado en tiempo + aleatorio. */
export function generarId(prefijo = "id") {
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Formatea una fecha ISO (YYYY-MM-DD) a formato legible es-CL. */
export function formatearFecha(iso) {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

/** Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local). */
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Suma días a una fecha ISO y devuelve otra fecha ISO. */
export function sumarDiasISO(iso, dias) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/** Diferencia en días entre dos fechas ISO (b - a). */
export function diferenciaDias(isoA, isoB) {
  const [a1, m1, d1] = isoA.split("-").map(Number);
  const [a2, m2, d2] = isoB.split("-").map(Number);
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / msPorDia);
}

/** Etiqueta de mes corto en español a partir de un índice 0-11. */
export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Debounce genérico para inputs de búsqueda en tiempo real. */
export function debounce(fn, espera = 220) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), espera);
  };
}

/** Escapa texto para insertarlo de forma segura en innerHTML. */
export function escapeHTML(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Valida un correo electrónico con una expresión razonable. */
export function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}

/** Valida un teléfono chileno flexible: +56 9 1234 5678, 912345678, etc. */
export function validarTelefono(telefono) {
  const limpio = telefono.replace(/[\s-]/g, "");
  return /^(\+?56)?9?\d{8}$/.test(limpio) || /^\+?\d{7,15}$/.test(limpio);
}

/** Calcula el dígito verificador de un RUT chileno (algoritmo módulo 11). */
function calcularDV(rutNumerico) {
  let suma = 0;
  let multiplicador = 2;
  for (let i = rutNumerico.length - 1; i >= 0; i--) {
    suma += Number(rutNumerico[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * Valida un RUT chileno (admite puntos y guion, ej: 12.345.678-5).
 * Si el documento no calza con el patrón de RUT, se acepta como un
 * documento de identidad genérico (para no bloquear usuarios extranjeros).
 */
export function validarDocumento(valor) {
  const limpio = valor.trim().replace(/\./g, "").toUpperCase();
  const match = limpio.match(/^(\d{1,8})-?([0-9K])$/);
  if (!match) {
    // No tiene forma de RUT: se acepta como documento genérico con largo mínimo.
    return limpio.length >= 5;
  }
  const [, numero, dv] = match;
  return calcularDV(numero) === dv;
}

/** Formatea un RUT limpio a formato 12.345.678-5 (si calza el patrón). */
export function formatearDocumento(valor) {
  const limpio = valor.trim().replace(/\./g, "").toUpperCase();
  const match = limpio.match(/^(\d{1,8})-?([0-9K])$/);
  if (!match) return valor.trim();
  const [, numero, dv] = match;
  const conPuntos = numero.split("").reverse().reduce((acc, digito, i) => {
    return digito + (i > 0 && i % 3 === 0 ? "." : "") + acc;
  }, "");
  return `${conPuntos}-${dv}`;
}

/** Trunca un texto a n caracteres añadiendo elipsis si corresponde. */
export function truncar(texto, n) {
  return texto.length > n ? `${texto.slice(0, n - 1)}…` : texto;
}

/** Asigna un color determinista (de una paleta fija) a partir de un texto. */
const PALETA_CATEGORIAS = ["#9a2b3b", "#1f6f6b", "#b8842a", "#3b5b9a", "#6b4e9a", "#3a8a4e", "#9a3a6b"];
export function colorPorTexto(texto = "") {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  return PALETA_CATEGORIAS[hash % PALETA_CATEGORIAS.length];
}
