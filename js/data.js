/**
 * @file data.js
 * @description ÚNICA FUENTE DE VERDAD del proyecto. Gestiona la carga, caché
 *   y acceso a todos los datos JSON. Ningún otro módulo hace fetch() directamente.
 *
 * @dependencies
 *   - data/cartas.json (78 registros)
 *   - data/tiradas.json (155 registros)
 *   - data/posiciones.json (variable)
 *   - data/sinonimos.json (147 categorías)
 *   - data/combinaciones-*.json (24.024 registros total, carga lazy por chunks)
 *
 * @exports getCartas, getCartaById, getTiradas, getTiradaById,
 *          getPosicionesByTirada, getSinonimos, buscarCombinacion,
 *          buscarTodasLasPosiciones, getPosicionCombinacion, DataLoadError
 *
 * @architecture
 *   Usa caché en objeto plano (_cache) para JSON base y Map (_cacheChunks) para chunks.
 *   buscarCombinacion() usa lazy loading + indexación O(1) para los 24.024 registros.
 *   PROHIBIDO duplicar estas funciones en cualquier otro módulo.
 */

// ── CLASE DE ERROR TIPADA — FASE 8A ─────────────────────────────────────────

/**
 * Error específico para fallos de carga de archivos JSON.
 * Permite identificar errores de red/datos en los callers mediante instanceof.
 *
 * @example
 * try {
 *   await getCartas();
 * } catch (err) {
 *   if (err instanceof DataLoadError) {
 *     mostrarErrorAmigable('json_load_error');
 *   }
 * }
 */
class DataLoadError extends Error {
  constructor(url, cause) {
    super(`No se pudo cargar: ${url}`);
    this.name = 'DataLoadError';
    this.url = url;
    this.cause = cause;
  }
}

export { DataLoadError };

// ── CACHÉ ────────────────────────────────────────────────────────────────────

// Caché en módulo (no expuesto fuera)
const _cache = {};

// ── CARGA GENÉRICA ───────────────────────────────────────────────────────────

/**
 * Carga genérica con caché y manejo de errores tipado.
 * Las llamadas subsiguientes para la misma key devuelven el valor cacheado sin fetch.
 * Fase 8A: lanza DataLoadError en lugar del error genérico.
 *
 * @param {string} key — clave de caché interna
 * @param {string} url — ruta relativa al JSON
 * @returns {Promise<any>} datos parseados del JSON
 * @throws {DataLoadError} si la petición falla o el JSON es inválido
 */
async function _load(key, url) {
  if (_cache[key]) return _cache[key];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
    const datos = await res.json();
    _cache[key] = datos;
    return datos;
  } catch (err) {
    console.error(`[data.js] Error cargando ${url}:`, err);
    throw new DataLoadError(url, err);
  }
}

/**
 * Normaliza un registro de tirada para que siempre tenga id_tirada y nombre_tirada
 * independientemente de si el JSON usa "id"/"nombre" o "id_tirada"/"nombre_tirada".
 * @param {object} t — registro raw de tiradas.json
 * @returns {object}
 */
function _normalizarTirada(t) {
  return {
    ...t,
    id_tirada:     t.id_tirada     || t.id,
    nombre_tirada: t.nombre_tirada || t.nombre,
  };
}

// —— FUNCIONES PÚBLICAS — DATOS BASE ——————————————————————————————————————————

/**
 * Devuelve el array completo de 78 cartas desde cartas.json.
 * El resultado se cachea; las llamadas subsiguientes son síncronas internamente.
 *
 * @returns {Promise<Array<object>>} array de 78 objetos carta
 * @throws {DataLoadError} si cartas.json no puede cargarse
 */
export async function getCartas() {
  return _load('cartas', 'data/cartas.json');
}

/**
 * Devuelve la carta cuyo campo id coincide con el valor indicado.
 *
 * @param {number} id — ID de la carta (1–78)
 * @returns {Promise<object|undefined>} objeto carta o undefined si no existe
 * @throws {DataLoadError} si cartas.json no puede cargarse
 *
 * @example
 * const carta = await getCartaById(1); // Le Mat
 */
export async function getCartaById(id) {
  const cartas = await getCartas();
  return cartas.find(c => c.id === id);
}

/**
 * Devuelve las tiradas del JSON, opcionalmente filtradas por tema.
 * Los registros se normalizan para garantizar los campos id_tirada y nombre_tirada.
 *
 * @param {string|null} [filtroTema=null] — valor exacto del campo tema (ej: "amor")
 *   Si es null, devuelve todas las tiradas.
 * @returns {Promise<Array<object>>} array de tiradas normalizadas
 * @throws {DataLoadError} si tiradas.json no puede cargarse
 */
export async function getTiradas(filtroTema = null) {
  const raw = await _load('tiradas', 'data/tiradas.json');
  const tiradas = raw.map(_normalizarTirada);
  if (!filtroTema) return tiradas;
  return tiradas.filter(t => t.tema === filtroTema);
}

/**
 * Devuelve la tirada con el id_tirada indicado.
 *
 * @param {string} idTirada — ej: "t042"
 * @returns {Promise<object|undefined>} objeto tirada normalizado o undefined
 * @throws {DataLoadError} si tiradas.json no puede cargarse
 */
export async function getTiradaById(idTirada) {
  const raw = await _load('tiradas', 'data/tiradas.json');
  const tiradas = raw.map(_normalizarTirada);
  return tiradas.find(t => t.id_tirada === idTirada);
}

/**
 * Devuelve las posiciones de posiciones.json que pertenecen a la tirada indicada.
 * Acepta tanto el campo tirada_id como id_tirada en el JSON para mayor robustez.
 *
 * @param {string} idTirada — ej: "t042"
 * @returns {Promise<Array<object>>} array de posiciones (vacío si no hay)
 * @throws {DataLoadError} si posiciones.json no puede cargarse
 */
export async function getPosicionesByTirada(idTirada) {
  const posiciones = await _load('posiciones', 'data/posiciones.json');
  return posiciones.filter(p => (p.tirada_id || p.id_tirada) === idTirada);
}

/**
 * Devuelve el objeto completo de sinonimos.json (147 categorías).
 * Usado por conclusion.js para rellenar los slots dinámicos de las plantillas.
 *
 * @returns {Promise<object>} objeto con categorías como claves y arrays de sinónimos como valores
 * @throws {DataLoadError} si sinonimos.json no puede cargarse
 */
export async function getSinonimos() {
  return _load('sinonimos', 'data/sinonimos.json');
}

// —— COMBINACIONES — CARGA LAZY POR CHUNKS ———————————————————————————————————

// Cache de chunks ya cargados: clave = "tipoCarpeta/idCarta1" → Map indexado
const _cacheChunks = new Map();

// Campo de id de segunda carta en los JSON de combinaciones (confirmado en Fase 1)
const CAMPO_ID_CARTA2 = 'id_carta_2';

/**
 * Determina la carpeta correcta según el tipo de las dos cartas.
 * Mayor: id <= 22 · Menor: id > 22
 * IMPORTANTE: El orden de id1/id2 es significativo — A+B ≠ B+A.
 *
 * @param {number} id1
 * @param {number} id2
 * @returns {string} nombre de la carpeta: 'combinaciones-mm' | 'combinaciones-maymen' |
 *                   'combinaciones-menmay' | 'combinaciones-menmen'
 */
function _determinarTipoArchivo(id1, id2) {
  const es1Mayor = id1 <= 22;
  const es2Mayor = id2 <= 22;
  if (es1Mayor  && es2Mayor)  return 'combinaciones-mm';
  if (es1Mayor  && !es2Mayor) return 'combinaciones-maymen';
  if (!es1Mayor && es2Mayor)  return 'combinaciones-menmay';
  return 'combinaciones-menmen';
}

/**
 * Carga el chunk JSON de combinaciones para una carta1 dada e indexa por clave "{id2}-{pos}".
 * Devuelve Map vacío si el archivo no existe (sin romper la app).
 * Las búsquedas posteriores son O(1) gracias al Map indexado.
 *
 * @param {string} tipoCarpeta — nombre de la carpeta de combinaciones
 * @param {number} idCarta1 — ID de la primera carta
 * @returns {Promise<Map<string, object>>} Map indexado por "{id_carta_2}-{posicion}"
 */
async function _cargarChunk(tipoCarpeta, idCarta1) {
  const clave = `${tipoCarpeta}/${idCarta1}`;

  if (_cacheChunks.has(clave)) {
    return _cacheChunks.get(clave);
  }

  const url = `data/${tipoCarpeta}/${idCarta1}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const datos = await res.json();
    const indice = new Map(
      datos.map(r => [`${r[CAMPO_ID_CARTA2]}-${r.posicion}`, r])
    );
    _cacheChunks.set(clave, indice);
    return indice;
  } catch (err) {
    console.warn(`[data.js] Chunk no disponible: ${url}`, err);
    _cacheChunks.set(clave, new Map());
    return new Map();
  }
}

/**
 * Busca la combinación entre dos cartas en la posición dada.
 * Carga el chunk de id1 de forma lazy y cachea el resultado.
 * Fase 8A: Si el chunk falla al cargar, devuelve null sin propagar el error al caller.
 *
 * @param {number} id1      — ID de la primera carta (1–78)
 * @param {number} id2      — ID de la segunda carta (1–78, distinta de id1)
 * @param {string} posicion — Orientación combinada: "RR" | "RI" | "IR" | "II"
 * @returns {Promise<object|null>} objeto combinación con todos sus campos, o null si no existe
 *
 * @example
 * const comb = await buscarCombinacion(1, 5, 'RR');
 * if (comb) console.log(comb.interpretacion);
 */
export async function buscarCombinacion(id1, id2, posicion) {
  try {
    const tipo  = _determinarTipoArchivo(id1, id2);
    const chunk = await _cargarChunk(tipo, id1);
    return chunk.get(`${id2}-${posicion}`) ?? null;
  } catch (err) {
    console.error('[data.js] Error en buscarCombinacion:', { id1, id2, posicion }, err);
    return null;
  }
}

/**
 * Carga todas las combinaciones de id1 con id2 en las 4 posiciones posibles.
 * Útil para detalle-combinacion.html que necesita las 4 pestañas a la vez.
 * Las 4 peticiones se lanzan en paralelo con Promise.all.
 *
 * @param {number} id1
 * @param {number} id2
 * @returns {Promise<{RR: object|null, RI: object|null, IR: object|null, II: object|null}>}
 */
export async function buscarTodasLasPosiciones(id1, id2) {
  const [rr, ri, ir, ii] = await Promise.all([
    buscarCombinacion(id1, id2, 'RR'),
    buscarCombinacion(id1, id2, 'RI'),
    buscarCombinacion(id1, id2, 'IR'),
    buscarCombinacion(id1, id2, 'II'),
  ]);
  return { RR: rr, RI: ri, IR: ir, II: ii };
}

/**
 * Calcula el código de posición a partir de las orientaciones de dos cartas.
 * R = Recta, I = Invertida. El orden es significativo: carta1 primero.
 *
 * @param {string} orient1 — "recta" | "invertida"
 * @param {string} orient2 — "recta" | "invertida"
 * @returns {string} — "RR" | "RI" | "IR" | "II"
 *
 * @example
 * getPosicionCombinacion('recta', 'invertida'); // → 'RI'
 */
export function getPosicionCombinacion(orient1, orient2) {
  const map = { recta: 'R', invertida: 'I' };
  return (map[orient1] || 'R') + (map[orient2] || 'R');
}
