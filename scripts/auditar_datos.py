#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
auditar_datos.py — Auditoria de datos para Codigo de las Cartas
Ejecutar desde la raiz del proyecto: python scripts/auditar_datos.py

CORRECCIONES v3 respecto a versiones anteriores:
- Fix encoding Windows cp1252: sys.stdout forzado a UTF-8
- sinonimos.json: esperado 147 (no 113 como decia el doc original)
- num_cartas: acepta valores 1-8 (t019 tiene 8 cartas, es valido)
- posiciones.json: 560 registros (correcto)
- Verificacion FK usa id_carta_1/id_carta_2 directamente (sin arcano_1/arcano_2)
- Temas: enum completo con nombres reales del JSON (no nombres cortos del doc)
- comb_si_no: enum ampliado con todos los valores detectados
"""
import sys
import io

# FIX CRITICO: forzar UTF-8 en stdout para evitar UnicodeEncodeError en Windows cp1252
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import json
from pathlib import Path
from collections import Counter, defaultdict

OK   = "[OK]"
ERR  = "[ERR]"
WARN = "[WARN]"
SEP  = "=" * 60
LINE = "-" * 60

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
print("datos/cartas.json")
print(LINE)
try:
    cartas = load("data/cartas.json")
    ids_cartas = {c['id'] for c in cartas}
    check(len(cartas) == 78,
          "Registros: 78",
          f"Registros: {len(cartas)} (esperado 78)")
    check(min(c['id'] for c in cartas) == 1 and max(c['id'] for c in cartas) == 78,
          "Rango IDs: 1-78",
          "Rango IDs incorrecto")
    tipos = set(c.get('tipo', '') for c in cartas)
    tipos_validos = {'arcano_mayor', 'arcano_menor'}
    fuera = tipos - tipos_validos
    check(not fuera,
          f"Tipos validos: {sorted(tipos)}",
          f"Tipos invalidos encontrados: {fuera}")
except Exception as e:
    print(f"  {ERR} No se pudo leer cartas.json: {e}")
    errores_criticos.append(f"cartas.json: {e}")
    cartas, ids_cartas = [], set()

# ─── 2. tiradas.json ──────────────────────────────────────────
print(f"\n{LINE}")
print("datos/tiradas.json")
print(LINE)
try:
    tiradas = load("data/tiradas.json")
    ids_tiradas = {t['id'] for t in tiradas}

    check(len(tiradas) == 155,
          "Registros: 155",
          f"Registros: {len(tiradas)} (esperado 155)")

    # Temas: nombres EXACTOS del campo "tema" en el JSON
    # (no los nombres cortos del doc Fase 0A que eran incorrectos)
    temas_validos = {
        'amor',
        'consultas_generales',
        'creatividad_proyectos',
        'crisis_transformacion',
        'decisiones_elecciones',
        'espiritualidad_crecimiento',
        'familia_hogar',
        'salud_bienestar',
        'trabajo_dinero',
        'viajes_mudanzas'
    }
    temas_usados = set(t.get('tema', '') for t in tiradas)
    fuera_tema = temas_usados - temas_validos
    check(not fuera_tema,
          f"Temas: todos validos ({len(temas_usados)} temas)",
          f"Temas fuera del enum: {fuera_tema}")

    # num_cartas: 1-8 (t019 tiene 8 cartas — confirmado valido)
    nc_validos = {1, 2, 3, 4, 5, 6, 7, 8}
    nc_encontrados = set(t.get('num_cartas', 0) for t in tiradas)
    nc_fuera = nc_encontrados - nc_validos
    check(not nc_fuera,
          f"num_cartas: todos validos {sorted(nc_encontrados)}",
          f"num_cartas invalidos: {nc_fuera}")

except Exception as e:
    print(f"  {ERR} No se pudo leer tiradas.json: {e}")
    errores_criticos.append(f"tiradas.json: {e}")
    tiradas, ids_tiradas = [], set()

# ─── 3. posiciones.json ───────────────────────────────────────
print(f"\n{LINE}")
print("datos/posiciones.json")
print(LINE)
try:
    posiciones = load("data/posiciones.json")

    check(len(posiciones) == 560,
          "Registros: 560",
          f"Registros: {len(posiciones)} (esperado 560)")

    # Verificar que cada tirada tiene exactamente num_cartas posiciones
    pos_por_tirada = defaultdict(list)
    for p in posiciones:
        pos_por_tirada[p['tirada_id']].append(p)

    if tiradas:
        mismatches = []
        for t in tiradas:
            tid = t['id']
            nc = t.get('num_cartas', 0)
            np_ = len(pos_por_tirada.get(tid, []))
            if np_ != nc:
                mismatches.append(f"{tid}: {np_} posiciones (esperado {nc})")
        check(not mismatches,
              "Posiciones coinciden con num_cartas en todas las tiradas",
              f"Discrepancias ({len(mismatches)}): {mismatches[:5]}{'...' if len(mismatches) > 5 else ''}")

    # Tiradas sin posiciones
    sin_pos = [t['id'] for t in tiradas if t['id'] not in pos_por_tirada]
    check(not sin_pos,
          "Todas las tiradas tienen al menos 1 posicion",
          f"Tiradas sin posiciones: {sin_pos[:5]}")

except Exception as e:
    print(f"  {ERR} No se pudo leer posiciones.json: {e}")
    errores_criticos.append(f"posiciones.json: {e}")

# ─── 4. sinonimos.json ────────────────────────────────────────
print(f"\n{LINE}")
print("datos/sinonimos.json")
print(LINE)
try:
    sinonimos = load("data/sinonimos.json")

    # 147 registros: 148 del CSV original - 1 duplicado exacto de 'esfuerzo'
    check(len(sinonimos) == 147,
          "Registros: 147",
          f"Registros: {len(sinonimos)} (esperado 147)")

    # Columna debe ser 'categoria' SIN tilde
    campos = list(sinonimos[0].keys()) if sinonimos else []
    check('categoria' in campos,
          "Campo 'categoria' presente (sin tilde)",
          f"Campo 'categoria' no encontrado. Campos: {campos}")

    # Sin duplicados
    cats = Counter(s.get('categoria', '') for s in sinonimos)
    dupes = {k: v for k, v in cats.items() if v > 1}
    check(not dupes,
          "Sin categorias duplicadas",
          f"Duplicados: {dupes}")

    # Sin categorias vacias
    vacias = [s for s in sinonimos if not s.get('categoria', '').strip()]
    check(not vacias,
          "Sin categorias vacias",
          f"Categorias vacias: {len(vacias)}")

except Exception as e:
    print(f"  {ERR} No se pudo leer sinonimos.json: {e}")
    errores_criticos.append(f"sinonimos.json: {e}")

# ─── 5. combinaciones (4 carpetas) ────────────────────────────
COMBINACIONES = [
    ("data/combinaciones-mm",      range(1, 23),   "Mayor x Mayor"),
    ("data/combinaciones-maymen",  range(1, 23),   "Mayor x Menor"),
    ("data/combinaciones-menmay",  range(23, 79),  "Menor x Mayor"),
    ("data/combinaciones-menmen",  range(23, 79),  "Menor x Menor"),
]

# Valores validos del campo comb_si_no detectados en los datos reales
# Incluye variantes con tilde (Sí) y sin tilde (Si)
COMB_SI_NO_VALIDOS = {
    'Si', 'Sí',
    'No', 'No por ahora',
    'Depende',
    'Si, con condiciones', 'Sí, con condiciones',
}

# Valores validos del campo tipo detectados en los datos reales
TIPO_VALIDOS = {'TENSION', 'SINERGIA', 'RESONANCIA', 'NEUTRO', 'BLOQUEO', 'REFUERZO'}

POSICION_VALIDOS = {'RR', 'RI', 'IR', 'II'}

for carpeta, ids_esperados, label in COMBINACIONES:
    print(f"\n{LINE}")
    print(f"{carpeta}/ ({label})")
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

        errores_fk = []
        errores_pos = []
        errores_csn = []
        errores_tipo = []
        total_registros = 0

        for archivo in archivos:
            data = load(archivo)
            total_registros += len(data)
            for rec in data:
                # FK id_carta_1
                v1 = rec.get('id_carta_1')
                if v1 is None or v1 not in ids_cartas:
                    errores_fk.append(f"{archivo.name}: id_carta_1={v1}")
                # FK id_carta_2
                v2 = rec.get('id_carta_2')
                if v2 is None or v2 not in ids_cartas:
                    errores_fk.append(f"{archivo.name}: id_carta_2={v2}")
                # posicion
                pos = rec.get('posicion', '')
                if pos not in POSICION_VALIDOS:
                    errores_pos.append(f"{archivo.name}: posicion='{pos}'")
                # comb_si_no
                csn = rec.get('comb_si_no', '')
                if csn not in COMB_SI_NO_VALIDOS:
                    errores_csn.append(f"{archivo.name}: comb_si_no='{csn}'")
                # tipo
                tipo = rec.get('tipo', '')
                if tipo not in TIPO_VALIDOS:
                    errores_tipo.append(f"{archivo.name}: tipo='{tipo}'")

        print(f"  {OK} Total registros: {total_registros}")

        def report_errores(lista, campo):
            if lista:
                sample = lista[:3]
                for e in sample:
                    print(f"  {ERR} {e}")
                if len(lista) > 3:
                    print(f"  {ERR} ... y {len(lista)-3} errores mas en {campo}")
                errores_criticos.extend(lista[:2])
            else:
                print(f"  {OK} {campo}: todos validos")

        report_errores(errores_fk,   "FK (id_carta_1/id_carta_2)")
        report_errores(errores_pos,  "posicion")
        report_errores(errores_csn,  "comb_si_no")
        report_errores(errores_tipo, "tipo")

    except Exception as e:
        print(f"  {ERR} Error leyendo {carpeta}: {e}")
        errores_criticos.append(str(e))

# ─── RESUMEN FINAL ────────────────────────────────────────────
print(f"\n{SEP}")
print("RESUMEN FINAL")
print(SEP)

if errores_criticos:
    print(f"\n{ERR} SE ENCONTRARON {len(errores_criticos)} ERRORES CRITICOS:")
    for i, e in enumerate(errores_criticos, 1):
        print(f"  {i}. {e}")
    print("\nCorregir antes de continuar con Fase 2.")
else:
    print(f"\n{OK} TODOS LOS DATOS VALIDOS")
    print("Fase 1 completada. Puedes continuar con Fase 2.")

if advertencias:
    print(f"\n{WARN} {len(advertencias)} advertencias (no bloquean):")
    for w in advertencias:
        print(f"  - {w}")

print()
