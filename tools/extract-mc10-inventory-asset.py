#!/usr/bin/env python3
"""Extrai gui/inventory.png e gui/items.png diretamente do Minecraft 1.0.jar."""
from pathlib import Path
from zipfile import ZipFile
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JAR = Path.home() / ".sklauncher/versions/1.0/1.0.jar"
JAR = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_JAR
TARGET = ROOT / "public/assets/mc10/gui"

if not JAR.is_file():
    raise SystemExit(f"JAR não encontrado: {JAR}")

TARGET.mkdir(parents=True, exist_ok=True)

with ZipFile(JAR) as archive:
    names = set(archive.namelist())
    for asset in ("inventory.png", "items.png"):
        candidates = (f"gui/{asset}", f"/gui/{asset}")
        entry = next((name for name in candidates if name in names), None)
        if entry is None:
            raise SystemExit(f"{asset} não encontrado no JAR: {JAR}")
        data = archive.read(entry)
        if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
            raise SystemExit(f"Asset inválido: {entry}")
        width, height = struct.unpack(">II", data[16:24])
        if (width, height) != (256, 256):
            raise SystemExit(f"Dimensões inesperadas em {entry}: {width}x{height}")
        output = TARGET / asset
        output.write_bytes(data)
        print(f"Extraído: {output} ({width}x{height})")

print("Assets originais do Minecraft 1.0 extraídos.")
