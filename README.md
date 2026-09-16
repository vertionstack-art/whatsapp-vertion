# Vertion Atendimento

Ferramentas internas da Vertion Stack para atender no WhatsApp com mais velocidade.

## O que tem aqui

| Pasta | O que é |
|---|---|
| `extension/` | Extensão de Chrome que vive dentro do WhatsApp Web |
| `src/lib/respostas.json` | **A biblioteca da equipe.** É este arquivo que todo mundo enxerga |
| `src/app/api/respostas/` | Entrega a biblioteca para a extensão |
| `scripts/` | Geradores de ícone, das artes do catálogo e do pacote da loja |

## A regra que guia o projeto

**A extensão nunca envia mensagem sozinha.** Ela escreve o texto no campo e para — quem confere e aperta enviar é a pessoa.

Isso não é limitação técnica, é escolha: enviar mensagem automaticamente pelo WhatsApp Web é o que faz a Meta banir número. Como esse número é o canal de vendas da empresa, não vale o risco.

As mensagens automáticas de verdade (saudação e ausência) ficam no próprio WhatsApp Business, em **Ferramentas comerciais** — são nativas, gratuitas e sem risco.

## O que a extensão faz

- **Respostas prontas** com busca, setas e Enter para inserir
- **Atalho no campo**: digite `/preco` na conversa e a lista abre já filtrada
- **Variáveis**: `{primeiro_nome}` e `{nome}` viram o nome de quem está na conversa
- **Ficha do cliente**: anotação privada, etapa do funil e data para voltar a falar
- **Lembrete vencido** aparece como contador vermelho no botão
- **Contador de uso** por resposta, para saber o que vale manter

## Como instalar

1. Chrome em `chrome://extensions`
2. Ligue o **Modo do desenvolvedor**
3. **Carregar sem compactação** → escolha a pasta `extension`
4. Abra `web.whatsapp.com` e recarregue

Atalho: **Ctrl + Shift + Espaço**.

## Como atualizar as respostas de todo mundo

Este é o ponto: **ninguém precisa reinstalar nem recarregar nada.**

1. Edite `src/lib/respostas.json` (dá para fazer pelo site do GitHub, direto no navegador)
2. Faça o commit
3. A Vercel publica sozinha
4. Em até 30 minutos a extensão de cada pessoa busca a lista nova — ou na hora, se alguém clicar em **Atualizar** no popup

Cada pessoa ainda pode criar **respostas próprias** no popup. Se um atalho existir nos dois lugares, a pessoal ganha.

Se a internet cair, a extensão usa a última lista que baixou. Ela nunca fica sem respostas.

### Se o endereço da Vercel for outro

O padrão é `https://whatsapp-vertion.vercel.app/api/respostas`. Para apontar para outro: popup → **Configuração avançada** → cole o endereço → **Salvar endereço**.

## Publicar na Chrome Web Store

Enquanto a extensão for instalada "sem compactação", mudanças de **código** exigem um clique em recarregar. Publicando na loja, o Chrome atualiza sozinho para todo mundo.

Custa **US$ 5, uma vez só** (vale para quantas extensões quiser, para sempre).

1. Gere o pacote:
   ```
   python scripts/empacotar.py
   ```
   O zip sai em `dist/`.

2. Acesse o [painel de desenvolvedor](https://chrome.google.com/webstore/devconsole) e pague os US$ 5 de cadastro.

3. **Novo item** → envie o zip.

4. Preencha a ficha:
   - **Visibilidade: Não listada.** Só quem tem o link instala — não aparece em busca
   - Descrição: o texto do `manifest.json` serve
   - Captura de tela 1280×800: um print do painel aberto no WhatsApp Web
   - Justificativa das permissões: `storage` guarda as respostas e as fichas; o acesso a `web.whatsapp.com` é onde a extensão desenha o painel; o acesso ao domínio da Vercel é de onde ela baixa a biblioteca
   - Uso de dados: nada sai do navegador da pessoa, exceto a busca da biblioteca (que é leitura pública)

5. Enviar para revisão. Costuma levar alguns dias.

6. Aprovado, mande o link para os sócios. A partir daí, toda nova versão que você enviar chega sozinha.

### Ao subir uma versão nova

Aumente o `version` no `manifest.json` antes de empacotar — a loja recusa um número igual ou menor que o já publicado.
