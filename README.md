# Vertion Atendimento

Ferramentas internas da Vertion Stack para atender no WhatsApp com mais velocidade.

## O que tem aqui

| Pasta | O que é |
|---|---|
| `extension/` | Extensão de Chrome que coloca uma biblioteca de respostas prontas dentro do WhatsApp Web |
| `src/` | Painel web (Next.js). Ainda é o esqueleto — vai servir para a equipe editar as respostas em um lugar só |

## A regra que guia o projeto

**A extensão nunca envia mensagem sozinha.** Ela escreve o texto no campo e para por aí — quem confere e aperta enviar é a pessoa.

Isso não é limitação técnica, é escolha: enviar mensagem automaticamente pelo WhatsApp Web é o que faz a Meta banir número. Como esse número é o canal de vendas da empresa, não vale o risco.

As mensagens automáticas de verdade (saudação e ausência) ficam no próprio WhatsApp Business, em **Ferramentas comerciais** — são nativas, gratuitas e sem risco nenhum.

## Como instalar a extensão

1. Abra o Chrome em `chrome://extensions`
2. Ligue o **Modo do desenvolvedor**, no canto superior direito
3. Clique em **Carregar sem compactação**
4. Escolha a pasta `extension` deste projeto
5. Abra `web.whatsapp.com` e recarregue a página

Pronto: aparece um botão roxo no canto inferior direito.

## Como usar

- Clique no botão roxo, ou aperte **Ctrl + Shift + Espaço**
- Digite para buscar, use as setas para navegar
- **Enter** insere a resposta no campo da conversa
- Confira o texto e envie

Para cadastrar ou editar respostas, clique no ícone da extensão na barra do Chrome.

## Como compartilhar as respostas com os sócios

Por enquanto, cada pessoa tem a própria lista (ela acompanha a conta Google, então aparece em todos os computadores de quem instalou).

Para deixar todo mundo com a mesma lista: no popup da extensão, clique em **Exportar**, mande o arquivo para os sócios e peça para importarem.

Esse vaivém de arquivo é temporário — é exatamente o que o painel web vai resolver.
