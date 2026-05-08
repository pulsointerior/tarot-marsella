/**
 * @file render-carta.js
 * @description Módulo compartido de renderizado de cartas (introducido en Fase 6).
 *   Centraliza el renderizado de las 6 secciones de una carta, eliminando la
 *   duplicación que existía entre resultado.js y cards.js en fases anteriores.
 *
 * @architecture LEAF MODULE — no importa de cards.js ni resultado.js.
 *   Grafo de dependencias: data.js ← images.js ← render-carta.js
 *
 * Modos de renderizado:
 *   'arcanos'   → Sección 4 muestra TODOS los temas; Sección 6 expandible (cerrada por defecto).
 *   'resultado' → Sección 4 muestra SOLO temaActivo;  Sección 6 expandible (cerrada por defecto).
 *
 * Orden de secciones: S1 Identificación · S2 Correspondencias (expandible) ·
 *   S3 Manifestación Externa (expandible) · S6 Crecimiento Personal (expandible) ·
 *   S4 Interpretación por Área · S5 Acción y Contexto
 *
 * @dependencies
 *   - data.js — getPosicionCombinacion() (para cálculo de posición en combinaciones)
 *
 * @exports renderSeccionesCarta, renderizarPreviewCarta, getBadgeTipoCarta
 */

import { getPosicionCombinacion } from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el valor de un campo orientado (sufijo _recta / _inv).
 * @param {object} carta
 * @param {string} base        — nombre base del campo, ej: 'tendencia'
 * @param {string} orientacion — 'recta' | 'invertida'
 * @returns {string} valor del campo o cadena vacía si no existe
 */
function _campo(carta, base, orientacion) {
  const sufijo = orientacion === 'invertida' ? '_inv' : '_recta';
  return carta[base + sufijo] || '';
}

/**
 * Formatea un valor de campo para mostrar en web.
 * Arrays → unidos con comas. Valores falsy → '—'.
 * @param {*} valor
 * @returns {string}
 */
function _fmt(valor) {
  if (!valor || valor === 'null') return '—';
  if (Array.isArray(valor)) return valor.join(', ');
  return String(valor);
}

/**
 * Genera HTML de un ítem dato con layout label + valor.
 * @param {string} label
 * @param {string} valor
 * @returns {string} HTML
 */
function _itemDato(label, valor) {
  const v = _fmt(valor);
  return `
    <div class="dato-item">
      <span class="dato-label">${label}</span>
      <span class="dato-valor">${v}</span>
    </div>`;
}

/**
 * Genera HTML de un campo simple para el modal de arcanos (etiqueta + valor).
 * Retorna cadena vacía si no hay valor, para evitar filas vacías.
 * @param {string} etiqueta
 * @param {string|null} valor
 * @returns {string} HTML o ''
 */
function _campoModal(etiqueta, valor) {
  if (!valor) return '';
  return `<div class="modal-campo">
    <span class="modal-campo-etiqueta">${etiqueta}</span>
    <span class="modal-campo-valor">${valor}</span>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIONES PRIVADAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SECCIÓN 1 — Identificación: imagen, badges, nombre, orientación, posición en tirada.
 * @param {object} carta
 * @param {string} orientacion — 'recta' | 'invertida'
 * @param {object|null} posicion — objeto posición de la tirada, o null
 * @param {number} mazo
 * @returns {string} HTML
 */
function _renderSeccion1(carta, orientacion, posicion = null, mazo = 1) {
  const esInvertida = orientacion === 'invertida';
  const badgeOrientacion = esInvertida
    ? `<span class="badge-invertida"><i class="ph ph-arrow-down" aria-hidden="true"></i> Invertida</span>`
    : `<span class="badge-recta"><i class="ph ph-arrow-up" aria-hidden="true"></i> Recta</span>`;

  const badgeTipo = carta.tipo === 'arcano_mayor'
    ? `<span class="badge-tipo badge-mayor">Arcano Mayor</span>`
    : `<span class="badge-tipo badge-menor">Arcano Menor${carta.palo ? ' · ' + carta.palo : ''}</span>`;

  const tendencia = _campo(carta, 'tendencia', orientacion);
  const imgSrc    = `assets/images/mazo-${mazo}/${carta.slug}-full.jpg`;
  const mazoClass = `mazo-${mazo}`;
  const numero    = carta.numero_original !== null && carta.numero_original !== undefined
    ? carta.numero_original : '';

  const imgHTML = `
    <div class="carta-imagen-wrapper">
      <img
        src="${imgSrc}"
        alt="${carta.arcano_es}"
        class="carta-imagen-full"
        loading="lazy"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      >
      <div
        class="placeholder-carta-full ${mazoClass}"
        data-numero="${numero}"
        data-nombre="${carta.arcano_es}"
        style="display:none;"
        aria-hidden="true"
      ></div>
    </div>`;

  const posNombre = posicion ? posicion.nombre || posicion.posicion || '' : '';
  const posDesc   = posicion ? posicion.descripcion || posicion.significado || '' : '';

  return `
    <div class="seccion-identificacion">
      ${imgHTML}
      ${posNombre ? `<p class="posicion-label text-muted">${posNombre}</p>` : ''}
      ${posDesc   ? `<p class="posicion-descripcion">${posDesc}</p>` : ''}
      <div class="carta-meta cluster">
        ${numero ? `<span class="carta-numero">Nº ${numero}</span>` : ''}
        <h2 class="carta-nombre">${carta.arcano_es}</h2>
        ${badgeTipo}
        ${badgeOrientacion}
      </div>
      ${tendencia ? `
        <div class="carta-tendencia-bloque">
          <span class="carta-tendencia-label">TENDENCIA DE LA RESPUESTA:</span>
          <p class="carta-tendencia"><em>${tendencia}</em></p>
        </div>` : ''}
      ${(carta.numerologia_clasica && carta.numerologia_clasica !== 'null') ? `
        <div class="carta-numerologia-bloque datos-grid">
          <div class="dato-item"><span class="dato-label">NUMEROLOGÍA CLÁSICA</span><span class="dato-valor">${carta.numerologia_clasica}</span></div>
          <div class="dato-item"><span class="dato-label">INFLUENCIA NUMEROLÓGICA</span><span class="dato-valor">${carta.influencia_numerologia || ''}</span></div>
        </div>` : ''}
    </div>`;
}

/**
 * SECCIÓN 2 — Correspondencias Simbólicas (expandible, cerrado por defecto).
 * Muestra: elemento, regencia, manifestación, numerología clásica, influencia numerológica,
 *          numerología moderna, chakra, mantra, piedras, aromas, aceites, cábala, color, planta.
 * Si no hay ningún campo, no renderiza nada.
 * <!-- v26: signo, planeta, numeros eliminados del esquema.
 *      Sustituidos por regencia, manifestacionregencia, numerologia_clasica,
 *      influencia_numerologia, numerologia_moderna. -->
 * @param {object} carta
 * @returns {string} HTML o ''
 */
function _renderSeccion2(carta, modo) {
  const campos = [
    { label: 'Elemento',                    valor: carta.elemento },
    { label: 'Regencia',                    valor: carta.regencia },
    { label: 'Manifestación de Regencia',   valor: carta.manifestacionregencia },
    { label: 'Numerología Moderna',         valor: carta.numerologia_moderna },
    { label: 'Chakra',                      valor: carta.chakra },
    { label: 'Mantra',                      valor: carta.mantra },
    { label: 'Piedras y Cristales',         valor: carta.piedras_cristales },
    { label: 'Aromas',                      valor: carta.aroma_incienso },
    { label: 'Aceites y Hierbas',           valor: carta.aceites_hierbas },
    { label: 'Correspondencia Cabalística', valor: carta.cabala },
    { label: 'Color Vibracional',           valor: carta.color },
    { label: 'Planta',                      valor: carta.planta },
  ].filter(c => c.valor);

  if (campos.length === 0) return '';

  const panelId = `simbolicas-${carta.id}`;
  const items   = campos.map(c => _itemDato(c.label, c.valor)).join('');

  return `
    <div class="seccion-expandible">
      <button
        class="toggle-expandible"
        aria-expanded="false"
        aria-controls="${panelId}"
        onclick="window.toggleExpandible && window.toggleExpandible(this)"
      >
        <span>Correspondencias Modernas</span>
        <i class="ph ph-caret-up toggle-icon" aria-hidden="true"></i>
      </button>
      <div class="panel-expandible" id="${panelId}">
        <div class="datos-grid">${items}</div>
      </div>
    </div>`;
}

/**
 * SECCIÓN 3 — Manifestación Externa.
 * Campos: palabras clave, características, presencia, esencia, perfil psicológico.
 * @param {object} carta
 * @param {string} orientacion
 * @returns {string} HTML
 */
function _renderSeccion3(carta, orientacion, modo) {
  const items = [
    _itemDato('Palabras Clave',     _campo(carta, 'palabras_clave', orientacion)),
    _itemDato('Características',    _fmt(carta.caracteristicas)),
    _itemDato('Presencia',          _campo(carta, 'presencia', orientacion)),
    _itemDato('Esencia',            _campo(carta, 'esencia', orientacion)),
    _itemDato('Perfil Psicológico', _campo(carta, 'aspectos_personalidad', orientacion)),
  ].join('');

  const panelId = `manifestacion-${carta.id}`;

  return `
    <div class="seccion-expandible">
      <button
        class="toggle-expandible"
        aria-expanded="${modo === 'resultado' ? 'false' : 'true'}"
        aria-controls="${panelId}"
        onclick="window.toggleExpandible && window.toggleExpandible(this)"
      >
        <span>Manifestación Externa</span>
        <i class="ph ${modo === 'resultado' ? 'ph-caret-down' : 'ph-caret-up'} toggle-icon" aria-hidden="true"></i>
      </button>
      <div class="panel-expandible" id="${panelId}"${modo === 'resultado' ? ' hidden' : ''}>
        <div class="datos-grid">${items}</div>
      </div>
    </div>`;
}

/**
 * SECCIÓN 4 (modo resultado) — Interpretación SOLO del tema activo de la tirada.
 * @param {object} carta
 * @param {string} orientacion
 * @param {string} temaActivo — clave exacta del JSON, ej: 'amor'
 * @returns {string} HTML o ''
 */
function _renderSeccion4Tema(carta, orientacion, temaActivo) {
  if (!temaActivo) return '';

  // v26: mapa tema (tiradas.json) → columna base (cartas.json)
  const MAPA_COLUMNA = {
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
  const columna = MAPA_COLUMNA[temaActivo] || temaActivo;

  const sufijo = orientacion === 'invertida' ? '_inv' : '_recta';
  const valor  = carta[`${columna}${sufijo}`];
  if (!valor) return '';

  const NOMBRES_TEMA = {
    amor:                       'Amor y Relaciones',
    consultas_generales:        'Consulta General',
    creatividad_proyectos:      'Creatividad y Proyectos',
    crisis_transformacion:      'Crisis y Transformación',
    decisiones_elecciones:      'Decisiones',
    espiritualidad_crecimiento: 'Espiritualidad',
    familia_hogar:              'Familia y Hogar',
    salud_bienestar:            'Salud y Bienestar',
    trabajo_dinero:             'Finanzas y Trabajo',
    viajes_mudanzas:            'Viajes y Mudanzas',
  };
  const nombreTema = NOMBRES_TEMA[temaActivo] || temaActivo;

  return `
    <div class="seccion-tema">
      <h3 class="seccion-titulo">Interpretación — ${nombreTema}</h3>
      <p class="texto-tema">${_fmt(valor)}</p>
    </div>`;
}

/**
 * SECCIÓN 4 (modo arcanos) — Interpretación de TODOS los temas visibles.
 * @param {object} carta
 * @param {string} orientacion
 * @returns {string} HTML o ''
 */
function _renderSeccion4Todos(carta, orientacion) {
  const sufijo = orientacion === 'invertida' ? '_inv' : '_recta';

  const temas = [
    { etiqueta: 'Amor y Relaciones',       campo: `amor${sufijo}` },
    { etiqueta: 'Consultas Generales',     campo: `general_sino${sufijo}` },
    { etiqueta: 'Creatividad y Proyectos', campo: `creatividad${sufijo}` },
    { etiqueta: 'Crisis y Transformación', campo: `crisis_transformacion${sufijo}` },
    { etiqueta: 'Toma de Decisiones',      campo: `decisiones${sufijo}` },
    { etiqueta: 'Espiritualidad',          campo: `espiritualidad${sufijo}` },
    { etiqueta: 'Familia y Hogar',         campo: `familia_hogar${sufijo}` },
    { etiqueta: 'Salud y Bienestar',       campo: `salud${sufijo}` },
    { etiqueta: 'Finanzas y Trabajo',      campo: `finanzas_trabajo${sufijo}` },
    { etiqueta: 'Viajes y Mudanzas',       campo: `viajes_mudanzas${sufijo}` },
  ];

  const campos = temas.map(t => _campoModal(t.etiqueta, carta[t.campo])).join('');
  if (!campos) return '';

  return `
    <div class="modal-seccion">
      <h3 class="modal-seccion-titulo">Interpretación por Área</h3>
      ${campos}
    </div>`;
}

/**
 * SECCIÓN 5 — Acción y Contexto.
 * Campos: próximo paso, advertencia, tiempo, lugar, dinámica.
 * @param {object} carta
 * @param {string} orientacion
 * @returns {string} HTML
 */
function _renderSeccion5(carta, orientacion) {
  const items = [
    _itemDato('Próximo Paso Recomendado', _campo(carta, 'proximo_paso', orientacion)),
    _itemDato('Advertencia Importante',   _campo(carta, 'alerta', orientacion)),
    _itemDato('Tiempo y Momento',         _campo(carta, 'tiempo', orientacion)),
    _itemDato('Lugar o Contexto',         _campo(carta, 'lugar', orientacion)),
    _itemDato('Dinámica de la Situación', _campo(carta, 'dinamica', orientacion)),
  ].join('');

  return `
    <div class="seccion-accion">
      <h3 class="seccion-titulo">Acción y Contexto</h3>
      <div class="datos-grid">${items}</div>
    </div>`;
}

/**
 * SECCIÓN 6 — Crecimiento Personal.
 * En modo 'resultado': expandible (cerrado por defecto).
 * En modo 'arcanos':   siempre visible.
 * Si no hay meditación ni actividades, no renderiza nada.
 *
 * @param {object} carta
 * @param {string} orientacion
 * @param {boolean} expandible — true en modo resultado, false en modo arcanos
 * @returns {string} HTML o ''
 */
function _renderSeccion6(carta, orientacion, modo) {
  const meditacion  = orientacion === 'invertida'
    ? carta.recomendaciones_meditacion_inv
    : carta.recomendaciones_meditacion;
  const actividades = orientacion === 'invertida'
    ? carta.actividades_sugeridas_inv
    : carta.actividades_sugeridas;

  if (!meditacion && !actividades) return '';

  const items = [
    meditacion  ? _itemDato('Meditación Recomendada', meditacion)  : '',
    actividades ? _itemDato('Actividades Sugeridas',  actividades) : '',
  ].join('');

  const panelId = `crecimiento-${carta.id}`;
  return `
    <div class="seccion-expandible">
      <button
        class="toggle-expandible"
        aria-expanded="${modo === 'resultado' ? 'false' : 'true'}"
        aria-controls="${panelId}"
        onclick="window.toggleExpandible && window.toggleExpandible(this)"
      >
        <span>Crecimiento Personal</span>
        <i class="ph ${modo === 'resultado' ? 'ph-caret-down' : 'ph-caret-up'} toggle-icon" aria-hidden="true"></i>
      </button>
      <div class="panel-expandible" id="${panelId}"${modo === 'resultado' ? ' hidden' : ''}>
        <div class="datos-grid">${items}</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza las 6 secciones completas de una carta según el modo y opciones indicadas.
 * Es el punto de entrada principal de este módulo.
 *
 * @param {object} carta — objeto de cartas.json con todos sus campos
 * @param {object} [options]
 * @param {string|null} [options.temaActivo=null]
 *   null → mostrar todos los temas (modo arcanos)
 *   string → mostrar solo ese tema (modo resultado), ej: 'amor'
 * @param {string} [options.orientacion='recta'] — 'recta' | 'invertida'
 * @param {'arcanos'|'resultado'} [options.modo='arcanos']
 *   'resultado' → sección 4 con tema único
 *   'arcanos'   → sección 4 con todos los temas
 *   Sección 6 (Crecimiento Personal) es siempre expandible en ambos modos.
 * @param {object|null} [options.posicion=null]
 *   Objeto posición de la tirada con nombre y descripción (solo en modo resultado)
 * @param {number} [options.mazo=1] — 1 | 2 | 3
 * @returns {string} HTML concatenado de las 6 secciones
 */
export function renderSeccionesCarta(carta, {
  temaActivo  = null,
  orientacion = 'recta',
  modo        = 'arcanos',
  posicion    = null,
  mazo        = 1,
} = {}) {
  const s1 = _renderSeccion1(carta, orientacion, posicion, mazo);
  const s2 = _renderSeccion2(carta, modo);
  const s3 = _renderSeccion3(carta, orientacion, modo);
  const s6 = _renderSeccion6(carta, orientacion, modo); // Crecimiento Personal — ahora justo tras Manifestación Externa
  const s4 = (modo === 'resultado' && temaActivo)
    ? _renderSeccion4Tema(carta, orientacion, temaActivo)
    : _renderSeccion4Todos(carta, orientacion);
  const s5 = _renderSeccion5(carta, orientacion);

  return `${s1}${s2}${s3}${s6}${s4}${s5}`;
}

/**
 * Renderiza el preview compacto de una carta: thumbnail + nombre + badge de orientación.
 * Usado en selection.js (indicar-cartas) y en cualquier punto donde se muestre
 * una carta seleccionada sin desplegar sus 6 secciones.
 *
 * @param {object} carta
 * @param {string} [orientacion='recta'] — 'recta' | 'invertida'
 * @param {number} [mazo=1]
 * @returns {string} HTML del preview compacto
 */
export function renderizarPreviewCarta(carta, orientacion = 'recta', mazo = 1) {
  const esInvertida = orientacion === 'invertida';
  const numero = carta.numero_original !== null && carta.numero_original !== undefined
    ? carta.numero_original : '';
  const mazoClass = `mazo-${mazo}`;
  const thumbSrc  = `assets/images/mazo-${mazo}/${carta.slug}-thumb.jpg`;

  const badgeOrientacion = esInvertida
    ? `<span class="badge-invertida" style="font-size:0.7rem;"><i class="ph ph-arrow-down" aria-hidden="true"></i> Invertida</span>`
    : `<span class="badge-recta"     style="font-size:0.7rem;"><i class="ph ph-arrow-up"   aria-hidden="true"></i> Recta</span>`;

  return `
    <div class="carta-preview-compacto" data-id="${carta.id}" data-orientacion="${orientacion}">
      <div class="carta-preview-imagen">
        <img
          src="${thumbSrc}"
          alt="${carta.arcano_es}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        >
        <div class="placeholder-carta-thumb ${mazoClass}${esInvertida ? ' invertida' : ''}"
             data-numero="${numero}"
             data-nombre="${carta.arcano_es}"
             style="display:none;"
             aria-hidden="true">
        </div>
      </div>
      <div class="carta-preview-info">
        <span class="carta-preview-nombre">${carta.arcano_es}</span>
        ${badgeOrientacion}
      </div>
    </div>`;
}

/**
 * Genera el HTML del badge de tipo de carta (Arcano Mayor / Arcano Menor + palo).
 * Exportado aquí para que render-carta.js sea el punto centralizado
 * y reducir la necesidad de importar cards.js en otros contextos.
 *
 * @param {object} carta — objeto de cartas.json
 * @returns {string} HTML del badge
 */
export function getBadgeTipoCarta(carta) {
  if (carta.tipo === 'arcano_mayor') {
    return `<span class="badge-tipo badge-mayor">Arcano Mayor</span>`;
  }
  if (carta.palo === undefined || carta.palo === null) {
    console.warn('[render-carta.js] carta.palo ausente en id:', carta.id);
    return `<span class="badge-tipo badge-menor">Arcano Menor</span>`;
  }
  return `<span class="badge-tipo badge-menor">Arcano Menor · ${carta.palo}</span>`;
}

/**
 * Toggle de paneles expandibles — disponible globalmente para arcanos.html y resultado.html.
 * Se asigna a window para ser accesible desde onclick inline del HTML generado.
 */
export function initToggleExpandible() {
  window.toggleExpandible = function toggleExpandible(btn) {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const panelId  = btn.getAttribute('aria-controls');
    const panel    = document.getElementById(panelId);
    const icon     = btn.querySelector('.toggle-icon');

    btn.setAttribute('aria-expanded', String(!expanded));
    if (panel) panel.hidden = expanded;
    if (icon) {
      icon.classList.toggle('ph-caret-down', expanded);
      icon.classList.toggle('ph-caret-up',   !expanded);
    }
  };
}
