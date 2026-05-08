/**
 * @file readings.js
 * @description Bridge entre data.js y las páginas HTML de tiradas.
 *   Proporciona funciones de alto nivel para cargar y transformar datos de tiradas.
 *   NUNCA hacer fetch() directamente aquí — usar siempre las funciones de data.js.
 *
 * @dependencies
 *   - data.js — getTiradas(), getTiradaById(), getPosicionesByTirada()
 *
 * @exports cargarTiradasPorTema, cargarDetalleTirada, mapearTemaAColumna,
 *          formatearPasos, getNombreTema
 */

import { getTiradas, getTiradaById, getPosicionesByTirada } from './data.js';

/**
 * Carga las tiradas filtradas por tema desde data.js.
 * Wrapper directo de getTiradas() para mantener la semántica de lectura.
 *
 * @param {string} tema — valor exacto del campo tema en tiradas.json
 *   Valores válidos: "amor" | "consultas_generales" | "creatividad_proyectos" |
 *   "crisis_transformacion" | "decisiones_elecciones" | "espiritualidad_crecimiento" |
 *   "familia_hogar" | "salud_bienestar" | "trabajo_dinero" | "viajes_mudanzas"
 * @returns {Promise<Array<object>>} array de tiradas normalizadas con id_tirada y nombre_tirada
 * @throws {DataLoadError} si tiradas.json no puede cargarse
 */
export async function cargarTiradasPorTema(tema) {
  return getTiradas(tema);
}

/**
 * Carga el detalle completo de una tirada: datos base y posiciones.
 * Las dos peticiones se hacen en paralelo con Promise.all para minimizar el tiempo de carga.
 *
 * @param {string} idTirada — identificador de la tirada, ej: "t042"
 * @returns {Promise<{tirada: object, posiciones: Array<object>}>}
 *   tirada: objeto tirada normalizado (o undefined si no existe)
 *   posiciones: array de posiciones de la tirada (vacío si no hay)
 * @throws {DataLoadError} si tiradas.json o posiciones.json no pueden cargarse
 */
export async function cargarDetalleTirada(idTirada) {
  const [tirada, posiciones] = await Promise.all([
    getTiradaById(idTirada),
    getPosicionesByTirada(idTirada)
  ]);
  return { tirada, posiciones };
}

/**
 * Mapea el valor del campo tema al sufijo de columna en cartas.json.
 * El sufijo es idéntico al valor del tema — esta función es el punto
 * canónico donde vive ese mapeo para que ninguna página lo hardcodee.
 * Si el tema no está en el mapa, devuelve el propio tema como fallback.
 *
 * @param {string} tema — valor del campo tema (ej: "amor")
 * @returns {string} sufijo de columna en cartas.json (ej: "amor" → campo "amor_recta")
 */
export function mapearTemaAColumna(tema) {
  // mapa tema (enum canónico) → sufijo de columna real en cartas.json
  const mapa = {
    'amor':                       'amor',
    'consultas_generales':        'general_sino',
    'creatividad_proyectos':      'creatividad',
    'crisis_transformacion':      'crisis_transformacion',
    'decisiones_elecciones':      'decisiones',
    'espiritualidad_crecimiento': 'espiritualidad',
    'familia_hogar':              'familia_hogar',
    'salud_bienestar':            'salud',
    'trabajo_dinero':             'finanzas_trabajo',
    'viajes_mudanzas':            'viajes_mudanzas',
  };
  return mapa[tema] || tema;
}

/**
 * Separa el campo como_realizar de tiradas.json en pasos individuales.
 * Detecta el patrón "PASO N - ..." y genera un <p> por cada paso.
 * Si no hay separadores de paso, devuelve el texto como párrafo único.
 *
 * @param {string} comoRealizar — valor raw del campo como_realizar
 * @returns {string} HTML con elementos <p class="paso-instruccion"> por cada paso
 */
export function formatearPasos(comoRealizar) {
  if (!comoRealizar) return '';

  const pasos = comoRealizar
    .split(/(?=PASO\s+\d+\s*[-–:·]?)/i)
    .map(p => p.trim())
    .filter(Boolean);

  if (pasos.length <= 1) {
    return `<p class="paso-instruccion">${comoRealizar}</p>`;
  }

  return pasos
    .map(p => `<p class="paso-instruccion">${p}</p>`)
    .join('');
}

/**
 * Devuelve el nombre legible de un tema para mostrar en la interfaz.
 * Si el tema no está en el mapa, devuelve el propio valor como fallback.
 *
 * @param {string} tema — valor del campo tema en tiradas.json
 * @returns {string} nombre legible, ej: "amor" → "Amor y Relaciones"
 */
export function getNombreTema(tema) {
  const nombres = {
    'amor':                       'Amor',
    'consultas_generales':        'General',
    'creatividad_proyectos':      'Creatividad',
    'crisis_transformacion':      'Crisis y Transformación',
    'decisiones_elecciones':      'Decisiones',
    'espiritualidad_crecimiento': 'Espiritualidad',
    'familia_hogar':              'Familia y Hogar',
    'salud_bienestar':            'Salud',
    'trabajo_dinero':             'Finanzas y Trabajo',
    'viajes_mudanzas':            'Viajes y Mudanzas',
  };
  return nombres[tema] || tema;
}
