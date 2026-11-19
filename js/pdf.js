// ==========================================================================
// BIBLIOTECA — pdf.js
// Carga perezosa de jsPDF y generación compartida de tablas en PDF.
// Antes, jsPDF (~350 KB) se descargaba en cada visita a Libros y Préstamos
// aunque el usuario nunca exportara; ahora solo se pide al pulsar el botón.
// ==========================================================================

import { mostrarToast } from "./ui.js";

const URL_JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const SRI_JSPDF = "sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk";

let promesaCarga = null;

/** Carga jsPDF una sola vez y reutiliza la promesa en llamadas posteriores. */
export function cargarJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);

  if (!promesaCarga) {
    promesaCarga = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = URL_JSPDF;
      script.integrity = SRI_JSPDF;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error("jsPDF no expuso la API esperada"));
      };
      script.onerror = () => reject(new Error("No se pudo descargar jsPDF"));
      document.head.appendChild(script);
    }).catch((error) => {
      promesaCarga = null;
      throw error;
    });
  }

  return promesaCarga;
}

function recortarTexto(doc, texto, ancho) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (doc.getTextWidth(limpio) <= ancho) return limpio;
  let recortado = limpio;
  while (recortado.length > 1 && doc.getTextWidth(`${recortado}…`) > ancho) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

/**
 * Genera y descarga una tabla en PDF.
 * @param {object} opciones
 * @param {string} opciones.archivo   Nombre del archivo a descargar.
 * @param {string} opciones.titulo    Título del documento.
 * @param {string} opciones.subtitulo Línea secundaria (fecha, total…).
 * @param {{titulo:string, ancho:number}[]} opciones.columnas
 * @param {string[][]} opciones.filas Filas ya formateadas como texto.
 * @returns {Promise<boolean>} true si se generó el PDF.
 */
export async function exportarTablaPDF({ archivo, titulo, subtitulo, columnas, filas }) {
  let jsPDF;
  try {
    jsPDF = await cargarJsPDF();
  } catch (error) {
    console.error(error);
    mostrarToast("No se pudo cargar el generador de PDF. Revisa tu conexión.", "error");
    return false;
  }

  try {
    const doc = new jsPDF();
    const margen = 14;
    const anchoUtil = 182;

    const dibujarCabecera = (y) => {
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(154, 43, 59);
      doc.rect(margen, y - 5, anchoUtil, 7, "F");
      let x = margen + 2;
      columnas.forEach((columna) => {
        doc.text(recortarTexto(doc, columna.titulo, columna.ancho - 4), x, y);
        x += columna.ancho;
      });
      return y + 8;
    };

    doc.setFontSize(16);
    doc.setTextColor(28, 27, 25);
    doc.text(titulo, margen, 18);

    doc.setFontSize(10);
    doc.setTextColor(110, 106, 100);
    doc.text(subtitulo, margen, 24);

    let y = dibujarCabecera(36);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);

    if (filas.length === 0) {
      doc.text("Sin registros para exportar.", margen + 2, y);
    }

    filas.forEach((fila) => {
      if (y > 275) {
        doc.addPage();
        y = dibujarCabecera(20);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
      }
      let x = margen + 2;
      fila.forEach((valor, indice) => {
        const columna = columnas[indice];
        if (!columna) return;
        doc.text(recortarTexto(doc, valor, columna.ancho - 4), x, y);
        x += columna.ancho;
      });
      y += 7;
    });

    const totalPaginas = doc.getNumberOfPages();
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      doc.setPage(pagina);
      doc.setFontSize(8);
      doc.setTextColor(150, 147, 140);
      doc.text(`${pagina} / ${totalPaginas}`, 196, 290, { align: "right" });
    }

    doc.save(archivo);
    mostrarToast("PDF generado correctamente.");
    return true;
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    mostrarToast("Ocurrió un error al generar el PDF.", "error");
    return false;
  }
}
