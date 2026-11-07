#!/usr/bin/env python3
"""Extrai os assets gráficos do Minecraft 1.0.jar para o port.

Uso:
  python3 tools/extract-mc10-assets.py
  python3 tools/extract-mc10-assets.py /caminho/para/1.0.jar
  python3 tools/extract-mc10-assets.py --force

Por padrão, não sobrescreve arquivos existentes.
"""
from pathlib import Path
from zipfile import ZipFile, BadZipFile
import argparse
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JAR = Path.home() / ".sklauncher/versions/1.0/1.0.jar"

# Caminho dentro do JAR -> caminho relativo à raiz do projeto.
ASSETS = {
    "terrain.png": "public/assets/terrain.png",
    "particles.png": "public/assets/mc10/particles.png",
    "font/default.png": "public/assets/mc10/font/default.png",
    "font/alternate.png": "public/assets/mc10/font/alternate.png",
    "font.txt": "public/assets/mc10/font/font.txt",
    "mob/char.png": "public/assets/mc10/char.png",
    "gui/gui.png": "public/assets/mc10/gui/gui.png",
    "gui/icons.png": "public/assets/mc10/gui/icons.png",
    "gui/inventory.png": "public/assets/mc10/gui/inventory.png",
    "gui/items.png": "public/assets/mc10/gui/items.png",
    "misc/explosion.png": "public/assets/mc10/explosion.png",
    "misc/footprint.png": "public/assets/mc10/footprint.png",
    "misc/shadow.png": "public/assets/mc10/shadow.png",
    "misc/grasscolor.png": "public/assets/grasscolor.png",
    "misc/foliagecolor.png": "public/assets/foliagecolor.png",
    # Tela de título / seleção de mundo.
    "gui/background.png": "public/assets/mc10/gui/background.png",
    "title/mclogo.png": "public/assets/mc10/title/mclogo.png",
    "title/splashes.txt": "public/assets/mc10/title/splashes.txt",
    "title/bg/panorama0.png": "public/assets/mc10/title/bg/panorama0.png",
    "title/bg/panorama1.png": "public/assets/mc10/title/bg/panorama1.png",
    "title/bg/panorama2.png": "public/assets/mc10/title/bg/panorama2.png",
    "title/bg/panorama3.png": "public/assets/mc10/title/bg/panorama3.png",
    "title/bg/panorama4.png": "public/assets/mc10/title/bg/panorama4.png",
    "title/bg/panorama5.png": "public/assets/mc10/title/bg/panorama5.png",
}

def valid_png(data: bytes) -> bool:
    return len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n"

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jar", nargs="?", type=Path, default=DEFAULT_JAR,
                        help="caminho do Minecraft 1.0.jar")
    parser.add_argument("--force", action="store_true",
                        help="sobrescreve os assets que já existem")
    args = parser.parse_args()
    jar = args.jar.expanduser()

    if not jar.is_file():
        print(f"JAR não encontrado: {jar}", file=sys.stderr)
        print("Informe o caminho: python3 tools/extract-mc10-assets.py /caminho/1.0.jar",
              file=sys.stderr)
        return 1

    extracted = skipped = 0
    try:
        with ZipFile(jar) as archive:
            names = set(archive.namelist())
            missing = [entry for entry in ASSETS if entry not in names]
            if missing:
                print("O JAR não parece ser o Minecraft 1.0 esperado.", file=sys.stderr)
                print("Entradas ausentes: " + ", ".join(missing), file=sys.stderr)
                return 2

            for entry, relative_target in ASSETS.items():
                target = ROOT / relative_target
                if target.exists() and not args.force:
                    print(f"Pulado (já existe): {relative_target}")
                    skipped += 1
                    continue

                data = archive.read(entry)
                if entry.endswith(".png") and not valid_png(data):
                    print(f"PNG inválido no JAR: {entry}", file=sys.stderr)
                    return 3

                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                if entry.endswith(".png"):
                    width, height = struct.unpack(">II", data[16:24])
                    print(f"Extraído: {relative_target} ({width}x{height})")
                else:
                    print(f"Extraído: {relative_target}")
                extracted += 1
    except BadZipFile:
        print(f"Arquivo inválido ou corrompido: {jar}", file=sys.stderr)
        return 4

    print(f"Concluído: {extracted} extraído(s), {skipped} já existente(s).")
    print("Os arquivos extraídos permanecem locais e não são enviados ao Git.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
