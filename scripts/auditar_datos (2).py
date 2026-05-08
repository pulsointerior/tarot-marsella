#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
auditar_datos.py — Auditoria de datos para Codigo de las Cartas
Ejecutar desde la raiz del proyecto: python scripts/auditar_datos.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import json
from pathlib import Path
from collections import Counter, defaultdict

OK    = "[OK]"
ERR   = "[ERR]"
WARN  = "[WARN]"
SEP   = "=" * 60
LINE  = "-" * 60

errores_criticos = []
advertencias = []

def check(condicion, msg_ok, msg_err, critico=True):
    if condicion:
        print(f"  {OK} {msg_ok}")
    else:
        print(f"  {ERR} {msg_err}")
        if critico:
            errores_criticos.append(msg_err)
        else:
            advertencias.append(msg_err)
    return condicion

def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

print(SEP)
print("AUDITORIA DE DATOS - Codigo de las Cartas")
print(SEP)

# ─── 1. cartas.json ───────────────────────────────────────────
print(f"\n{LINE}")
print("► data/cartas.json")
print(LINE)
try:
    cartas = load("data/cartas.json")
    ids_cartas = {c['id'] for c in cartas}
    check(len(cartas) == 78, "Registros: 78", f"Registros: {len(cartas)} (esperado 78)")
    check(min(c['id'] for c in cartas) == 1 and max(c['id'] for c in cartas) == 78,
          "Rango IDs: 1-78", "Rango IDs incorrecto")
    tipos = set(c.get('tipo','') for c in cartas)
    tipos_validos = {'arcano_mayor', 'arcano_menor'}
    fuera = tipos - tipos_validos
    check(not fuera, f"Tipos validos: {tipos}", f"Tipos invalidos: {fuera}")
except Exception as e:
    print(f"  {ERR} No se pudo leer: {e}")
    errores_criticos.append(f"cartas.json: {e}")
    cartas, ids_cartas = [], set()

# ─── 2. tiradas.json ──────────────────────────────────────────
print(f"\n{LINE}")
print("► data/tiradas.json")
print(LINE)
try:
    tiradas = load("data/tiradas.json")
    ids_tiradas = {t['id'] for t in tiradas}
    check(len(tiradas) == 155, "Registros: 155", f"Registros: {len(tiradas)} (esperado 155)")
    
    temas_validos = {'amor','familia_hogar','trabajo_dinero','salud_bienestar',
                     'decisiones_elecciones','creatividad_proyectos',
                     'espiritualidad_crecimiento','consultas_generales',
                     'crisis_transformacion','viajes_mudanzas'}
    temas_usados = set(t.get('tema','') for t in tiradas)
    fuera_tema = temas_usados - temas_validos
    check(not fuera_tema, f"Temas validos", f"Temas fuera del enum: {fuera_tema}")
    
    # num_cartas: 1-8 permitidos
    nc_validos = {1,2,3,4,5,6,7,8}
    nc_fuera = set(t.get('num_cartas',0) for t in tiradas) - nc_validos
    check(not nc_fuera, "num_cartas: valores validos (1-8)", f"num_cartas invalidos: {nc_fuera}")
except Exception as e:
    print(f"  {ERR} No se pudo leer: {e}")
    errores_criticos.append(f"tiradas.json: {e}")
    tiradas, ids_tiradas = [], set()

# ─── 3. posiciones.json ───────────────────────────────────────
print(f"\n{LINE}")
print("► data/posiciones.json")
print(LINE)
try:
    posiciones = load("data/posiciones.json")
    check(len(posiciones) == 560, "Registros: 560", f"Registros: {len(posiciones)} (esperado 560)")
    
    # cada tirada en tiradas.json debe tener posiciones y el num correcto
    pos_por_tirada = defaultdict(list)
    for p in posiciones:
        pos_por_tirada[p['tirada_id']].append(p)
    
    if tiradas:
        mismatches = []
        for t in tiradas:
            tid = t['id']
            nc = t.get('num_cartas', 0)
            np = len(pos_por_tirada.get(tid, []))
            if np != nc:
                mismatches.append(f"{tid}: tiene {np} pos, esperado {nc}")
        check(not mismatches, "Posiciones coinciden con num_cartas en todas las tiradas",
              f"Discrepancias posiciones/num_cartas: {mismatches[:5]}{'...' if len(mismatches)>5 else ''}")
except Exception as e:
    print(f"  {ERR} No se pudo leer: {e}")
    errores_criticos.append(f"posiciones.json: {e}")

# ─── 4. sinonimos.json ────────────────────────────────────────
print(f"\n{LINE}")
print("► data/sinonimos.json")
print(LINE)
try:
    sinonimos = load("data/sinonimos.json")
    check(len(sinonimos) == 147, "Registros: 147", f"Registros: {len(sinonimos)} (esperado 147)")
    
    # columna debe ser 'categoria' sin tilde
    campos = list(sinonimos[0].keys()) if sinonimos else []
    check('categoria' in campos, "Campo 'categoria' presente (sin tilde)",
          f"Campo 'categoria' no encontrado. Campos: {campos}")
    
    # no duplicados
    cats = Counter(s.get('categoria','') for s in sinonimos)
    dupes = {k:v for k,v in cats.items() if v > 1}
    check(not dupes, "Sin categorias duplicadas", f"Duplicados: {dupes}")
    
    # sin vacias
    vacias = [s for s in sinonimos if not s.get('categoria','').strip()]
    check(not vacias, "Sin categorias vacias", f"Categorias vacias: {len(vacias)}")
except Exception as e:
    print(f"  {ERR} No se pudo leer: {e}")
    errores_criticos.append(f"sinonimos.json: {e}")

# ─── 5. combinaciones (4 carpetas) ────────────────────────────
COMBINACIONES = [
    ("data/combinaciones-mm",      range(1,23),   "Mayor x Mayor"),
    ("data/combinaciones-maymen",  range(1,23),   "Mayor x Menor"),
    ("data/combinaciones-menmay",  range(23,79),  "Menor x Mayor"),
    ("data/combinaciones-menmen",  range(23,79),  "Menor x Menor"),
]
COMB_SI_NO_VALIDOS = {'Si', 'No', 'No por ahora', 'Depende'}
TIPO_VALIDOS = {'TENSION', 'SINERGIA', 'NEUTRO', 'BLOQUEO', 'REFUERZO'}
POSICION_VALIDOS = {'RR', 'RI', 'IR', 'II'}

for carpeta, ids_esperados, label in COMBINACIONES:
    print(f"\n{LINE}")
    print(f"► {carpeta}/ ({label})")
    print(LINE)
    try:
        p = Path(carpeta)
        if not p.exists():
            print(f"  {ERR} Carpeta no encontrada: {carpeta}")
            errores_criticos.append(f"{carpeta}: no existe")
            continue
        
        archivos = sorted(p.glob("*.json"), key=lambda x: int(x.stem))
        ids_encontrados = {int(f.stem) for f in archivos}
        ids_esp = set(ids_esperados)
        
        check(ids_encontrados == ids_esp,
              f"Archivos: {len(archivos)} (IDs {min(ids_esp)}-{max(ids_esp)})",
              f"IDs incorrectos. Faltan: {ids_esp - ids_encontrados}, Sobran: {ids_encontrados - ids_esp}")
        
        # muestra de verificacion: primer y ultimo archivo
        errores_datos = []
        total_registros = 0
        for archivo in archivos:
            data = load(archivo)
            total_registros += len(data)
            for rec in data:
                # FK
                for fk in ['id_carta_1', 'id_carta_2']:
                    v = rec.get(fk)
                    if v is None or v not in ids_cartas:
                        errores_datos.append(f"{archivo.name}: {fk}={v} no en cartas.json")
                # posicion
                pos = rec.get('posicion','')
                if pos not in POSICION_VALIDOS:
                    errores_datos.append(f"{archivo.name}: posicion='{pos}' invalida")
                # comb_si_no
                csn = rec.get('comb_si_no','')
                if csn not in COMB_SI_NO_VALIDOS:
                    errores_datos.append(f"{archivo.name}: comb_si_no='{csn}' invalida")
        
        print(f"  {OK} Total registros: {total_registros}")
        
        if errores_datos:
            # mostrar hasta 5
            for e in errores_datos[:5]:
                print(f"  {ERR} {e}")
            if len(errores_datos) > 5:
                print(f"  {ERR} ... y {len(errores_datos)-5} errores mas")
            errores_criticos.extend(errores_datos[:3])
        else:
            print(f"  {OK} FK, posicion y comb_si_no: todos validos")
    
    except Exception as e:
        print(f"  {ERR} Error leyendo {carpeta}: {e}")
        errores_criticos.append(str(e))

# ─── RESUMEN FINAL ────────────────────────────────────────────
print(f"\n{SEP}")
print("RESUMEN FINAL")
print(SEP)
if errores_criticos:
    print(f"\n[ERR] SE ENCONTRARON {len(errores_criticos)} ERRORES CRITICOS:")
    for i, e in enumerate(errores_criticos, 1):
        print(f"  {i}. {e}")
else:
    print("\n[OK] TODOS LOS DATOS VALIDOS - Fase 1 completada")

if advertencias:
    print(f"\n[WARN] {len(advertencias)} advertencias:")
    for w in advertencias:
        print(f"  - {w}")

print()
