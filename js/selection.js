// selection.js — Gestión de selección de cartas en indicar-cartas.html.
// Fase 2: funciones de validación y construcción del array (NO MODIFICAR).
// Fase 3B: lógica UI — renderizado de N grupos con toggle R/I, validación
//          en tiempo real, modo automático, navegación a resultado.html.

import { getMazo, getModo, getTiradaActual, setTiradaActual, navigateTo } from './navigation.js';
import { getCartas, getPosicionesByTirada } from './data.js';
import { getNombreCompleto, renderPlaceholderCarta } from './cards.js';
import { inicializarModoAutomatico, barajarYRepartir } from './automatic.js';

// ── FASE 2 — NO MODIFICAR ─────────────────────────────────────────────────────

/**
 * Valida que no haya cartas duplicadas en la selección.
 * @param {Array<number|null>} cartasSeleccionadas
 * @returns {{valido: boolean, duplicados: number[]}}
 */
export function validarSeleccionUnica(cartasSeleccionadas) {
  const vistos = new Map();
  const duplicados = [];

  cartasSeleccionadas.forEach((id, idx) => {
    if (id === null || id === undefined || id === '') return;
    if (vistos.has(id)) {
      if (!duplicados.includes(vistos.get(id))) duplicados.push(vistos.get(id));
      duplicados.push(idx);
    } else {
      vistos.set(id, idx);
    }
  });

  return { valido: duplicados.length === 0, duplicados };
}

/**
 * Lee los N selectores del DOM y construye el array de cartas.
 * @param {NodeList|Array} selectores — elementos <select>
 * @returns {Array<{id: number|null, orientacion: string, posicion: string}>}
 */
export function buildCartasArray(selectores) {
  return Array.from(selectores).map((sel, idx) => {
    const id = sel.value ? parseInt(sel.value, 10) : null;
    const posicion = sel.dataset.posicion || `C${idx + 1}`;
    const contenedor = sel.closest('[data-selector-grupo]') || sel.parentElement;
    const toggleActivo = contenedor
      ? contenedor.querySelector('[data-orientacion].activo')
      : null;
    const orientacion = toggleActivo ? toggleActivo.dataset.orientacion : 'recta';
    return { id, orientacion, posicion };
  });
}

/**
 * Verifica si todas las posiciones están cubiertas sin duplicados.
 * @param {Array<{id: number|null}>} cartasArray
 * @param {number} numCartas
 * @returns {boolean}
 */
export function cartasCompletas(cartasArray, numCartas) {
  if (cartasArray.length !== numCartas) return false;
  const ids = cartasArray.map(c => c.id);
  if (ids.some(id => id === null || id === undefined)) return false;
  const { valido } = validarSeleccionUnica(ids);
  return valido;
}

// ── FASE 3B — VALIDACIÓN UI ───────────────────────────────────────────────────

/**
 * Añade eventos 'change' a cada selector y valida en tiempo real.
 * Habilita/deshabilita botonConfirmar según cartasCompletas().
 * @param {Array<HTMLSelectElement>} selectores
 * @param {HTMLButtonElement} botonConfirmar
 * @param {number} numCartas
 */
export function inicializarValidacionUI(selectores, botonConfirmar, numCartas) {
  const actualizar = () => {
    const cartasArray = buildCartasArray(selectores);
    const ids = cartasArray.map(c => c.id);
    const { duplicados } = validarSeleccionUnica(ids);

    // Feedback visual por selector
    selectores.forEach((sel, idx) => {
      const grupo   = sel.closest('[data-selector-grupo]');
      const warning = grupo ? grupo.querySelector('.sel-warning') : null;

      sel.classList.remove('sel-error', 'sel-ok');
      if (warning) warning.style.display = 'none';

      if (duplicados.includes(idx)) {
        sel.classList.add('sel-error');
        if (warning) {
          warning.innerHTML = '<i class="ph ph-warning-circle"></i> Esta carta ya fue seleccionada';
          warning.style.display = 'flex';
        }
      } else if (sel.value) {
        sel.classList.add('sel-ok');
      }
    });

    // Botón confirmar
    const completas = cartasCompletas(cartasArray, numCartas);
    botonConfirmar.disabled = !completas;
    botonConfirmar.innerHTML = completas
      ? '<i class="ph ph-check-circle"></i> VER RESULTADO'
      : '<i class="ph ph-arrow-right"></i> VER RESULTADO';
    botonConfirmar.classList.toggle('btn-listo', completas);
  };

  selectores.forEach(sel => sel.addEventListener('change', actualizar));
  actualizar(); // estado inicial
}

// ── INICIALIZACIÓN ────────────────────────────────────────────────────────────

async function init() {
  // Recovery de estado
  const tirada = getTiradaActual();
  if (!tirada) {
    navigateTo('tipos-lecturas.html');
    return;
  }
  // ⚠️ NOTA ARQUITECTURA: Fase 8 reemplaza este check por
  // navigation.verificarEstadoRecovery('indicar-cartas'). No duplicar la lógica.

  const modo = getModo();
  const mazo = getMazo();

  // Actualizar nav-volver y breadcrumb con id de tirada real
  const navVolver       = document.getElementById('nav-volver-tirada');
  const breadcrumbLink  = document.getElementById('breadcrumb-tirada-link');
  const urlVolver       = `detalle-tirada.html?id=${tirada.id_tirada}&tema=${tirada.tema}`;

  if (navVolver)      navVolver.href = urlVolver;
  if (breadcrumbLink) {
    breadcrumbLink.href        = urlVolver;
    breadcrumbLink.textContent = tirada.nombre_tirada || tirada.nombre || 'Tirada';
  }

  // Título
  const h1  = document.getElementById('nombre-posicion');
  const sub = document.getElementById('descripcion-posicion');
  if (h1)  h1.textContent  = 'Indica tus cartas';
  if (sub) sub.textContent = tirada.nombre_tirada || tirada.nombre || '';

  if (modo === 'manual') {
    await _renderModoManual(tirada, mazo);
  } else {
    await _renderModoAutomatico(tirada, mazo);
  }
}

// ── MODO MANUAL ───────────────────────────────────────────────────────────────

async function _renderModoManual(tirada, mazo) {
  const panelPosiciones = document.getElementById('panel-posiciones');
  const controles       = document.getElementById('controles-selector');
  const gridSeleccion   = document.getElementById('grid-seleccion');
  const accion          = document.getElementById('accion-confirmar');
  const progreso        = document.getElementById('progreso-seleccion');

  // Datos en paralelo
  const [cartas, posiciones] = await Promise.all([
    getCartas(),
    getPosicionesByTirada(tirada.id_tirada)
  ]);

  const cartasOrdenadas = [...cartas].sort((a, b) => a.id - b.id);

  // Grid no se usa en modo manual
  gridSeleccion.innerHTML = '';

  // ── Barra de progreso ──
  progreso.innerHTML = `
    <div class="progreso-bar">
      <span id="progreso-texto">0 de ${tirada.num_cartas} cartas seleccionadas</span>
      <div class="progreso-track">
        <div class="progreso-fill" id="progreso-fill" style="width:0%"></div>
      </div>
    </div>`;

  // ── Panel lateral de posiciones ──
  panelPosiciones.innerHTML = `
    <h3 class="panel-titulo">Posiciones</h3>
    <ul class="lista-posiciones">
      ${posiciones.map((pos, i) => `
        <li class="posicion-item" id="pos-item-${i}">
          <span class="posicion-label">C${i + 1}</span>
          <span class="posicion-nombre">${pos.significado || pos.significado_house || ''}</span>
          <span class="posicion-carta-asignada" id="pos-carta-${i}">—</span>
        </li>`).join('')}
    </ul>`;

  // ── Generar N grupos con <select> + toggle R/I ──
  controles.innerHTML = '';
  const selectoresGenerados = [];

  posiciones.forEach((pos, i) => {
    const grupo = document.createElement('div');
    grupo.className = 'selector-grupo';
    grupo.dataset.selectorGrupo = i;

    grupo.innerHTML = `
      <div class="selector-header">
        <span class="selector-label">
          <span class="selector-pos-badge">C${i + 1}</span>
          ${pos.significado || pos.significado_house || ''}
        </span>
      </div>

      <div class="selector-fila">

        <select
          class="selector-carta"
          data-posicion="C${i + 1}"
          aria-label="Carta para posición C${i + 1}"
        >
          <option value="">-- Selecciona una carta --</option>
          ${cartasOrdenadas.map(c =>
            `<option value="${c.id}">${getNombreCompleto(c)}</option>`
          ).join('')}
        </select>

        <div class="toggle-orientacion" role="group" aria-label="Orientación de la carta">
          <button
            type="button"
            class="btn-orientacion activo"
            data-orientacion="recta"
            aria-pressed="true"
            title="Recta"
          ><i class="ph ph-arrow-up"></i><span class="toggle-label">R</span></button>
          <button
            type="button"
            class="btn-orientacion"
            data-orientacion="invertida"
            aria-pressed="false"
            title="Invertida"
          ><i class="ph ph-arrow-down"></i><span class="toggle-label">I</span></button>
        </div>

      </div>

      <div class="selector-preview" id="preview-${i}"></div>

      <div class="sel-warning" role="alert" style="display:none;"></div>
    `;

    controles.appendChild(grupo);

    const selectEl = grupo.querySelector('select');
    selectoresGenerados.push(selectEl);

    // Toggle R/I — solo uno activo a la vez por grupo
    const btnOrientacion = grupo.querySelectorAll('.btn-orientacion');
    btnOrientacion.forEach(btn => {
      btn.addEventListener('click', () => {
        btnOrientacion.forEach(b => {
          b.classList.remove('activo');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('activo');
        btn.setAttribute('aria-pressed', 'true');
        // Actualizar preview con orientación visual
        _actualizarPreviewOrientacion(i, selectEl, cartas, mazo);
      });
    });

    // Preview al seleccionar carta
    selectEl.addEventListener('change', () => {
      _actualizarPreviewOrientacion(i, selectEl, cartas, mazo);
      // Actualizar sidebar
      const posCartaEl = document.getElementById(`pos-carta-${i}`);
      if (posCartaEl) {
        if (selectEl.value) {
          const carta = cartas.find(c => c.id === parseInt(selectEl.value, 10));
          posCartaEl.textContent = carta ? getNombreCompleto(carta) : '—';
        } else {
          posCartaEl.textContent = '—';
        }
      }
      // Actualizar progreso
      _actualizarProgreso(selectoresGenerados, tirada.num_cartas);
    });
  });

  // ── Botón VER RESULTADO ──
  accion.innerHTML = `
    <button
      id="btn-ver-resultado"
      class="btn btn-primary btn-lg"
      disabled
      aria-label="Ver el resultado de la lectura"
    >
      <i class="ph ph-arrow-right"></i> VER RESULTADO
    </button>`;

  const btnResultado = document.getElementById('btn-ver-resultado');

  // Inicializar validación UI en tiempo real
  inicializarValidacionUI(selectoresGenerados, btnResultado, tirada.num_cartas);

  // Acción del botón
  btnResultado.addEventListener('click', () => {
    const cartasArray = buildCartasArray(selectoresGenerados);
    const tiradaActualizada = { ...tirada, cartas: cartasArray };
    setTiradaActual(tiradaActualizada);
    navigateTo('resultado.html');
  });
}

// ── HELPERS MODO MANUAL ───────────────────────────────────────────────────────

function _actualizarPreviewOrientacion(idx, selectEl, cartas, mazo) {
  const preview = document.getElementById(`preview-${idx}`);
  if (!preview) return;

  if (!selectEl.value) {
    preview.innerHTML = '';
    return;
  }

  const carta = cartas.find(c => c.id === parseInt(selectEl.value, 10));
  if (!carta) return;

  // Detectar orientación activa del grupo
  const grupo = selectEl.closest('[data-selector-grupo]');
  const btnActivo = grupo ? grupo.querySelector('.btn-orientacion.activo') : null;
  const orientacion = btnActivo ? btnActivo.dataset.orientacion : 'recta';

  // Renderizar placeholder con clase invertida si corresponde
  let html = renderPlaceholderCarta(carta, mazo, 'medium');
  if (orientacion === 'invertida') {
    html = html.replace('class="placeholder-carta-medium', 'class="placeholder-carta-medium invertida');
  }
  preview.innerHTML = html;
}

function _actualizarProgreso(selectores, numCartas) {
  const cartasArray  = buildCartasArray(selectores);
  const asignadas    = cartasArray.filter(c => c.id !== null).length;
  const porcentaje   = Math.round((asignadas / numCartas) * 100);
  const textoEl      = document.getElementById('progreso-texto');
  const fillEl       = document.getElementById('progreso-fill');
  if (textoEl) textoEl.textContent = `${asignadas} de ${numCartas} cartas seleccionadas`;
  if (fillEl)  fillEl.style.width  = `${porcentaje}%`;

  // Actualizar clases activas en sidebar
  selectores.forEach((sel, i) => {
    const item = document.getElementById(`pos-item-${i}`);
    if (!item) return;
    item.classList.toggle('posicion-asignada', !!sel.value);
  });
}

// ── MODO AUTOMÁTICO ───────────────────────────────────────────────────────────

async function _renderModoAutomatico(tirada, mazo) {
  const controles   = document.getElementById('controles-selector');
  const gridSection = document.getElementById('grid-seleccion');
  const accion      = document.getElementById('accion-confirmar');
  const progreso    = document.getElementById('progreso-seleccion');

  // El grid se usa como contenedor del mazo visual en modo automático
  gridSection.className = 'mazo-automatico-container';
  gridSection.innerHTML = '';
  controles.innerHTML   = '';

  progreso.innerHTML = `
    <div class="progreso-bar">
      <span id="progreso-texto">Baraja las cartas para comenzar</span>
    </div>`;

  // Botón barajar (deshabilitado hasta que datos listos — automatic.js lo gestiona)
  accion.innerHTML = `
    <div class="acciones-automatico">
      <button
        id="btn-barajar"
        class="btn btn-primary btn-lg"
        disabled
        aria-label="Barajar y repartir cartas"
      >
        <i class="ph ph-spinner anim-spin"></i> Cargando...
      </button>
      <button
        id="btn-ver-resultado"
        class="btn btn-primary btn-lg"
        disabled
        style="display:none;"
        aria-label="Ver el resultado de la lectura"
      >
        <i class="ph ph-check-circle"></i> VER RESULTADO
      </button>
    </div>`;

  const btnBarajar   = document.getElementById('btn-barajar');
  const btnResultado = document.getElementById('btn-ver-resultado');

  // Inicializar modo automático — automatic.js habilita btnBarajar cuando datos listos
  await inicializarModoAutomatico(gridSection, tirada, parseInt(mazo, 10), btnBarajar);

  let cartasRepartidas = null;

  // Acción barajar
  btnBarajar.addEventListener('click', async () => {
    btnBarajar.disabled = true;
    btnBarajar.innerHTML = '<i class="ph ph-spinner anim-spin"></i> Repartiendo...';

    await barajarYRepartir(gridSection, tirada, async (cartasArray) => {
      cartasRepartidas = cartasArray;

      // Mostrar cartas reveladas con orientación visual
      await _mostrarCartasReveladas(cartasArray, parseInt(mazo, 10));

      // Actualizar progreso
      const textoEl = document.getElementById('progreso-texto');
      if (textoEl) textoEl.textContent =
        `${cartasArray.length} de ${tirada.num_cartas} cartas repartidas`;

      // Habilitar VER RESULTADO
      btnBarajar.style.display   = 'none';
      btnResultado.style.display = '';
      btnResultado.disabled      = false;
    });
  });

  // Acción ver resultado
  btnResultado.addEventListener('click', () => {
    if (!cartasRepartidas) return;
    const tiradaActualizada = { ...tirada, cartas: cartasRepartidas };
    setTiradaActual(tiradaActualizada);
    navigateTo('resultado.html');
  });
}

async function _mostrarCartasReveladas(cartasArray, mazo) {
  const grid = document.getElementById('grid-seleccion');
  if (!grid) return;

  // Cargar cartas para mostrar nombres reales (ya en caché — sin fetch extra)
  const todasLasCartas = await getCartas();

  grid.className = 'grid-cartas-reveladas';
  grid.innerHTML = cartasArray.map((carta, i) => {
    const cartaObj = todasLasCartas.find(c => c.id === carta.id);
    const numero   = cartaObj?.numero_original ?? '';
    const nombre   = cartaObj ? getNombreCompleto(cartaObj) : `Carta ${i + 1}`;

    return `
      <div class="carta-revelada">
        <div class="carta-revelada-pos">C${i + 1}</div>
        <div class="placeholder-carta-medium mazo-${mazo}${carta.orientacion === 'invertida' ? ' invertida' : ''}"
             data-numero="${numero}"
             data-nombre="${nombre}">
        </div>
        <div class="carta-revelada-orientacion">
          ${carta.orientacion === 'recta'
            ? '<span class="badge-recta"><i class="ph ph-arrow-up"></i> Recta</span>'
            : '<span class="badge-invertida"><i class="ph ph-arrow-down"></i> Invertida</span>'
          }
        </div>
      </div>`;
  }).join('');
}

// ── ARRANQUE ──────────────────────────────────────────────────────────────────

// Los ES Modules se ejecutan después de que el DOM está listo — llamar init() directamente.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}