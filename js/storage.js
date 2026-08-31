// ==========================================================================
// BIBLIOTECA — storage.js
// Capa de persistencia sobre LocalStorage. Expone clases de modelo
// (Libro, Usuario, Prestamo) y un Repositorio genérico con operaciones
// CRUD, además de los repositorios concretos ya instanciados.
// ==========================================================================

import { generarId, hoyISO, sumarDiasISO } from "./utils.js";

const CLAVES = {
  libros: "biblioteca_libros",
  usuarios: "biblioteca_usuarios",
  prestamos: "biblioteca_prestamos",
  tema: "biblioteca_tema",
  seed: "biblioteca_seed_v1",
};

/* -------------------------------------------------------------------------
   Modelos
   ------------------------------------------------------------------------- */
export class Libro {
  constructor({ id, titulo, autor, categoria, isbn, anio, estado = "disponible" }) {
    this.id = id ?? generarId("lib");
    this.titulo = titulo;
    this.autor = autor;
    this.categoria = categoria;
    this.isbn = isbn;
    this.anio = Number(anio);
    this.estado = estado; // "disponible" | "prestado"
  }
}

export class Usuario {
  constructor({ id, nombre, documento, correo, telefono }) {
    this.id = id ?? generarId("usr");
    this.nombre = nombre;
    this.documento = documento;
    this.correo = correo;
    this.telefono = telefono;
    this.fechaRegistro = hoyISO();
  }
}

export class Prestamo {
  constructor({ id, libroId, usuarioId, fechaPrestamo, fechaDevolucionEstimada, fechaDevolucionReal = null, estado = "activo" }) {
    this.id = id ?? generarId("pre");
    this.libroId = libroId;
    this.usuarioId = usuarioId;
    this.fechaPrestamo = fechaPrestamo ?? hoyISO();
    this.fechaDevolucionEstimada = fechaDevolucionEstimada ?? sumarDiasISO(this.fechaPrestamo, 14);
    this.fechaDevolucionReal = fechaDevolucionReal;
    this.estado = estado; // "activo" | "devuelto"
  }
}

/* -------------------------------------------------------------------------
   Repositorio genérico sobre LocalStorage
   ------------------------------------------------------------------------- */
class Repositorio {
  constructor(clave) {
    this.clave = clave;
  }

  obtenerTodos() {
    try {
      const crudo = localStorage.getItem(this.clave);
      return crudo ? JSON.parse(crudo) : [];
    } catch (error) {
      console.error(`No se pudo leer "${this.clave}" desde LocalStorage:`, error);
      return [];
    }
  }

  guardarTodos(lista) {
    try {
      localStorage.setItem(this.clave, JSON.stringify(lista));
      return true;
    } catch (error) {
      console.error(`No se pudo escribir "${this.clave}" en LocalStorage:`, error);
      return false;
    }
  }

  obtenerPorId(id) {
    return this.obtenerTodos().find((item) => item.id === id) ?? null;
  }

  agregar(item) {
    const lista = this.obtenerTodos();
    lista.push(item);
    this.guardarTodos(lista);
    return item;
  }

  actualizar(id, cambios) {
    const lista = this.obtenerTodos();
    const indice = lista.findIndex((item) => item.id === id);
    if (indice === -1) return null;
    lista[indice] = { ...lista[indice], ...cambios };
    this.guardarTodos(lista);
    return lista[indice];
  }

  eliminar(id) {
    const lista = this.obtenerTodos();
    const filtrada = lista.filter((item) => item.id !== id);
    this.guardarTodos(filtrada);
    return filtrada.length !== lista.length;
  }
}

export const repoLibros = new Repositorio(CLAVES.libros);
export const repoUsuarios = new Repositorio(CLAVES.usuarios);
export const repoPrestamos = new Repositorio(CLAVES.prestamos);

/* -------------------------------------------------------------------------
   Tema (claro/oscuro)
   ------------------------------------------------------------------------- */
export function obtenerTemaGuardado() {
  return localStorage.getItem(CLAVES.tema);
}
export function guardarTema(tema) {
  localStorage.setItem(CLAVES.tema, tema);
}

/* -------------------------------------------------------------------------
   Datos de ejemplo (solo se cargan una vez, en el primer uso)
   ------------------------------------------------------------------------- */
export function sembrarDatosIniciales() {
  if (localStorage.getItem(CLAVES.seed)) return;

  const libros = [
    new Libro({ titulo: "Cien años de soledad", autor: "Gabriel García Márquez", categoria: "Literatura", isbn: "9780307474728", anio: 1967 }),
    new Libro({ titulo: "1984", autor: "George Orwell", categoria: "Ciencia Ficción", isbn: "9780451524935", anio: 1949 }),
    new Libro({ titulo: "Fundación", autor: "Isaac Asimov", categoria: "Ciencia Ficción", isbn: "9780553293357", anio: 1951 }),
    new Libro({ titulo: "Clean Code", autor: "Robert C. Martin", categoria: "Tecnología", isbn: "9780132350884", anio: 2008 }),
    new Libro({ titulo: "Estructuras de Datos y Algoritmos", autor: "Alfred V. Aho", categoria: "Tecnología", isbn: "9780201000238", anio: 1983 }),
    new Libro({ titulo: "Sapiens", autor: "Yuval Noah Harari", categoria: "Historia", isbn: "9780062316097", anio: 2011 }),
    new Libro({ titulo: "El Origen de las Especies", autor: "Charles Darwin", categoria: "Ciencia", isbn: "9780451529060", anio: 1859 }),
    new Libro({ titulo: "La Ciudad y los Perros", autor: "Mario Vargas Llosa", categoria: "Literatura", isbn: "9788420471860", anio: 1963 }),
    new Libro({ titulo: "Steve Jobs", autor: "Walter Isaacson", categoria: "Biografía", isbn: "9781451648539", anio: 2011 }),
    new Libro({ titulo: "El Principito", autor: "Antoine de Saint-Exupéry", categoria: "Infantil", isbn: "9780156012195", anio: 1943 }),
    new Libro({ titulo: "Rayuela", autor: "Julio Cortázar", categoria: "Literatura", isbn: "9788437604572", anio: 1963 }),
    new Libro({ titulo: "Introducción a los Algoritmos", autor: "Thomas H. Cormen", categoria: "Tecnología", isbn: "9780262033848", anio: 1990 }),
  ];
  repoLibros.guardarTodos(libros);

  const usuarios = [
    new Usuario({ nombre: "Camila Reyes Muñoz", documento: "12.345.678-5", correo: "camila.reyes@correo.cl", telefono: "+56 9 8123 4567" }),
    new Usuario({ nombre: "Tomás Vidal Soto", documento: "13.987.654-3", correo: "tomas.vidal@correo.cl", telefono: "+56 9 7654 3210" }),
    new Usuario({ nombre: "Florencia Castro Lagos", documento: "14.222.333-1", correo: "florencia.castro@correo.cl", telefono: "+56 9 5544 3322" }),
    new Usuario({ nombre: "Benjamín Ortiz Pino", documento: "15.111.222-9", correo: "benjamin.ortiz@correo.cl", telefono: "+56 9 1122 3344" }),
    new Usuario({ nombre: "Valentina Soto Díaz", documento: "16.888.777-6", correo: "valentina.soto@correo.cl", telefono: "+56 9 9988 7766" }),
  ];
  repoUsuarios.guardarTodos(usuarios);

  // Préstamos de ejemplo distribuidos en los últimos meses, para que el
  // dashboard y los gráficos muestren datos desde el primer uso.
  const hoy = hoyISO();
  const prestamosSemilla = [
    { libro: 0, usuario: 0, hace: 70, devuelto: true },
    { libro: 1, usuario: 1, hace: 65, devuelto: true },
    { libro: 3, usuario: 2, hace: 58, devuelto: true },
    { libro: 0, usuario: 3, hace: 40, devuelto: true },
    { libro: 4, usuario: 0, hace: 33, devuelto: true },
    { libro: 5, usuario: 4, hace: 25, devuelto: true },
    { libro: 1, usuario: 2, hace: 20, devuelto: true },
    { libro: 3, usuario: 1, hace: 12, devuelto: false },
    { libro: 7, usuario: 3, hace: 6, devuelto: false },
    { libro: 0, usuario: 4, hace: 3, devuelto: false },
  ];

  const prestamos = prestamosSemilla.map(({ libro, usuario, hace, devuelto }) => {
    const fechaPrestamo = sumarDiasISO(hoy, -hace);
    const fechaDevolucionEstimada = sumarDiasISO(fechaPrestamo, 14);
    return new Prestamo({
      libroId: libros[libro].id,
      usuarioId: usuarios[usuario].id,
      fechaPrestamo,
      fechaDevolucionEstimada,
      fechaDevolucionReal: devuelto ? sumarDiasISO(fechaPrestamo, 10) : null,
      estado: devuelto ? "devuelto" : "activo",
    });
  });
  repoPrestamos.guardarTodos(prestamos);

  // Los libros con préstamo activo deben figurar como "prestado".
  prestamos
    .filter((p) => p.estado === "activo")
    .forEach((p) => repoLibros.actualizar(p.libroId, { estado: "prestado" }));

  localStorage.setItem(CLAVES.seed, "1");
}

/** Elimina todos los datos guardados y vuelve a sembrar los de ejemplo. */
export function reiniciarDatos() {
  localStorage.removeItem(CLAVES.libros);
  localStorage.removeItem(CLAVES.usuarios);
  localStorage.removeItem(CLAVES.prestamos);
  localStorage.removeItem(CLAVES.seed);
  sembrarDatosIniciales();
}
