/**
 * @file animations.js
 * @description Motor de animaciones del mazo de tarot.
 *   Construye la UI visual del mazo (78 capas CSS) y ejecuta las 5 fases
 *   de animación: mezclar → cortar → remezclar → corte final → repartir.
 *   Usada exclusivamente por automatic.js en modo automático.
 *
 * @dependencies
 *   Ninguna (no importa otros módulos del proyecto — leaf module de UI)
 *
 * @exports ANIMATION_LEVEL, inicializarMazo, ejecutarAnimacionCompleta, resetearMazo
 */

// ── DETECCIÓN DE NIVEL DE ANIMACIÓN ──────────────────────────────────────────

function detectAnimationLevel() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'none';
  }
  const cores  = navigator.hardwareConcurrency ?? 2;
  const memory = navigator.deviceMemory        ?? 4;
  if (cores <= 2 || memory <= 1) return 'minimal';
  if (cores <= 4 || memory <= 2) return 'reduced';
  return 'full';
}

export const ANIMATION_LEVEL = detectAnimationLevel();

// ── UTILIDADES INTERNAS ───────────────────────────────────────────────────────

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function seleccionarIdsAleatorios(n) {
  const pool = Array.from({ length: 78 }, (_, i) => i + 1);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

const orientacionRandom = () => Math.random() >= 0.5 ? 'recta' : 'invertida';

// ── CONSTRUCCIÓN DEL MAZO ─────────────────────────────────────────────────────

/**
 * Crea las 78 capas CSS del mazo visual dentro del container.
 * ✅ FIX: La clase anim-{nivel} se aplica al <body>, no al container,
 *    para que las reglas CSS de animations.css (body.anim-full ...) funcionen.
 *
 * @param {HTMLElement} container
 * @param {1|2|3} mazo
 */
export function inicializarMazo(container, mazo) {
  container.innerHTML = '';

  // ✅ FIX 1: aplicar clase de nivel al body (no al container)
  document.body.classList.add('anim-' + ANIMATION_LEVEL);

  const stack = document.createElement('div');
  stack.className = 'mazo-stack';

  for (let i = 0; i < 78; i++) {
    const capa = document.createElement('div');
    capa.className = `carta-stack-layer mazo-${mazo}`;
    capa.style.transform = `translateZ(${i * 0.5}px)`;
    capa.dataset.indice = i;
    stack.appendChild(capa);
  }

  container.appendChild(stack);
}

// ── FASES DE ANIMACIÓN (privadas) ─────────────────────────────────────────────

async function faseMezclar(stack) {
  const capas = Array.from(stack.querySelectorAll('.carta-stack-layer'));
  if (ANIMATION_LEVEL === 'none') return;
  if (ANIMATION_LEVEL === 'minimal') {
    stack.style.transition = 'opacity 0.8s';
    stack.style.opacity = '0.7';
    await delay(800);
    stack.style.opacity = '1';
    return;
  }
  const animaciones = capas.map((capa, i) => {
    const signo    = i % 2 === 0 ? 1 : -1;
    const offset   = signo * (10 + Math.random() * 20);
    const rotation = signo * (2 + Math.random() * 5);
    const opts     = { duration: 400, easing: 'ease-out', fill: 'forwards' };
    return capa.animate([
      { transform: `translateZ(${i * 0.5}px)` },
      { transform: `translateZ(${i * 0.5}px) translateX(${offset}px) rotate(${rotation}deg)` },
      { transform: `translateZ(${i * 0.5}px)` }
    ], { ...opts, delay: i * 2 });
  });
  await Promise.all(animaciones.map(a => a.finished));
}

async function faseCortar(stack) {
  const capas = Array.from(stack.querySelectorAll('.carta-stack-layer'));
  const mitad = Math.floor(capas.length / 2);
  if (ANIMATION_LEVEL === 'none') return;
  if (ANIMATION_LEVEL === 'minimal') { await delay(600); return; }
  const parte1 = capas.slice(0, mitad);
  const parte2 = capas.slice(mitad);
  const mover = (grupo, dx, duracion) =>
    grupo.map(c => c.animate([
      { transform: c.style.transform },
      { transform: c.style.transform + ` translateX(${dx}px)` },
      { transform: c.style.transform }
    ], { duration: duracion, easing: 'ease-in-out', fill: 'forwards' }));
  const anim1 = mover(parte1,  30, 600);
  const anim2 = mover(parte2, -30, 600);
  await Promise.all([...anim1, ...anim2].map(a => a.finished));
}

async function faseRemezclar(stack) {
  const capas = Array.from(stack.querySelectorAll('.carta-stack-layer'));
  if (ANIMATION_LEVEL === 'none') return;
  if (ANIMATION_LEVEL === 'minimal') { await delay(800); return; }
  const animaciones = capas.map((capa, i) => {
    const signo  = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
    const offset = signo * (5 + Math.random() * 10);
    return capa.animate([
      { transform: `translateZ(${i * 0.5}px)` },
      { transform: `translateZ(${i * 0.5}px) translateX(${offset}px)` },
      { transform: `translateZ(${i * 0.5}px)` }
    ], { duration: 800, easing: 'ease-in-out', fill: 'forwards', delay: i * 1.5 });
  });
  await Promise.all(animaciones.map(a => a.finished));
}

async function faseCorteFinal(stack) {
  if (ANIMATION_LEVEL === 'none') return;
  if (ANIMATION_LEVEL === 'minimal') { await delay(400); return; }
  const anim = stack.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(0.97)' },
    { transform: 'scale(1)' }
  ], { duration: 400, easing: 'ease-in-out' });
  await anim.finished;
}

async function faseRepartir(stack, numCartas, cartasReveladas) {
  const capas = Array.from(stack.querySelectorAll('.carta-stack-layer'));
  if (ANIMATION_LEVEL === 'none') {
    capas.slice(0, numCartas).forEach(c => c.classList.add('visible', 'carta-repartida', 'carta-revelada'));
    return;
  }
  for (let i = 0; i < numCartas; i++) {
    const capa  = capas[capas.length - 1 - i];
    const xDest = (i - (numCartas - 1) / 2) * 80;
    const animOpts = { duration: 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' };
    const keyframes = ANIMATION_LEVEL === 'minimal'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { transform: `translateZ(${(capas.length - 1 - i) * 0.5}px)` },
          { transform: `translateX(${xDest}px) translateY(-30px) translateZ(40px)` }
        ];
    const anim = capa.animate(keyframes, animOpts);
    // ✅ FIX 2: añadir carta-revelada para activar el keyframe flipIn del CSS
    capa.classList.add('visible', 'carta-repartida', 'carta-revelada');
    if (i < numCartas - 1) await delay(120);
    else await anim.finished;
  }
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

export async function ejecutarAnimacionCompleta(container, numCartas, callback) {
  const stack = container.querySelector('.mazo-stack');
  if (!stack) {
    console.error('[animations.js] .mazo-stack no encontrado en el container');
    return;
  }

  const ids             = seleccionarIdsAleatorios(numCartas);
  const cartasReveladas = ids.map(id => ({ id, orientacion: orientacionRandom() }));

  if (ANIMATION_LEVEL === 'none') {
    await faseRepartir(stack, numCartas, cartasReveladas);
    callback(cartasReveladas);
    return;
  }

  await faseMezclar(stack);
  await faseCortar(stack);
  await faseRemezclar(stack);
  await faseCorteFinal(stack);
  await faseRepartir(stack, numCartas, cartasReveladas);

  callback(cartasReveladas);
}

export function resetearMazo(container) {
  const capas = container.querySelectorAll('.carta-stack-layer');
  capas.forEach(c => {
    c.classList.remove('visible', 'carta-repartida', 'carta-revelada');
    c.style.transform = '';
    c.getAnimations().forEach(a => a.cancel());
  });
}