"""
Gera as imagens do catálogo do WhatsApp Business na identidade da Vertion.

Quadradas (1080x1080), fundo branco, roxo da marca como acento e preto no
texto — a mesma paleta do site. Sem número inventado.

Uso:  python scripts/gerar-catalogo.py
Saída: catalogo/*.png
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

LARGURA = ALTURA = 1080
MARGEM = 84

BRANCO = (255, 255, 255)
ROXO = (122, 22, 224)
ROXO_CLARO = (239, 228, 253)
ROXO_ESCURO = (76, 12, 144)
TINTA = (18, 16, 27)
TINTA_SUAVE = (86, 80, 104)
LINHA = (231, 227, 241)

FONTES = Path("C:/Windows/Fonts")
NEGRITO = FONTES / "seguibl.ttf"      # Segoe UI Black
SEMI = FONTES / "seguisb.ttf"         # Segoe UI Semibold
NORMAL = FONTES / "segoeui.ttf"

SERVICOS = [
    {
        "arquivo": "1-automacao",
        "numero": "01",
        "titulo": "Automação de\natendimento",
        "resumo": "Seu WhatsApp responde, agenda e filtra\ncliente sozinho, inclusive de madrugada.",
        "itens": ["Resposta automática 24h", "Agendamento sem conflito", "Lembrete antes do horário"],
    },
    {
        "arquivo": "2-sistemas",
        "numero": "02",
        "titulo": "Sistemas\nsob medida",
        "resumo": "Feito em cima do processo que você já usa,\nnão o contrário.",
        "itens": ["Do jeito que você trabalha", "Acesso por perfil", "Roda no celular e no PC"],
    },
    {
        "arquivo": "3-dashboards",
        "numero": "03",
        "titulo": "Dashboards",
        "resumo": "Os números do negócio num painel só,\natualizado sozinho.",
        "itens": ["Faturamento e agenda", "Atualização automática", "Abre no celular"],
    },
    {
        "arquivo": "4-sites",
        "numero": "04",
        "titulo": "Sites e\nlanding pages",
        "resumo": "Carrega rápido no celular, aparece no Google\ne dá confiança pro visitante te chamar.",
        "itens": ["No ar em 3 a 7 dias úteis", "Pronto pro Google", "Botão de WhatsApp direto"],
    },
]


def fonte(caminho: Path, tamanho: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(caminho), tamanho)


def desenhar(servico: dict, destino: Path) -> Path:
    imagem = Image.new("RGB", (LARGURA, ALTURA), BRANCO)
    d = ImageDraw.Draw(imagem)

    # Faixa roxa à esquerda: a assinatura visual que amarra os quatro cartões.
    d.rectangle([0, 0, 14, ALTURA], fill=ROXO)

    # Respiro roxo bem claro no canto superior direito.
    d.ellipse([LARGURA - 340, -240, LARGURA + 140, 240], fill=ROXO_CLARO)

    # Marca
    d.text((MARGEM, 72), "VERTION STACK", font=fonte(SEMI, 26), fill=TINTA)
    d.text((MARGEM, 110), "tecnologia sob medida", font=fonte(NORMAL, 24), fill=TINTA_SUAVE)

    # Número do serviço, discreto no topo direito
    d.text((LARGURA - MARGEM, 76), servico["numero"], font=fonte(NEGRITO, 46),
           fill=ROXO, anchor="ra")

    # Título
    y = 268
    for linha in servico["titulo"].split("\n"):
        d.text((MARGEM, y), linha, font=fonte(NEGRITO, 82), fill=TINTA)
        y += 94

    # Régua roxa abaixo do título
    y += 18
    d.rectangle([MARGEM, y, MARGEM + 96, y + 7], fill=ROXO)
    y += 58

    # Resumo
    for linha in servico["resumo"].split("\n"):
        d.text((MARGEM, y), linha, font=fonte(NORMAL, 34), fill=TINTA_SUAVE)
        y += 48

    # Lista de entregas, cada uma com um marcador roxo
    y += 46
    for item in servico["itens"]:
        centro = y + 17
        d.ellipse([MARGEM, centro - 9, MARGEM + 18, centro + 9], fill=ROXO)
        d.text((MARGEM + 42, y), item, font=fonte(SEMI, 33), fill=TINTA)
        y += 66

    # Rodapé
    d.line([MARGEM, ALTURA - 128, LARGURA - MARGEM, ALTURA - 128], fill=LINHA, width=2)
    d.text((MARGEM, ALTURA - 96), "vertionstack.com", font=fonte(SEMI, 30), fill=ROXO_ESCURO)
    d.text((LARGURA - MARGEM, ALTURA - 96), "Rio de Janeiro · todo o Brasil",
           font=fonte(NORMAL, 27), fill=TINTA_SUAVE, anchor="ra")

    caminho = destino / f"{servico['arquivo']}.png"
    imagem.save(caminho, "PNG", optimize=True)
    return caminho


def main() -> None:
    destino = Path(__file__).resolve().parent.parent / "catalogo"
    destino.mkdir(exist_ok=True)
    for servico in SERVICOS:
        caminho = desenhar(servico, destino)
        print(f"gerado: {caminho.name}  ({caminho.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
