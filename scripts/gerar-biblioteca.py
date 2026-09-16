"""
Leva as respostas de src/lib/respostas.json para dentro da extensão.

A fonte única é o JSON. Este script escreve o arquivo que a extensão carrega,
para os dois nunca saírem do lugar.

Rode sempre que editar as respostas, antes de empacotar:
    python scripts/gerar-biblioteca.py
"""

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "src" / "lib" / "respostas.json"
DESTINO = RAIZ / "extension" / "src" / "biblioteca.js"

CABECALHO = """/**
 * Biblioteca de respostas da equipe.
 *
 * NÃO EDITE ESTE ARQUIVO À MÃO — ele é gerado.
 * Edite src/lib/respostas.json e rode:  python scripts/gerar-biblioteca.py
 *
 * {nome} e {primeiro_nome} são trocados pelo contato da conversa aberta.
 */

globalThis.VertionBiblioteca = """


def main() -> None:
    respostas = json.loads(ORIGEM.read_text(encoding="utf-8"))

    atalhos = [r["atalho"] for r in respostas]
    repetidos = {a for a in atalhos if atalhos.count(a) > 1}
    if repetidos:
        raise SystemExit(f"atalho repetido no JSON: {', '.join(sorted(repetidos))}")

    corpo = json.dumps(respostas, ensure_ascii=False, indent=2)
    DESTINO.write_text(f"{CABECALHO}{corpo};\n", encoding="utf-8")

    print(f"gerado: {DESTINO.relative_to(RAIZ)}")
    print(f"respostas: {len(respostas)}")
    print(f"atalhos: {', '.join('/' + a for a in atalhos)}")


if __name__ == "__main__":
    main()
