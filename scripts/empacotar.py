"""
Empacota a extensão num .zip pronto para enviar à Chrome Web Store.

A loja aceita apenas um zip com o manifest.json na raiz — nada de pasta
envolvendo tudo. Este script cuida disso e confere o básico antes.

Uso:  python scripts/empacotar.py
Saída: dist/vertion-atendimento-<versao>.zip
"""

import json
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
EXTENSAO = RAIZ / "extension"
DESTINO = RAIZ / "dist"

IGNORAR = {".DS_Store", "Thumbs.db"}


def conferir(manifest: dict) -> list[str]:
    """Erros que a loja recusaria — melhor descobrir aqui do que lá."""
    problemas = []

    for tamanho in ("16", "48", "128"):
        icone = EXTENSAO / manifest.get("icons", {}).get(tamanho, "")
        if not icone.is_file():
            problemas.append(f"falta o ícone de {tamanho}px")

    for script in manifest.get("content_scripts", [{}])[0].get("js", []):
        if not (EXTENSAO / script).is_file():
            problemas.append(f"script não encontrado: {script}")

    popup = manifest.get("action", {}).get("default_popup")
    if popup and not (EXTENSAO / popup).is_file():
        problemas.append(f"popup não encontrado: {popup}")

    if len(manifest.get("description", "")) > 132:
        problemas.append("a descrição passa de 132 caracteres (limite da loja)")

    return problemas


def main() -> None:
    manifest = json.loads((EXTENSAO / "manifest.json").read_text(encoding="utf-8"))

    problemas = conferir(manifest)
    if problemas:
        print("Não empacotei. Resolva antes:")
        for p in problemas:
            print(f"  - {p}")
        raise SystemExit(1)

    DESTINO.mkdir(exist_ok=True)
    versao = manifest["version"]
    caminho = DESTINO / f"vertion-atendimento-{versao}.zip"

    arquivos = [
        p for p in sorted(EXTENSAO.rglob("*")) if p.is_file() and p.name not in IGNORAR
    ]

    with zipfile.ZipFile(caminho, "w", zipfile.ZIP_DEFLATED) as zip_:
        for arquivo in arquivos:
            zip_.write(arquivo, arquivo.relative_to(EXTENSAO))

    print(f"pacote: {caminho.relative_to(RAIZ)}")
    print(f"versão: {versao}")
    print(f"arquivos: {len(arquivos)}")
    print(f"tamanho: {caminho.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
