/**
 * @file conclusion.js
 * @description Motor de generación de conclusiones narrativas para resultado.html.
 *   Calcula score posicional, tono y mayorías (elementos, arcanos, palos),
 *   rellena plantillas con slots dinámicos desde sinonimos.json y garantiza
 *   variedad léxica entre lecturas mediante selección aleatoria anti-repetición.
 *
 * @dependencies
 *   - data.js — getSinonimos()
 *
 * @exports generarConclusion, regenerarConclusion, getFallbackNarrativo
 *
 * @architecture — Sistema de plantillas:
 *   Cada plantilla contiene slots: {carta}, {tendencia}, {sinonimo}, {elemento}, {palo}.
 *   Los slots {sinonimo} se rellenan siempre desde sinonimos.json.
 *   Las plantillas proveen estructura; sinonimos.json provee el vocabulario variable.
 *   PROHIBIDO: frases completamente estáticas sin ningún slot dinámico.
 *
 *   Condiciones de fallback (Fase 8A):
 *   A — sinonimos.json no cargó → usar _SINONIMOS_FALLBACK (set mínimo hardcodeado)
 *   B — carta no tiene campos esperados → usar getFallbackNarrativo(carta)
 */

// ─────────────────────────────────────────────────────────────────────────────
// conclusion.js — Motor de generación de conclusiones narrativas.
//
// Responsabilidad:
//   · Calcular score posicional, tono y mayorías (elementos, arcanos, palos)
//   · Rellenar plantillas con slots dinámicos desde sinonimos.json
//   · Garantizar variedad léxica entre lecturas (selección aleatoria, anti-repetición)
//   · Generar texto orientativo sin lenguaje fatalista ni promesas absolutas
//
// Dependencias:
//   · data.js — getSinonimos()
//
// SISTEMA DE PLANTILLAS:
//   Cada plantilla contiene slots: {carta}, {tendencia}, {sinonimo}, {elemento}, {palo}
//   Los slots {sinonimo} siempre se rellenan desde sinonimos.json.
//   Las plantillas proveen estructura — sinonimos.json provee el vocabulario variable.
//   PROHIBIDO: frases completamente estáticas sin ningún slot dinámico.
// ─────────────────────────────────────────────────────────────────────────────

import { getSinonimos } from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// PESOS POSICIONALES (tabla del plan)
// ─────────────────────────────────────────────────────────────────────────────

const PESOS = {
  1:  [100],
  2:  [54, 46],
  3:  [39, 33, 28],
  4:  [33, 28, 24, 15],
  5:  [27, 23, 20, 17, 13],
  6:  [24, 20, 17, 15, 13, 11],
  7:  [22, 18, 16, 14, 12, 10, 8],
  10: [18, 15, 13, 11, 10, 9, 8, 7, 5, 4],
  12: [16, 14, 12, 10, 9, 8, 7, 6, 5, 5, 4, 4],
};

/** Devuelve el array de pesos para N cartas (interpolando si no existe exacto) */
function _getPesos(n) {
  if (PESOS[n]) return PESOS[n];
  // Fallback: distribuir peso decreciente normalizado
  const raw = Array.from({ length: n }, (_, i) => Math.pow(0.85, i));
  const sum  = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => Math.round((v / sum) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// BONUS DE COMBINACIONES
// ─────────────────────────────────────────────────────────────────────────────

const BONUS_TIPO = {
  RESONANCIA: +2,
  SINERGIA:   +1,
  TENSION:    -1,
  NEUTRO:      0,
  BLOQUEO:    -2,
  REFUERZO:   +1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLAS CON SLOTS DINÁMICOS
// Organizadas por tono (favorable / equilibrio / prudencia) y tipo de combinación.
// {carta} → arcano_es  |  {tendencia} → tendencia_recta/inv  |  {sinonimo} → de sinonimos.json
// {elemento} → elemento de la carta  |  {palo} → palo de arcanos menores
// ─────────────────────────────────────────────────────────────────────────────

const PLANTILLAS = {
  // ── SITUACIÓN ACTUAL ──────────────────────────────────────────────────────
  situacion: {
    favorable: [
      'La energía de {carta} trae {sinonimo} al conjunto de la consulta. {tendencia}',
      '{carta} actúa como fuerza de {sinonimo} en este momento. {tendencia}',
      'La influencia de {carta} abre un espacio de {sinonimo}. {tendencia}',
    ],
    equilibrio: [
      'La presencia de {carta} introduce {sinonimo} en la situación. {tendencia}',
      '{carta} señala un proceso de {sinonimo} que está en marcha. {tendencia}',
      'La energía de {carta} requiere atención a {sinonimo}. {tendencia}',
    ],
    prudencia: [
      '{carta} invita a revisar {sinonimo} antes de avanzar. {tendencia}',
      'La influencia de {carta} pide paciencia con {sinonimo}. {tendencia}',
      '{carta} señala que {sinonimo} necesita ser examinado con cuidado. {tendencia}',
    ],
  },

  // ── TENSIÓN / OPORTUNIDAD ─────────────────────────────────────────────────
  tension: {
    RESONANCIA: [
      'Cuando {carta1} y {carta2} se alinean, amplifican {sinonimo}. Esta resonancia puede ser decisiva.',
      'La unión de {carta1} y {carta2} crea un campo de {sinonimo} que refuerza el mensaje de la consulta.',
    ],
    SINERGIA: [
      '{carta1} y {carta2} se complementan creando {sinonimo}. Su equilibrio sugiere un camino de integración.',
      'La sinergia entre {carta1} y {carta2} abre posibilidades de {sinonimo} que no existirían por separado.',
    ],
    TENSION: [
      'La tensión entre {carta1} y {carta2} refleja {sinonimo}. Este contraste puede ser fuente de aprendizaje.',
      '{carta1} y {carta2} generan una fricción de {sinonimo} que pide ser resuelta con consciencia.',
    ],
    BLOQUEO: [
      'La energía bloqueada entre {carta1} y {carta2} señala {sinonimo}. Conviene no forzar el avance.',
      '{carta1} y {carta2} crean un bloqueo en torno a {sinonimo}. La pausa puede ser más productiva que la acción.',
    ],
    REFUERZO: [
      '{carta1} refuerza el mensaje de {carta2} en torno a {sinonimo}. Este refuerzo da claridad al camino.',
      'La combinación de {carta1} y {carta2} consolida {sinonimo} como tema central de esta lectura.',
    ],
    NEUTRO: [
      '{carta1} y {carta2} coexisten en la consulta sin oposición directa. Cada una aporta {sinonimo} de forma independiente.',
      'La relación entre {carta1} y {carta2} es de {sinonimo}: cada energía tiene su espacio sin anular a la otra.',
    ],
    ninguna: [
      'Las cartas de esta consulta operan de forma relativamente independiente, cada una aportando su {sinonimo} particular.',
      'Sin combinaciones dominantes, cada carta expresa {sinonimo} por sí sola.',
    ],
  },

  // ── CONSEJO ───────────────────────────────────────────────────────────────
  consejo: {
    favorable: [
      'El consejo de esta consulta apunta hacia {sinonimo}. Confiar en el proceso es parte del camino.',
      'Esta lectura sugiere cultivar {sinonimo} como actitud central en las próximas decisiones.',
      'La dirección indicada es de {sinonimo}. El momento es propicio para actuar desde esa energía.',
    ],
    equilibrio: [
      'La consulta invita a integrar {sinonimo} con la situación actual. El equilibrio no se fuerza.',
      'Encontrar el punto de {sinonimo} entre acción y espera parece ser la clave de este momento.',
      'Esta lectura sugiere avanzar con {sinonimo}: ni prisa, ni parálisis.',
    ],
    prudencia: [
      'El consejo principal es atender a {sinonimo} antes de tomar decisiones importantes.',
      'La consulta pide revisar {sinonimo} con honestidad. La lucidez es más valiosa que la velocidad.',
      'Cultivar {sinonimo} como base interna puede marcar la diferencia en este período.',
    ],
  },

  // ── PRÓXIMO PASO ──────────────────────────────────────────────────────────
  proximoPaso: {
    favorable: [
      'El siguiente paso natural es avanzar hacia {sinonimo}. La energía acompaña.',
      'Con {sinonimo} como brújula, el camino que sigue tiene claridad.',
      'Esta consulta cierra con una invitación a moverse hacia {sinonimo} con confianza.',
    ],
    equilibrio: [
      'El próximo paso implica trabajar con {sinonimo} de forma consciente y gradual.',
      'Integrar {sinonimo} en las acciones cotidianas puede ser el inicio de un cambio significativo.',
      'La consulta sugiere dar un paso desde {sinonimo}, sin apresurarse ni detenerse.',
    ],
    prudencia: [
      'Antes del siguiente paso, conviene fortalecer {sinonimo} como base interna.',
      'La lectura no apunta a una acción inmediata, sino a cultivar {sinonimo} primero.',
      'El próximo paso real puede ser interno: revisar {sinonimo} antes de actuar hacia afuera.',
    ],
  },
};

// Contexto elemental
const CONTEXTO_ELEMENTO = {
  Fuego:   'impulso y transformación',
  Agua:    'emoción y flujo',
  Aire:    'claridad y movimiento mental',
  Tierra:  'estabilidad y concreción',
};

const CONTEXTO_PALO = {
  'BÂTONS':  'acción, iniciativa y pasión',
  'COUPES':  'emoción, intuición y vínculos',
  'ÉPÉES':   'verdad, conflicto y discernimiento',
  'DENIERS': 'materia, trabajo y seguridad',
};


// ─────────────────────────────────────────────────────────────────────────────
// MAPA TEMA → COLUMNA EN cartas.json
// ─────────────────────────────────────────────────────────────────────────────

const MAPA_COLUMNA_TEMA = {
  amor:                       'amor',
  consultas_generales:        'general_sino',
  creatividad_proyectos:      'creatividad',
  crisis_transformacion:      'crisis_transformacion',
  decisiones_elecciones:      'decisiones',
  espiritualidad_crecimiento: 'espiritualidad',
  familia_hogar:              'familia_hogar',
  salud_bienestar:            'salud',
  trabajo_dinero:             'finanzas_trabajo',
  viajes_mudanzas:            'viajes_mudanzas',
};

const NOMBRES_TEMA = {
  amor:                       'amor y relaciones',
  consultas_generales:        'la consulta general',
  creatividad_proyectos:      'creatividad y proyectos',
  crisis_transformacion:      'crisis y transformación',
  decisiones_elecciones:      'la toma de decisiones',
  espiritualidad_crecimiento: 'espiritualidad y crecimiento',
  familia_hogar:              'familia y hogar',
  salud_bienestar:            'salud y bienestar',
  trabajo_dinero:             'finanzas y trabajo',
  viajes_mudanzas:            'viajes y mudanzas',
};

// Plantillas para bloques con datos reales de carta orientados al tema
const PLANTILLAS_TEMA = {
  carta_unica: [
    'En el ámbito de {tema}, {carta} señala: {interpretacion}',
    'Respecto a {tema}, la energía de {carta} indica: {interpretacion}',
    'La influencia de {carta} en {tema} apunta hacia: {interpretacion}',
  ],
  carta_principal: [
    'En el ámbito de {tema}, {carta} — la carta de mayor peso en esta consulta — señala: {interpretacion}',
    'La carta central de esta lectura, {carta}, orienta {tema} hacia: {interpretacion}',
    'Desde la posición más significativa, {carta} habla de {tema}: {interpretacion}',
  ],
  carta_secundaria: [
    'La presencia de {carta} añade una perspectiva importante: {interpretacion}',
    '{carta} complementa la lectura con este matiz: {interpretacion}',
    'Como elemento de contraste, {carta} señala: {interpretacion}',
  ],
  combinacion_tema: [
    'La relación entre {carta1} y {carta2} en el contexto de {tema}: {interpretacion_comb}',
    'La dinámica {tipo} entre {carta1} y {carta2} se expresa así en {tema}: {interpretacion_comb}',
    'Cuando {carta1} y {carta2} interactúan en torno a {tema}: {interpretacion_comb}',
  ],
  consejo_tema: [
    'El consejo de esta consulta para {tema} es: {interpretacion}',
    'El siguiente paso concreto en {tema} apunta hacia: {interpretacion}',
    'Lo que las cartas sugieren como acción en {tema}: {interpretacion}',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/** Selección aleatoria de un elemento de un array */
function _aleatorio(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Selecciona un sinónimo aleatorio de sinonimos.json para una categoría dada.
 * Si la categoría no existe, usa un valor de fallback.
 * @param {object} sinonimos — objeto completo de sinonimos.json
 * @param {string} categoria
 * @param {Set}    usados    — palabras ya usadas (anti-repetición)
 * @returns {string}
 */
function _seleccionarSinonimo(sinonimos, categoria, usados) {
  const raw = sinonimos[categoria];
  if (!raw) return categoria.replace(/_/g, ' ');

  // sinonimos.json puede tener arrays o strings — normalizar siempre a array
  let candidatos;
  if (Array.isArray(raw)) {
    candidatos = raw;
  } else if (typeof raw === 'string') {
    candidatos = raw.split(',').map(s => s.trim()).filter(Boolean);
  } else if (typeof raw === 'object') {
    candidatos = Object.values(raw).map(String);
  } else {
    return String(raw);
  }

  if (candidatos.length === 0) return categoria.replace(/_/g, ' ');

  // Filtrar usados para anti-repetición léxica
  const disponibles = candidatos.filter(s => !usados.has(s));
  const pool = disponibles.length > 0 ? disponibles : candidatos;
  const elegido = _aleatorio(pool);
  usados.add(elegido);
  return elegido;
}

/**
 * Rellena los slots de una plantilla con los valores proporcionados.
 * @param {string} plantilla
 * @param {object} slots — {carta, tendencia, sinonimo, carta1, carta2, elemento, palo}
 * @returns {string}
 */
function _rellenarPlantilla(plantilla, slots) {
  return plantilla
    .replace(/{carta}/g,     slots.carta     || '')
    .replace(/{tendencia}/g, slots.tendencia  || '')
    .replace(/{sinonimo}/g,  slots.sinonimo   || '')
    .replace(/{carta1}/g,    slots.carta1     || '')
    .replace(/{carta2}/g,    slots.carta2     || '')
    .replace(/{elemento}/g,  slots.elemento   || '')
    .replace(/{palo}/g,      slots.palo       || '');
}

/**
 * Calcula el score de la tirada (0–100).
 * @param {Array} cartasCompletas
 * @returns {number}
 */
function _calcularScore(cartasCompletas) {
  const n     = cartasCompletas.length;
  const pesos = _getPesos(n);
  let score   = 0;
  let total   = 0;

  cartasCompletas.forEach((carta, idx) => {
    const peso = (pesos[idx] || 1) / 100;
    // Valoración simple: recta = 1, invertida = 0.4
    const val  = carta.orientacion === 'invertida' ? 0.4 : 1.0;
    score += val * peso;
    total += peso;
  });

  return total > 0 ? Math.round((score / total) * 100) : 50;
}

/**
 * Determina el tono narrativo a partir del score.
 * @param {number} score
 * @returns {'favorable'|'equilibrio'|'prudencia'}
 */
function _calcularTono(score) {
  if (score >= 70) return 'favorable';
  if (score >= 40) return 'equilibrio';
  return 'prudencia';
}

/**
 * Aplica bonus/malus de combinaciones al score base.
 * @param {number} scoreBase
 * @param {Array}  pares — resultado de getTodosLosPares()
 * @returns {number} score ajustado (0–100 clamp)
 */
function _aplicarBonusCombinaciones(scoreBase, pares) {
  if (!pares || pares.length === 0) return scoreBase;
  let ajuste = 0;
  pares.forEach(({ combinacion }) => {
    if (combinacion && combinacion.tipo) {
      ajuste += BONUS_TIPO[combinacion.tipo] || 0;
    }
  });
  return Math.max(0, Math.min(100, scoreBase + ajuste));
}

/**
 * Detecta la mayoría elemental entre las cartas.
 * @param {Array} cartasCompletas
 * @returns {string|null} elemento dominante o null
 */
function _detectarElemento(cartasCompletas) {
  const conteo = {};
  cartasCompletas.forEach(c => {
    if (c.elemento) conteo[c.elemento] = (conteo[c.elemento] || 0) + 1;
  });
  const entries = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [elem, count] = entries[0];
  return count >= Math.ceil(cartasCompletas.length / 2) ? elem : null;
}

/**
 * Detecta el palo dominante entre arcanos menores.
 * @param {Array} cartasCompletas
 * @returns {string|null}
 */
function _detectarPalo(cartasCompletas) {
  const menores = cartasCompletas.filter(c => c.id > 22);
  if (menores.length === 0) return null;
  const conteo = {};
  menores.forEach(c => {
    if (c.palo) conteo[c.palo] = (conteo[c.palo] || 0) + 1;
  });
  const entries = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [palo, count] = entries[0];
  return count >= Math.ceil(menores.length / 2) ? palo : null;
}

/**
 * Detecta si predominan mayores o menores.
 * @param {Array} cartasCompletas
 * @returns {'mayores'|'menores'|'equilibrio'}
 */
function _detectarArcanosPredominio(cartasCompletas) {
  const mayores = cartasCompletas.filter(c => c.id <= 22).length;
  const menores = cartasCompletas.filter(c => c.id > 22).length;
  const n = cartasCompletas.length;
  if (mayores > n / 2) return 'mayores';
  if (menores > n / 2) return 'menores';
  return 'equilibrio';
}

/**
 * Detecta el par de combinación más relevante (si existe).
 * @param {Array} pares
 * @returns {{carta1, carta2, combinacion}|null}
 */
function _parMasRelevante(pares) {
  if (!pares || pares.length === 0) return null;
  const conCombinacion = pares.filter(p => p.combinacion);
  if (conCombinacion.length === 0) return null;
  // Prioridad: BLOQUEO > TENSION > RESONANCIA > SINERGIA > REFUERZO > NEUTRO
  const prioridad = ['BLOQUEO', 'TENSION', 'RESONANCIA', 'SINERGIA', 'REFUERZO', 'NEUTRO'];
  for (const tipo of prioridad) {
    const encontrado = conCombinacion.find(p => p.combinacion.tipo === tipo);
    if (encontrado) return encontrado;
  }
  return conCombinacion[0];
}

/**
 * Selecciona categorías de sinonimos.json relevantes para el tema de la tirada.
 * @param {object} sinonimos
 * @param {string} tema
 * @returns {Array<string>} — nombres de categorías
 */
function _categoriasPorTema(sinonimos, tema) {
  if (!sinonimos || typeof sinonimos !== 'object') return [];
  const claves = Object.keys(sinonimos);
  if (claves.length === 0) return [];
  if (!tema) return claves.slice(0, 20);
  // Buscar categorías que contengan el tema en su nombre
  const relevantes = claves.filter(k => k.toLowerCase().includes(tema.toLowerCase().split('_')[0]));
  return relevantes.length >= 3 ? relevantes : claves.slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR DE BLOQUES
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Obtiene el texto de interpretación de una carta para el tema activo.
 * @param {object} carta
 * @param {string} tema — valor de tiradas.json
 * @param {string} orientacion — 'recta' | 'invertida'
 * @returns {string} texto de interpretación o ''
 */
function _getInterpretacionTema(carta, tema, orientacion) {
  const columna = MAPA_COLUMNA_TEMA[tema] || tema;
  const sufijo  = orientacion === 'invertida' ? '_inv' : '_recta';
  return carta[`${columna}${sufijo}`] || '';
}

/**
 * Obtiene el próximo paso de una carta orientado al tema.
 * @param {object} carta
 * @param {string} orientacion
 * @returns {string}
 */
function _getProximoPaso(carta, orientacion) {
  const sufijo = orientacion === 'invertida' ? '_inv' : '_recta';
  return carta[`proximo_paso${sufijo}`] || '';
}

/**
 * Construye el bloque de interpretación de cada carta orientado al tema.
 * Usa los campos reales de cartas.json según el tema de la tirada.
 * @param {object} carta
 * @param {string} tema
 * @param {string} tono
 * @param {boolean} esPrincipal
 * @returns {string}
 */
function _bloqueTema(carta, tema, tono, esPrincipal) {
  if (!carta || !tema) return '';
  const interpretacion = _getInterpretacionTema(carta, tema, carta.orientacion);
  if (!interpretacion) return '';

  const nombreTema = NOMBRES_TEMA[tema] || tema;
  const pool = esPrincipal ? PLANTILLAS_TEMA.carta_principal : PLANTILLAS_TEMA.carta_secundaria;
  const plantilla = _aleatorio(pool);

  return plantilla
    .replace(/{tema}/g,           nombreTema)
    .replace(/{carta}/g,          carta.arcano_es || '')
    .replace(/{interpretacion}/g, interpretacion);
}

/**
 * Construye el bloque de combinación orientado al tema.
 * Usa los campos reales de la combinación más relevante.
 * @param {object|null} parRelevante
 * @param {string} tema
 * @returns {string}
 */
function _bloqueCombinacionTema(parRelevante, tema) {
  if (!parRelevante?.combinacion) return '';
  const comb = parRelevante.combinacion;
  const nombreTema = NOMBRES_TEMA[tema] || tema;

  // Usar interpretacion real de la combinación si existe
  const interpComb = comb.interpretacion || comb.dinamica || '';
  if (!interpComb) return '';

  const plantilla = _aleatorio(PLANTILLAS_TEMA.combinacion_tema);
  return plantilla
    .replace(/{tema}/g,              nombreTema)
    .replace(/{carta1}/g,            parRelevante.carta1?.arcano_es || '')
    .replace(/{carta2}/g,            parRelevante.carta2?.arcano_es || '')
    .replace(/{tipo}/g,              (comb.tipo || '').toLowerCase())
    .replace(/{interpretacion_comb}/g, interpComb);
}

/**
 * Construye el bloque de consejo concreto usando próximo_paso de la carta principal.
 * @param {object} cartaPrincipal
 * @param {string} tema
 * @returns {string}
 */
function _bloqueConsejoTema(cartaPrincipal, tema) {
  if (!cartaPrincipal || !tema) return '';
  const proximoPaso = _getProximoPaso(cartaPrincipal, cartaPrincipal.orientacion);
  if (!proximoPaso) return '';

  const nombreTema = NOMBRES_TEMA[tema] || tema;
  const plantilla  = _aleatorio(PLANTILLAS_TEMA.consejo_tema);
  return plantilla
    .replace(/{tema}/g,           nombreTema)
    .replace(/{carta}/g,          cartaPrincipal.arcano_es || '')
    .replace(/{interpretacion}/g, proximoPaso);
}

/**
 * Construye el bloque de situación actual.
 */
function _bloqueS1(cartaPrincipal, tono, sinonimos, categorias, usados) {
  if (!cartaPrincipal || !categorias || categorias.length === 0) return '';
  const plantilla  = _aleatorio(PLANTILLAS.situacion[tono]);
  const sinonimoK  = _aleatorio(categorias);
  const sinonimo   = _seleccionarSinonimo(sinonimos, sinonimoK, usados);
  const tendencia  = cartaPrincipal.orientacion === 'invertida'
    ? (cartaPrincipal.tendencia_inv || '')
    : (cartaPrincipal.tendencia_recta || '');

  return _rellenarPlantilla(plantilla, {
    carta:     cartaPrincipal.arcano_es,
    tendencia,
    sinonimo,
  });
}

/**
 * Construye el bloque de tensión/oportunidad.
 * Siempre menciona la relación entre cartas, tenga o no combinación específica.
 * Si hay combinación → usa plantillas por tipo.
 * Si no hay combinación pero sí 2+ cartas → describe la energía conjunta de ambas.
 */
function _bloqueS2(parRelevante, tono, sinonimos, categorias, usados) {
  if (!categorias || categorias.length === 0) return '';
  const sinonimoK = _aleatorio(categorias);
  const sinonimo  = _seleccionarSinonimo(sinonimos, sinonimoK, usados);

  // Si hay combinación específica, usar las plantillas por tipo
  if (parRelevante?.combinacion?.tipo) {
    const tipoPlantillas = parRelevante.combinacion.tipo;
    const pool = PLANTILLAS.tension[tipoPlantillas] || PLANTILLAS.tension.ninguna;
    const plantilla = _aleatorio(pool);
    return _rellenarPlantilla(plantilla, {
      carta1:  parRelevante.carta1?.arcano_es || '',
      carta2:  parRelevante.carta2?.arcano_es || '',
      sinonimo,
    });
  }

  // Si hay dos cartas pero sin combinación específica, construir frase de interacción
  // con los nombres reales de las cartas para que siempre se mencione su relación
  if (parRelevante?.carta1 && parRelevante?.carta2) {
    const plantillasSinComb = [
      'La presencia conjunta de {carta1} y {carta2} en esta lectura introduce {sinonimo} como eje compartido. Cada una aporta su energía desde su propia naturaleza.',
      '{carta1} y {carta2} coexisten en la consulta. Su encuentro abre un espacio de {sinonimo} que merece atención antes de actuar.',
      'La relación entre {carta1} y {carta2} no señala una oposición directa, pero sí una llamada a integrar {sinonimo} en el proceso.',
    ];
    const plantilla = _aleatorio(plantillasSinComb);
    return _rellenarPlantilla(plantilla, {
      carta1:  parRelevante.carta1.arcano_es || '',
      carta2:  parRelevante.carta2.arcano_es || '',
      sinonimo,
    });
  }

  // Fallback si no hay par — genérico
  const pool = PLANTILLAS.tension.ninguna;
  const plantilla = _aleatorio(pool);
  return _rellenarPlantilla(plantilla, { sinonimo });
}

/**
 * Construye el bloque de consejo.
 */
function _bloqueS3(tono, sinonimos, categorias, usados) {
  const plantilla = _aleatorio(PLANTILLAS.consejo[tono]);
  const sinonimoK = _aleatorio(categorias);
  const sinonimo  = _seleccionarSinonimo(sinonimos, sinonimoK, usados);
  return _rellenarPlantilla(plantilla, { sinonimo });
}

/**
 * Construye el bloque de próximo paso.
 */
function _bloqueS4(tono, sinonimos, categorias, usados) {
  const plantilla = _aleatorio(PLANTILLAS.proximoPaso[tono]);
  const sinonimoK = _aleatorio(categorias);
  const sinonimo  = _seleccionarSinonimo(sinonimos, sinonimoK, usados);
  return _rellenarPlantilla(plantilla, { sinonimo });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTA DE CONTEXTO (elemento / palo / arcanos predominantes)
// ─────────────────────────────────────────────────────────────────────────────

function _buildNotaContexto(cartasCompletas) {
  const predominio = _detectarArcanosPredominio(cartasCompletas);
  const elemento   = _detectarElemento(cartasCompletas);
  const palo       = _detectarPalo(cartasCompletas);

  const partes = [];

  if (predominio === 'mayores') {
    partes.push('La presencia predominante de Arcanos Mayores indica un momento de aprendizaje profundo o influencias que van más allá de lo cotidiano.');
  } else if (predominio === 'menores') {
    partes.push('La presencia predominante de Arcanos Menores sitúa esta lectura en el terreno de los asuntos prácticos y cotidianos.');
  }

  if (elemento && CONTEXTO_ELEMENTO[elemento]) {
    partes.push(`El elemento ${elemento} domina la consulta, subrayando una energía de ${CONTEXTO_ELEMENTO[elemento]}.`);
  }

  if (palo && CONTEXTO_PALO[palo]) {
    partes.push(`La abundancia de ${palo} orienta la lectura hacia ${CONTEXTO_PALO[palo]}.`);
  }

  return partes.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera la conclusión narrativa completa de una tirada.
 * @param {object}   tiradaActual    — objeto tirada con .tema
 * @param {Array}    cartasCompletas — [{…carta, orientacion}]
 * @param {Array}    pares           — resultado de getTodosLosPares() o null
 * @returns {Promise<string>} HTML
 */
export async function generarConclusion(tiradaActual, cartasCompletas, pares) {
  // Guard: sin cartas no hay conclusión
  if (!cartasCompletas || cartasCompletas.length === 0) {
    return getFallbackNarrativo(null);
  }

  // Cargar sinónimos
  let sinonimos = {};
  try {
    const resultado = await getSinonimos();
    // getSinonimos puede devolver array o objeto — normalizar a objeto
    if (resultado && typeof resultado === 'object' && !Array.isArray(resultado)) {
      sinonimos = resultado;
    } else if (Array.isArray(resultado)) {
      // Si devuelve array de objetos {categoria, valores}, convertir
      resultado.forEach(item => {
        if (item.categoria) sinonimos[item.categoria] = item.valores || item.sinonimos || item.palabras || [];
      });
    }
  } catch (_) {
    // CONDICIÓN A — sinonimos.json no cargó (error de red o JSON corrupto):
    // Usar set mínimo hardcodeado para construir texto sin depender del archivo.
    sinonimos = _SINONIMOS_FALLBACK;
  }

  // Si sinonimos está vacío tras la carga, usar fallback mínimo hardcodeado
  if (Object.keys(sinonimos).length === 0) {
    sinonimos = _SINONIMOS_FALLBACK;
  }

  const n             = cartasCompletas?.length || 0;
  const tema          = tiradaActual?.tema || '';
  const usados        = new Set(); // anti-repetición léxica
  const categorias    = _categoriasPorTema(sinonimos, tema);

  // Calcular score y tono
  const scoreBase = _calcularScore(cartasCompletas);
  const score     = _aplicarBonusCombinaciones(scoreBase, pares);
  const tono      = _calcularTono(score);

  // Carta principal (peso mayor = posición 0)
  // CONDICIÓN B — si la carta no tiene los campos esperados, usar getFallbackNarrativo()
  const cartaPrincipal = cartasCompletas[0];
  if (!cartaPrincipal || (!cartaPrincipal.arcano_es && !cartaPrincipal.tendencia_recta)) {
    return getFallbackNarrativo(cartaPrincipal);
  }

  // Par más relevante
  // Si ningún par tiene combinación, construir un par "vacío" con las dos primeras cartas
  // para que _bloqueS2 pueda mencionar su relación nominal
  let parRelevante = _parMasRelevante(pares);
  if (!parRelevante && n >= 2) {
    parRelevante = {
      carta1:      cartasCompletas[0],
      carta2:      cartasCompletas[1],
      combinacion: null,
    };
  }

  // Construir bloques según longitud de tirada
  const bloques = [];

  // ── BLOQUE 1: Situación actual con datos reales de la carta principal ────
  // Si hay tema, usar interpretación real del campo; si no, usar plantilla genérica
  if (tema) {
    const bloqueTemaPrincipal = _bloqueTema(cartaPrincipal, tema, tono, true);
    if (bloqueTemaPrincipal) {
      bloques.push(bloqueTemaPrincipal);
    } else {
      bloques.push(_bloqueS1(cartaPrincipal, tono, sinonimos, categorias, usados));
    }
  } else {
    bloques.push(_bloqueS1(cartaPrincipal, tono, sinonimos, categorias, usados));
  }

  // ── BLOQUE 2: Cartas secundarias orientadas al tema (si hay 2+ cartas) ──
  if (n >= 2 && tema) {
    // Mostrar interpretación de cada carta secundaria (máx 2 para no saturar)
    const secundarias = cartasCompletas.slice(1, Math.min(n, 3));
    secundarias.forEach(carta => {
      const bloque = _bloqueTema(carta, tema, tono, false);
      if (bloque) bloques.push(bloque);
    });
  }

  // ── BLOQUE 3: Combinación más relevante orientada al tema ────────────────
  if (n >= 2) {
    if (tema && parRelevante?.combinacion) {
      const bloqueComb = _bloqueCombinacionTema(parRelevante, tema);
      if (bloqueComb) {
        bloques.push(bloqueComb);
      } else {
        bloques.push(_bloqueS2(parRelevante, tono, sinonimos, categorias, usados));
      }
    } else if (n >= 2) {
      bloques.push(_bloqueS2(parRelevante, tono, sinonimos, categorias, usados));
    }
  }

  // ── BLOQUE 4: Consejo concreto usando próximo_paso de la carta principal ─
  if (tema) {
    const bloqueConsejo = _bloqueConsejoTema(cartaPrincipal, tema);
    if (bloqueConsejo) {
      bloques.push(bloqueConsejo);
    } else if (n >= 3 || (n >= 1 && tono !== 'equilibrio')) {
      bloques.push(_bloqueS3(tono, sinonimos, categorias, usados));
    }
  } else if (n >= 3 || (n >= 1 && tono !== 'equilibrio')) {
    bloques.push(_bloqueS3(tono, sinonimos, categorias, usados));
  }

  // ── BLOQUE 5: Próximo paso genérico (si hay 4+ cartas y no hay tema) ────
  if (n >= 4 && !tema) {
    bloques.push(_bloqueS4(tono, sinonimos, categorias, usados));
  }

  // Nota de contexto (elemento/palo/arcanos) — si hay suficientes cartas
  const notaContexto = n >= 2 ? _buildNotaContexto(cartasCompletas) : '';

  // Construir HTML — cada bloque en su propio div con separación visual
  const parrafos = bloques
    .filter(Boolean)
    .map(t => {
      // Si el texto es largo (>200 chars), dividir en párrafos por punto y seguido
      if (t.length > 200) {
        // Dividir por frases largas manteniendo el punto
        const frases = t.split(/(?<=\. )(?=[A-ZÁÉÍÓÚ¿"«])/).filter(Boolean);
        if (frases.length > 1) {
          // Agrupar en párrafos de 2-3 frases
          const grupos = [];
          for (let i = 0; i < frases.length; i += 2) {
            grupos.push(frases.slice(i, i + 2).join(''));
          }
          return `<div class="conclusion-bloque">${grupos.map(g => `<p>${g}</p>`).join('')}</div>`;
        }
      }
      return `<div class="conclusion-bloque"><p>${t}</p></div>`;
    })
    .join('<div class="conclusion-separador" aria-hidden="true">✦</div>');

  const notaHTML = notaContexto
    ? `<p class="conclusion-nota-contexto text-muted" style="font-size:0.88rem; margin-top:var(--space-4); font-style:italic; border-top: 1px solid rgba(201,168,76,0.15); padding-top: var(--space-3);">${notaContexto}</p>`
    : '';

  return `<div class="conclusion-texto">${parrafos}${notaHTML}</div>`;
}

/**
 * Regenera la conclusión con nueva selección aleatoria de sinónimos.
 * Misma lógica que generarConclusion — la aleatoriedad garantiza variedad.
 * @param {object} tiradaActual
 * @param {Array}  cartasCompletas
 * @param {Array}  pares
 * @returns {Promise<string>} HTML
 */
export async function regenerarConclusion(tiradaActual, cartasCompletas, pares) {
  return generarConclusion(tiradaActual, cartasCompletas, pares);
}

// ─────────────────────────────────────────────────────────────────────────────
// ── FALLBACKS DE EMERGENCIA ──
// Solo se invocan cuando los datos normales no están disponibles.
// NUNCA invocar como alternativa a la lógica normal cuando los datos sí están disponibles.
//
// CONDICIÓN A — sinonimos.json no cargó (error de red o JSON corrupto):
//   → Usar _SINONIMOS_FALLBACK (set mínimo hardcodeado)
//   → Es el ÚNICO caso donde texto hardcodeado reemplaza a sinonimos.json
//
// CONDICIÓN B — carta.json cargó pero una carta concreta no tiene los campos esperados
//   (campo vacío, null o ausente):
//   → Usar getFallbackNarrativo(carta) solo para ese campo
//   → El resto de la conclusión sigue normalmente con los datos que sí existen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set mínimo de sinónimos hardcodeado — solo para CONDICIÓN A.
 * Permite que generarConclusion() construya texto aunque sinonimos.json no esté disponible.
 * NUNCA usar cuando sinonimos.json está disponible.
 */
const _SINONIMOS_FALLBACK = {
  claridad:       ['lucidez', 'claridad', 'comprensión', 'discernimiento'],
  cambio:         ['transformación', 'cambio', 'renovación', 'transición'],
  equilibrio:     ['balance', 'equilibrio', 'armonía', 'integración'],
  accion:         ['acción', 'movimiento', 'iniciativa', 'impulso'],
  reflexion:      ['reflexión', 'introspección', 'pausa', 'contemplación'],
  confianza:      ['confianza', 'fe', 'seguridad', 'apertura'],
  creatividad:    ['creatividad', 'inspiración', 'expresión', 'originalidad'],
  paciencia:      ['paciencia', 'espera', 'constancia', 'perseverancia'],
  apertura:       ['apertura', 'receptividad', 'flexibilidad', 'adaptación'],
  crecimiento:    ['crecimiento', 'expansión', 'desarrollo', 'avance'],
};

/**
 * Genera texto de emergencia cuando una carta no tiene los campos de data esperados.
 * Devuelve un párrafo de fallback según el tipo/palo de la carta.
 *
 * Solo invocar para CONDICIÓN B: campos de carta vacíos, null o ausentes.
 * NUNCA invocar como alternativa a la lógica normal cuando sinonimos.json está disponible.
 *
 * @param {object|null} carta — objeto de carta (puede ser null si no hay ninguna)
 * @returns {string} HTML
 */
export function getFallbackNarrativo(carta) {
  let texto;

  if (!carta) {
    // Sin carta en absoluto — mensaje genérico mínimo
    texto = 'Las cartas de esta consulta invitan a una reflexión personal. Lo que has sentido durante la lectura forma parte de la interpretación.';
  } else if (!carta.id) {
    // Carta sin ID — sin palo determinable
    const nombre = carta.arcano_es || 'esta carta';
    texto = `La energía de ${nombre} marca el tono de esta consulta. Reflexiona sobre lo que ha despertado en ti durante la lectura.`;
  } else if (carta.id <= 22) {
    // Arcano Mayor (ID 1–22)
    const nombre = carta.arcano_es || 'este arcano mayor';
    texto = `Este arcano mayor señala un momento de aprendizaje profundo. La energía de ${nombre} trae consigo una invitación a examinar las fuerzas que guían tu camino más allá de lo cotidiano.`;
  } else if (carta.id <= 36) {
    // Arcano Menor — Bâtons (ID 23–36)
    const nombre = carta.arcano_es || 'esta carta';
    texto = `La energía activa de ${nombre} impulsa hacia la acción y el movimiento. Los palos de Bâtons señalan el fuego de la voluntad y la capacidad de transformar la iniciativa en resultado.`;
  } else if (carta.id <= 50) {
    // Arcano Menor — Coupes (ID 37–50)
    const nombre = carta.arcano_es || 'esta carta';
    texto = `La energía emocional de ${nombre} invita a explorar los sentimientos y los vínculos. Los palos de Coupes hablan del mundo interior, de la intuición y de lo que fluye entre las personas.`;
  } else if (carta.id <= 64) {
    // Arcano Menor — Épées (ID 51–64)
    const nombre = carta.arcano_es || 'esta carta';
    texto = `La claridad mental de ${nombre} ilumina los pensamientos y las decisiones. Los palos de Épées señalan la necesidad de discernir con honestidad, aunque ello implique enfrentar verdades incómodas.`;
  } else {
    // Arcano Menor — Deniers (ID 65–78)
    const nombre = carta.arcano_es || 'esta carta';
    texto = `El aspecto material de ${nombre} señala hacia la realidad concreta. Los palos de Deniers invitan a prestar atención a lo tangible: el trabajo, los recursos y la construcción paso a paso.`;
  }

  return `<div class="conclusion-texto"><p>${texto}</p></div>`;
}
