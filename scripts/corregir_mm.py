#!/usr/bin/env python3
"""
corregir_mm.py
Corrige combinaciones-mm:
  - id_arcano_1     → id_carta_1
  - id_arcano_1.1   → id_carta_2
  - arcano_1/arcano_2 → eliminar (campos redundantes)

Ejecutar desde la raíz del proyecto:
  python scripts/corregir_mm.py
"""

import json
from pathlib import Path

VERDE   = "\033[92m"
ROJO    = "\033[91m"
AMARILLO= "\033[93m"
RESET   = "\033[0m"
NEGRITA = "\033[1m"

def ok(msg):   print(f"   {VERDE}✓{RESET} {msg}")
def err(msg):  print(f"   {ROJO}✗{RESET} {msg}")
def warn(msg): print(f"   {AMARILLO}⚠{RESET} {msg}")

CAMPOS_ELIMINAR = {"arcano_1", "arcano_2", "arcano_es_1", "arcano_es_2", "polaridad_1", "polaridad_2"}

carpeta = Path("data/combinaciones-mm")
ids = list(range(1, 23))

n_id1 = 0; n_id2 = 0; n_elim = 0

print(f"\n{NEGRITA}{'='*60}{RESET}")
print(f"{NEGRITA}CORRECCIÓN combinaciones-mm{RESET}")
print(f"{'='*60}")

for id_ in ids:
    ruta = carpeta / f"{id_}.json"
    if not ruta.exists():
        warn(f"Chunk {id_}.json no encontrado"); continue

    with open(ruta, encoding="utf-8") as f:
        registros = json.load(f)

    modificado = False
    nuevos = []
    for r in registros:

        # Renombrar id_arcano_1 → id_carta_1
        if "id_arcano_1" in r and "id_carta_1" not in r:
            r["id_carta_1"] = r.pop("id_arcano_1")
            n_id1 += 1; modificado = True
        elif "id_arcano_1" in r:
            del r["id_arcano_1"]
            modificado = True

        # Renombrar id_arcano_1.1 → id_carta_2
        if "id_arcano_1.1" in r and "id_carta_2" not in r:
            r["id_carta_2"] = r.pop("id_arcano_1.1")
            n_id2 += 1; modificado = True
        elif "id_arcano_1.1" in r:
            del r["id_arcano_1.1"]
            modificado = True

        # Eliminar campos redundantes
        for campo in CAMPOS_ELIMINAR:
            if campo in r:
                del r[campo]
                n_elim += 1; modificado = True

        nuevos.append(r)

    if modificado:
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(nuevos, f, ensure_ascii=False, separators=(",", ":"))

ok(f"id_carta_1 renombrado: {n_id1} registros")
ok(f"id_carta_2 renombrado: {n_id2} registros")
ok(f"Campos redundantes eliminados: {n_elim}")

# Verificación rápida
with open(carpeta / "1.json", encoding="utf-8") as f:
    muestra = json.load(f)
r0 = muestra[0]
print(f"\nVerificación registro 0:")
print(f"  id_carta_1 = {r0.get('id_carta_1')}")
print(f"  id_carta_2 = {r0.get('id_carta_2')}")
print(f"  Campos:    {list(r0.keys())}")

problemas = [c for c in r0.keys() if "arcano_1" in c or "arcano_2" in c or "id_arcano" in c]
if problemas:
    warn(f"Campos viejos aún presentes: {problemas}")
else:
    ok("Sin campos viejos ✓")

print(f"\nEjecuta la auditoría:")
print("  python scripts/auditar_datos.py")
