"""
Gera os ícones da extensão (16, 48 e 128 px) na identidade da Vertion.

Um raio branco sobre o roxo da marca — o mesmo símbolo do botão flutuante
dentro do WhatsApp Web, para a pessoa reconhecer na barra do Chrome.

Uso:  python scripts/gerar-icones.py
Saída: extension/icons/icon-*.png
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROXO = (122, 22, 224, 255)
BRANCO = (255, 255, 255, 255)
TAMANHOS = (16, 48, 128)

# Raio desenhado em coordenadas de 0 a 1, para escalar sem perder proporção.
RAIO = [
    (0.56, 0.10),
    (0.20, 0.55),
    (0.45, 0.55),
    (0.40, 0.90),
    (0.78, 0.44),
    (0.52, 0.44),
]


def desenhar(tamanho: int, destino: Path) -> Path:
    # Desenha grande e reduz no final: é o que deixa a borda lisa nos 16px.
    escala = 8
    lado = tamanho * escala
    imagem = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(imagem)

    raio_canto = int(lado * 0.22)
    d.rounded_rectangle([0, 0, lado - 1, lado - 1], radius=raio_canto, fill=ROXO)
    d.polygon([(x * lado, y * lado) for x, y in RAIO], fill=BRANCO)

    imagem = imagem.resize((tamanho, tamanho), Image.LANCZOS)
    caminho = destino / f"icon-{tamanho}.png"
    imagem.save(caminho, "PNG", optimize=True)
    return caminho


def main() -> None:
    destino = Path(__file__).resolve().parent.parent / "extension" / "icons"
    destino.mkdir(parents=True, exist_ok=True)
    for tamanho in TAMANHOS:
        caminho = desenhar(tamanho, destino)
        print(f"gerado: {caminho.name}")


if __name__ == "__main__":
    main()
