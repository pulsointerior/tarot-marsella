// ─────────────────────────────────────────────────────────────────────────────
// resultado.js — Pantalla de resultado (Fase 3C / refactorizado en Fase 6)
//
// Responsabilidad:
//   · Leer tirada_actual desde navigation.js al cargar la página
//   · Verificar recovery de estado (dos condiciones)
//   · Cargar datos completos de cada carta desde data.js
//   · Renderizar Bloque 1 (cartas individuales — delegado a render-carta.js)
//   · Renderizar Bloque 2 (combinaciones reales)
//   · Renderizar Bloque 3 (conclusión con botones Regenerar y Copiar)
//   · Gestionar botones de scroll fijo y acciones finales
//
// Dependencias (Fase 6 — sin duplicación con cards.js):
//   · data.js          — getCartaById(), getPosicionesByTirada(), getPosicionCombinacion()
//   · navigation.js    — getTiradaActual(), clearTiradaActual(), navigateTo()
//   · readings.js      — mapearTemaAColumna(), getNombreTema()
//   · render-carta.js  — renderSeccionesCarta() [NUEVO en Fase 6, elimina duplicación]
//   · conclusion.js    — generarConclusion(), regenerarConclusion()
//   · combinations.js  — getCombinacionDirecta(), getTodosLosPares(),
//                        renderCombinacionCompleta(), renderFilaResumenCombinacion()
//
// Nota Fase 6: _renderSeccion1..6 eliminadas — delegadas a render-carta.js.
// ─────────────────────────────────────────────────────────────────────────────

import { getCartaById, getPosicionesByTirada, getPosicionCombinacion } from './data.js';
import { getTiradaActual, clearTiradaActual, navigateTo } from './navigation.js';
import { getNombreTema } from './readings.js';
import { renderSeccionesCarta } from './render-carta.js';
import { generarConclusion, regenerarConclusion } from './conclusion.js';
import {
  getCombinacionDirecta,
  getTodosLosPares,
  renderCombinacionCompleta,

} from './combinations.js';

// ─────────────────────────────────────────────────────────────────────────────
// RENDER — BLOQUES PRINCIPALES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bloque 1 — N bloques de carta individual (6 secciones cada uno).
 * Delega el renderizado de secciones a render-carta.js (modo 'resultado').
 *
 * @param {object}   tiradaActual  — objeto tirada con .cartas [{id, orientacion}]
 * @param {object[]} cartasData    — array de objetos carta completos
 * @param {object[]} posiciones    — array de posiciones de la tirada
 * @param {number}   mazo          — número de mazo (1|2|3)
 * @returns {string} HTML
 */
function _renderBloque1(tiradaActual, cartasData, posiciones, mazo) {
  const items = tiradaActual.cartas.map((entrada, idx) => {
    const carta      = cartasData[idx];
    const orientacion = entrada.orientacion || 'recta';
    const posicion   = posiciones[idx] || null;

    const seccionesHTML = renderSeccionesCarta(carta, {
      temaActivo:  tiradaActual.tema || null,
      orientacion,
      modo:        'resultado',
      posicion,
      mazo,
    });

    return `
      <article class="carta-resultado" aria-label="${carta.arcano_es}">
        <div class="carta-secciones">
          ${seccionesHTML}
        </div>
      </article>`;
  });

  return `
    <section class="bloque-cartas" id="bloque-cartas" aria-label="Cartas de la consulta">
      ${items.join('')}
    </section>`;
}

/**
 * Bloque 2 — Combinaciones reales.
 * · 2 cartas: muestra la combinación directa completa.
 * · >2 cartas: botón explorador que carga pares lazy.
 *
 * @param {object} tiradaActual
 * @param {Array}  cartasCompletas
 * @returns {Promise<string>} HTML
 */
async function _renderBloque2(tiradaActual, cartasCompletas) {
  const n = cartasCompletas.length;

  // ── Tirada de exactamente 2 cartas ──────────────────────────────────────
  if (n === 2) {
    const c1   = cartasCompletas[0];
    const c2   = cartasCompletas[1];
    const comb = await getCombinacionDirecta(c1, c2);

    if (!comb) {
      return `<section id="bloque-combinaciones" style="display:none;" aria-hidden="true"></section>`;
    }

    return `
      <section class="bloque-combinaciones" id="bloque-combinaciones" aria-label="Combinación">
        ${renderCombinacionCompleta(comb, c1, c2)}
      </section>`;
  }

  // ── Tirada de >2 cartas: botón explorador lazy ───────────────────────────
  if (n > 2) {
    return `
      <section class="bloque-combinaciones" id="bloque-combinaciones" aria-label="Combinaciones">
        <div class="center-content" style="padding: var(--space-3) 0;">
          <button class="btn btn-secondary" id="btn-explorar-pares">
            <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
            Explorar combinaciones entre tus cartas
          </button>
        </div>
        <div id="lista-pares" style="margin-top: var(--space-3);"></div>
      </section>`;
  }

  // ── 1 carta: sin combinaciones ───────────────────────────────────────────
  return `<section id="bloque-combinaciones" style="display:none;" aria-hidden="true"></section>`;
}

/**
 * Carga y renderiza los pares de combinaciones al hacer clic en el botón explorador.
 * Deduplica pares (A+B = B+A): para cada par de cartas muestra UNA sola fila,
 * priorizando la dirección que tenga combinación.
 * @param {Array} cartasCompletas
 * @returns {Promise<Array>} pares — para pasar a la conclusión
 */
async function _cargarPares(cartasCompletas) {
  const btn       = document.getElementById('btn-explorar-pares');
  const listaCont = document.getElementById('lista-pares');
  if (!btn || !listaCont) return [];

  btn.disabled = true;
  btn.innerHTML = `<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Cargando...`;

  // Obtener todos los pares direccionales
  const pares = await getTodosLosPares(cartasCompletas);

  // Deduplicar: para cada par {i,j} con i<j, elegir la dirección con combinación
  const vistos  = new Set();
  const mejores = [];

  for (const p of pares) {
    const idA = Math.min(p.carta1.id, p.carta2.id);
    const idB = Math.max(p.carta1.id, p.carta2.id);
    const clave = `${idA}-${idB}`;

    if (vistos.has(clave)) continue;
    vistos.add(clave);

    // Buscar también la dirección inversa en pares[]
    const inverso = pares.find(q => q.carta1.id === p.carta2.id && q.carta2.id === p.carta1.id);

    // Elegir la dirección que tenga combinación; si ambas tienen, elegir la directa
    let mejor = p;
    if (!p.combinacion && inverso?.combinacion) {
      mejor = inverso;
    }

    mejores.push(mejor);
  }

  // Ordenar: con combinación primero
  const conComb = mejores.filter(p =>  p.combinacion);
  const sinComb = mejores.filter(p => !p.combinacion);

  const filasHTML = [
    ...conComb.map(p => {
      const pos = getPosicionCombinacion(p.carta1.orientacion, p.carta2.orientacion);
      const url = `detalle-combinacion.html?id1=${p.carta1.id}&id2=${p.carta2.id}&pos=${pos}`;
      return _renderFilaCombinacion(p.carta1, p.carta2, p.combinacion, url);
    }),
    ...sinComb.map(p => _renderFilaCombinacion(p.carta1, p.carta2, null, null)),
  ].join('');

  listaCont.innerHTML = filasHTML
    || `<p class="text-muted" style="text-align:center; padding:var(--space-3);">No se encontraron combinaciones para esta tirada.</p>`;

  btn.style.display = 'none';
  return pares;
}

/**
 * Renderiza una fila de combinación para el explorador de resultado.html.
 * Versión local que garantiza que el botón → sea siempre visible y clicable.
 * @param {object} carta1obj
 * @param {object} carta2obj
 * @param {object|null} combinacion
 * @param {string|null} urlDetalle
 * @returns {string} HTML
 */
function _renderFilaCombinacion(carta1obj, carta2obj, combinacion, urlDetalle) {
  const badge = combinacion
    ? (() => {
        const clases = {
          RESONANCIA: 'badge-resonancia', SINERGIA: 'badge-sinergia',
          TENSION: 'badge-tension',       NEUTRO:   'badge-neutro',
          BLOQUEO: 'badge-bloqueo',       REFUERZO: 'badge-refuerzo',
        };
        const cls = clases[combinacion.tipo] || 'badge-neutro';
        return `<span class="badge-tipo ${cls}">${combinacion.tipo}</span>`;
      })()
    : `<span style="font-size:0.78rem; color:var(--text-muted); font-style:italic; white-space:nowrap;">Sin datos</span>`;

  const enlaceHTML = urlDetalle
    ? `<a href="${urlDetalle}"
          style="
            display:inline-flex; align-items:center; justify-content:center;
            width:34px; height:34px; border-radius:50%;
            border:1px solid rgba(201,168,76,0.4);
            color:var(--secondary); font-size:1rem;
            text-decoration:none; flex-shrink:0;
            transition:background 0.2s;
          "
          aria-label="Ver detalle de la combinación"
          onmouseover="this.style.background='rgba(201,168,76,0.12)'"
          onmouseout="this.style.background='transparent'"
       ><i class="ph ph-arrow-right" aria-hidden="true"></i></a>`
    : `<span style="width:34px; flex-shrink:0;"></span>`;

  return `
    <div style="
      display:flex; align-items:center; gap:var(--space-2);
      padding:var(--space-2) var(--space-1);
      border-bottom:1px solid rgba(201,168,76,0.08);
    ">
      <span style="font-size:0.85rem; color:var(--text-main); min-width:120px; flex:1;">
        ${carta1obj.arcano_es}
      </span>
      <span style="text-align:center; min-width:100px; flex-shrink:0;">${badge}</span>
      <span style="font-size:0.85rem; color:var(--text-main); min-width:120px; flex:1; text-align:right;">
        ${carta2obj.arcano_es}
      </span>
      ${enlaceHTML}
    </div>`;
}

/**
 * Bloque 3 — Conclusión real con spinner inicial y botones Regenerar y Copiar.
 * @returns {string} HTML (spinner inicial — contenido se rellena con _cargarConclusion)
 */
function _renderBloque3() {
  return `
    <section class="bloque-conclusion" id="bloque-conclusion" aria-label="Conclusión">
      <h2 class="bloque-titulo">Conclusión de la Consulta</h2>
      <div class="conclusion-contenido" id="conclusion-contenido">
        <div class="center-content" style="padding: var(--space-4);">
          <i class="ph ph-spinner"
             style="font-size:2rem; color:var(--secondary); animation:spin 1s linear infinite;"
             aria-hidden="true"></i>
          <p class="text-muted" style="margin-top:var(--space-2);">Interpretando...</p>
        </div>
      </div>
      <div class="conclusion-acciones cluster mt-3"
           style="justify-content:flex-end; gap:var(--space-2);">
        <button class="btn btn-secondary" id="btn-regenerar"
                style="font-size:0.8rem; padding:8px 14px;">
          <i class="ph ph-arrows-clockwise" aria-hidden="true"></i>
          Regenerar interpretación
        </button>
        <button class="btn btn-secondary" id="btn-copiar-conclusion"
                style="font-size:0.8rem; padding:8px 14px;">
          <i class="ph ph-copy" aria-hidden="true"></i>
          Copiar
        </button>
      </div>
    </section>`;
}

/**
 * Rellena el contenido de la conclusión (llamado después de renderizar el DOM).
 * @param {object} tiradaActual
 * @param {Array}  cartasCompletas
 * @param {Array|null} pares
 */
async function _cargarConclusion(tiradaActual, cartasCompletas, pares) {
  const cont = document.getElementById('conclusion-contenido');
  if (!cont) return;

  try {
    const html = await generarConclusion(tiradaActual, cartasCompletas, pares);
    cont.innerHTML = `
      <i class="ph ph-lightbulb"
         style="color:var(--secondary); font-size:1.2rem;"
         aria-hidden="true"></i>
      ${html}`;
  } catch (err) {
    console.error('[resultado.js] Error generando conclusión:', err);
    cont.innerHTML = `<p class="conclusion-placeholder text-muted">No se pudo generar la interpretación.</p>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER — CABECERA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera HTML de la cabecera (nombre tirada + badge tema).
 * @param {object} tiradaActual
 * @returns {string} HTML
 */
function _renderCabecera(tiradaActual) {
  const nombre = tiradaActual.nombre || tiradaActual.diseno || 'Tu Tirada';
  const tema   = tiradaActual.tema   || '';
  const badgeTema = tema
    ? `<span class="badge-tema badge-tema-${tema}">${getNombreTema(tema)}</span>`
    : '';

  return `
    <section class="resultado-cabecera section" aria-label="Información de la consulta">
      <h1 class="page-title">${nombre}</h1>
      <div class="cluster mt-2">
        ${badgeTema}
      </div>
    </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER — ACCIONES FINALES
// ─────────────────────────────────────────────────────────────────────────────

function _renderAccionesFinales() {
  return `
    <div class="acciones-finales center-content stack-3 mt-6">
      <button class="btn btn-primary btn-lg" id="btn-nueva-tirada">
        <i class="ph ph-arrow-left" aria-hidden="true"></i>
        Nueva Tirada
      </button>
      <button class="btn btn-secondary btn-lg" id="btn-explorar-arcanos">
        <i class="ph ph-cards" aria-hidden="true"></i>
        Explorar Arcanos
      </button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE EXPANDIBLE — expuesto globalmente para los onclick del HTML generado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alterna el estado de un panel expandible.
 * Llamado desde onclick inline en el HTML generado dinámicamente.
 * @param {HTMLElement} btn
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// INIT — PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // ── 1. Leer estado ───────────────────────────────────────────────────────
  const tiradaActual = getTiradaActual();

  // ── 2. Recovery de estado — DOS condiciones ──────────────────────────────
  if (!tiradaActual) {
    navigateTo('introduccion.html');
    return;
  }
  if (!tiradaActual.cartas || tiradaActual.cartas.length === 0) {
    navigateTo('introduccion.html');
    return;
  }

  // ── 3. Cargar datos completos de cada carta ──────────────────────────────
  let cartasData;
  try {
    cartasData = await Promise.all(
      tiradaActual.cartas.map(entrada => getCartaById(entrada.id))
    );
  } catch (err) {
    console.error('[resultado.js] Error cargando cartas:', err);
    main.innerHTML = `
      <div class="container section center-content">
        <p class="text-muted">Error al cargar los datos de las cartas. Por favor, inténtalo de nuevo.</p>
        <button class="btn btn-primary mt-4"
                onclick="location.href='tipos-lecturas.html'">Volver</button>
      </div>`;
    return;
  }

  // cartasCompletas: [{...carta, orientacion}] — reutilizado en Bloques 2 y 3
  const cartasCompletas = cartasData.map((carta, idx) => ({
    ...carta,
    orientacion: tiradaActual.cartas[idx].orientacion || 'recta',
  }));

  // ── 4. Cargar posiciones de la tirada ────────────────────────────────────
  let posiciones = [];
  try {
    posiciones = await getPosicionesByTirada(tiradaActual.id_tirada || tiradaActual.id);
  } catch (err) {
    console.warn('[resultado.js] Posiciones no disponibles:', err);
    // No crítico — la página puede renderizarse sin nombres de posición
  }

  // ── 5. Leer mazo seleccionado ────────────────────────────────────────────
  const mazo = parseInt(localStorage.getItem('mazo_seleccionado') || '1', 10);

  // ── 6. Renderizar todos los bloques ─────────────────────────────────────
  const htmlCabecera = _renderCabecera(tiradaActual);
  const htmlBloque1  = _renderBloque1(tiradaActual, cartasCompletas, posiciones, mazo);
  const htmlBloque2  = await _renderBloque2(tiradaActual, cartasCompletas);
  const htmlBloque3  = _renderBloque3();
  const htmlAcciones = _renderAccionesFinales();

  main.innerHTML = `
    <div class="container">
      ${htmlCabecera}
      <div class="divider-ornate" aria-hidden="true">★</div>
      ${htmlBloque1}
      <h2 class="bloque-titulo">Combinaciones</h2>
      ${htmlBloque2}
      <h2 class="bloque-titulo">Conclusión</h2>
      ${htmlBloque3}
      ${htmlAcciones}
    </div>`;

  // ── 7. Para tiradas de >2 cartas: cargar pares automáticamente ───────────
  let paresParaConclusion = null;
  if (cartasCompletas.length > 2) {
    paresParaConclusion = await _cargarPares(cartasCompletas);
  }

  // ── 8. Cargar conclusión (con pares si están disponibles) ────────────────
  await _cargarConclusion(tiradaActual, cartasCompletas, paresParaConclusion);

  // ── 9. Eventos de botones ────────────────────────────────────────────────
  document.getElementById('btn-nueva-tirada')?.addEventListener('click', () => {
    clearTiradaActual();
    navigateTo('tipos-lecturas.html');
  });

  document.getElementById('btn-explorar-arcanos')?.addEventListener('click', () => {
    navigateTo('arcanos.html?desde=resultado');
  });

  // Botón regenerar conclusión
  let _paresCache = paresParaConclusion;
  document.getElementById('btn-regenerar')?.addEventListener('click', async () => {
    const cont = document.getElementById('conclusion-contenido');
    if (cont) {
      cont.innerHTML = `
        <div class="center-content" style="padding:var(--space-3);">
          <i class="ph ph-spinner"
             style="font-size:1.5rem; color:var(--secondary); animation:spin 1s linear infinite;"
             aria-hidden="true"></i>
        </div>`;
    }
    try {
      const html = await regenerarConclusion(tiradaActual, cartasCompletas, _paresCache);
      if (cont) {
        cont.innerHTML = `
          <i class="ph ph-lightbulb"
             style="color:var(--secondary); font-size:1.2rem;"
             aria-hidden="true"></i>
          ${html}`;
      }
    } catch {
      if (cont) cont.innerHTML = `<p class="text-muted">No se pudo regenerar la interpretación.</p>`;
    }
  });

  // Botón copiar conclusión
  document.getElementById('btn-copiar-conclusion')?.addEventListener('click', () => {
    const cont   = document.getElementById('conclusion-contenido');
    const texto  = cont?.innerText || '';
    navigator.clipboard?.writeText(texto).then(() => {
      const btn = document.getElementById('btn-copiar-conclusion');
      if (btn) {
        btn.innerHTML = `<i class="ph ph-check"></i> Copiado`;
        setTimeout(() => {
          btn.innerHTML = `<i class="ph ph-copy"></i> Copiar`;
        }, 2000);
      }
    });
  });

} // fin init()

// ── Arranque robusto (Regla 8 — type="module" garantiza DOM listo) ──────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
