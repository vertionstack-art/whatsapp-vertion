/**
 * Central de atendimento da Vertion dentro do WhatsApp Web.
 *
 * Regra que guia todo este arquivo: a extensão NUNCA envia mensagem sozinha.
 * Ela escreve o texto no campo e para — quem confere e aperta enviar é a
 * pessoa. É isso que mantém o número longe de um banimento por automação.
 */

(() => {
  const ID_BOTAO = "vertion-botao";
  const ID_PAINEL = "vertion-painel";

  const D = globalThis.VertionDados;

  let respostas = [];
  let clientes = {};
  let config = {};
  let aba = "respostas";
  let indiceSelecionado = 0;
  let contatoAtual = "";
  let fichaAtual = { nota: "", status: "", lembrete: "" };
  let modoAtalho = false;

  /* ── leitura do WhatsApp ────────────────────────────────────────── */

  /**
   * Campo de digitação da conversa aberta. O WhatsApp troca de classe a cada
   * atualização, então procuramos pela característica que não muda: um
   * contenteditable dentro do rodapé.
   */
  function acharCampo() {
    return (
      document.querySelector('footer div[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('#main div[contenteditable="true"]')
    );
  }

  /** Campo de busca da lista de conversas, na coluna da esquerda. */
  function acharBusca() {
    return document.querySelector('#side div[contenteditable="true"]');
  }

  function nomeDoContato() {
    const cabecalho = document.querySelector("#main header");
    if (!cabecalho) return "";
    const comTitulo = cabecalho.querySelector("span[title]");
    if (comTitulo?.getAttribute("title")) return comTitulo.getAttribute("title").trim();
    return cabecalho.querySelector("span")?.textContent?.trim() ?? "";
  }

  /* ── variáveis ──────────────────────────────────────────────────── */

  function saudacaoDoMomento() {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  }

  function aplicarVariaveis(texto) {
    const agora = new Date();
    const nome = contatoAtual;

    let saida = texto
      .replaceAll("{primeiro_nome}", (nome || "").trim().split(/\s+/)[0] ?? "")
      .replaceAll("{nome}", nome)
      .replaceAll("{saudacao}", saudacaoDoMomento())
      .replaceAll("{meu_nome}", config.meuNome ?? "")
      .replaceAll("{data}", agora.toLocaleDateString("pt-BR"))
      .replaceAll("{hora}", agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

    // Sem nome na conversa, não deixa vírgula nem espaço sobrando.
    saida = saida.replace(/\s+([,!?.])/g, "$1").replace(/,\s*([!?.])/g, "$1");

    if (config.assinatura?.trim()) saida += `\n\n${config.assinatura.trim()}`;
    return saida;
  }

  /** Campos preenchíveis: [[valor]] vira uma perguntinha antes de inserir. */
  function camposDe(texto) {
    return [...new Set([...texto.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim()))];
  }

  /* ── escrita no campo (sem enviar) ──────────────────────────────── */

  function selecionarConteudo(campo, tudo) {
    const selecao = window.getSelection();
    selecao.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(campo);
    if (!tudo) range.collapse(false);
    selecao.addRange(range);
  }

  function escreverNoCampo(texto, { substituirTudo = false } = {}) {
    const campo = acharCampo();
    if (!campo) {
      avisar("Abra uma conversa antes de inserir a resposta.");
      return false;
    }

    campo.focus();
    selecionarConteudo(campo, substituirTudo);

    // execCommand dispara os mesmos eventos de uma digitação real, que é o
    // que faz o WhatsApp reconhecer o texto e habilitar o botão de enviar.
    const ok = document.execCommand("insertText", false, texto);
    if (!ok) {
      campo.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: texto,
          bubbles: true,
          cancelable: true,
        })
      );
    }
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function avisar(mensagem) {
    document.querySelector(".vertion-aviso")?.remove();
    const aviso = document.createElement("div");
    aviso.className = "vertion-aviso";
    aviso.textContent = mensagem;
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 2600);
  }

  /* ── abrir conversas ────────────────────────────────────────────── */

  /** Joga o nome na busca da esquerda — é como a pessoa acharia na mão. */
  function procurarConversa(nome) {
    const busca = acharBusca();
    if (!busca) {
      avisar("Não achei a busca do WhatsApp nesta tela.");
      return;
    }
    busca.focus();
    selecionarConteudo(busca, true);
    document.execCommand("insertText", false, nome);
    busca.dispatchEvent(new Event("input", { bubbles: true }));
    fecharPainel();
  }

  /** Abre conversa com um número que não está salvo na agenda. */
  function abrirPorNumero(numeroCru, texto) {
    const digitos = (numeroCru || "").replace(/\D/g, "");
    if (digitos.length < 8) {
      avisar("Número curto demais. Inclua o DDD.");
      return;
    }
    const ddi = config.ddiPadrao || "55";
    const completo = digitos.length <= 11 ? ddi + digitos : digitos;

    const url = new URL("https://web.whatsapp.com/send");
    url.searchParams.set("phone", completo);
    if (texto?.trim()) url.searchParams.set("text", texto.trim());
    window.location.href = url.toString();
  }

  /* ── ficha do cliente ───────────────────────────────────────────── */

  async function carregarFicha() {
    contatoAtual = nomeDoContato();
    fichaAtual = contatoAtual
      ? await D.lerCliente(contatoAtual)
      : { nota: "", status: "", lembrete: "" };
  }

  async function gravarFicha() {
    if (!contatoAtual) return;
    await D.salvarCliente(contatoAtual, fichaAtual);
    clientes = await D.carregarClientes();
    atualizarBadge();
  }

  function lembretesVencidos() {
    const hoje = new Date().toISOString().slice(0, 10);
    return Object.entries(clientes)
      .filter(([, ficha]) => ficha.lembrete && ficha.lembrete <= hoje)
      .sort((a, b) => a[1].lembrete.localeCompare(b[1].lembrete));
  }

  function atualizarBadge() {
    const botao = document.getElementById(ID_BOTAO);
    if (!botao) return;
    const total = lembretesVencidos().length;
    let badge = botao.querySelector(".vertion-badge");

    if (!total) {
      badge?.remove();
      botao.title = "Central da Vertion (Ctrl+Shift+Espaço)";
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "vertion-badge";
      botao.appendChild(badge);
    }
    badge.textContent = String(total);
    botao.title = `${total} retorno(s) atrasado(s) · Ctrl+Shift+Espaço`;
  }

  /* ── aba: respostas ─────────────────────────────────────────────── */

  function filtrar(termo) {
    const busca = termo.trim().toLowerCase();
    if (!busca) return respostas;
    return respostas.filter(
      (r) =>
        r.titulo.toLowerCase().includes(busca) ||
        r.atalho.toLowerCase().includes(busca) ||
        r.texto.toLowerCase().includes(busca)
    );
  }

  function desenharRespostas(painel, termo) {
    const area = painel.querySelector(".vertion-conteudo");
    const visiveis = filtrar(termo);
    indiceSelecionado = 0;
    area.innerHTML = "";

    if (!visiveis.length) {
      area.innerHTML = `<p class="vertion-vazio">Nenhuma resposta encontrada.</p>`;
      return;
    }

    visiveis.forEach((resposta, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "vertion-item" + (i === 0 ? " vertion-item--ativo" : "");
      item.innerHTML = `
        <span class="vertion-item-topo">
          <span class="vertion-item-titulo"></span>
          <span class="vertion-item-atalho"></span>
        </span>
        <span class="vertion-item-texto"></span>
      `;
      item.querySelector(".vertion-item-titulo").textContent = resposta.titulo;
      item.querySelector(".vertion-item-atalho").textContent = "/" + resposta.atalho;
      item.querySelector(".vertion-item-texto").textContent = aplicarVariaveis(resposta.texto);
      item.addEventListener("click", () => usar(resposta));
      area.appendChild(item);
    });
  }

  function destacar(painel, delta) {
    const itens = [...painel.querySelectorAll(".vertion-item")];
    if (!itens.length) return;
    itens[indiceSelecionado]?.classList.remove("vertion-item--ativo");
    indiceSelecionado = (indiceSelecionado + delta + itens.length) % itens.length;
    const alvo = itens[indiceSelecionado];
    alvo.classList.add("vertion-item--ativo");
    alvo.scrollIntoView({ block: "nearest" });
  }

  function inserir(resposta, valores) {
    let texto = resposta.texto;
    if (valores) {
      Object.entries(valores).forEach(([campo, valor]) => {
        texto = texto.replaceAll(`[[${campo}]]`, valor);
      });
    }
    if (escreverNoCampo(aplicarVariaveis(texto), { substituirTudo: modoAtalho })) {
      D.registrarUso(resposta.id);
      fecharPainel();
    }
  }

  function usar(resposta) {
    const campos = camposDe(resposta.texto);
    if (!campos.length) {
      inserir(resposta, null);
      return;
    }
    pedirCampos(resposta, campos);
  }

  /** Formulário rápido para respostas com [[campo]] dentro. */
  function pedirCampos(resposta, campos) {
    const painel = document.getElementById(ID_PAINEL);
    const area = painel.querySelector(".vertion-conteudo");
    painel.querySelector(".vertion-busca").hidden = true;

    area.innerHTML = `
      <p class="vertion-cliente-nome"></p>
      <form class="vertion-campos"></form>
    `;
    area.querySelector(".vertion-cliente-nome").textContent = resposta.titulo;

    const form = area.querySelector(".vertion-campos");
    campos.forEach((campo, i) => {
      const bloco = document.createElement("label");
      bloco.className = "vertion-campo";
      bloco.innerHTML = `<span></span><input type="text" required />`;
      bloco.querySelector("span").textContent = campo;
      if (i === 0) bloco.querySelector("input").autofocus = true;
      form.appendChild(bloco);
    });

    const acoes = document.createElement("div");
    acoes.className = "vertion-acoes";
    acoes.innerHTML = `
      <button type="submit" class="vertion-botao-acao vertion-botao-acao--principal">Inserir</button>
      <button type="button" class="vertion-botao-acao" data-voltar>Voltar</button>
    `;
    form.appendChild(acoes);

    form.querySelector("[data-voltar]").addEventListener("click", () => {
      painel.querySelector(".vertion-busca").hidden = false;
      desenharConteudo(painel);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const valores = {};
      [...form.querySelectorAll(".vertion-campo")].forEach((bloco, i) => {
        valores[campos[i]] = bloco.querySelector("input").value.trim();
      });
      inserir(resposta, valores);
    });

    form.querySelector("input")?.focus();
  }

  /* ── aba: cliente ───────────────────────────────────────────────── */

  function desenharCliente(painel) {
    const area = painel.querySelector(".vertion-conteudo");

    if (!contatoAtual) {
      area.innerHTML = `<p class="vertion-vazio">Abra uma conversa para ver a ficha do cliente.</p>`;
      return;
    }

    area.innerHTML = `
      <p class="vertion-cliente-nome"></p>
      <label class="vertion-rotulo">Etapa do funil</label>
      <div class="vertion-status"></div>
      <label class="vertion-rotulo" for="vertion-nota">Anotações (só você vê)</label>
      <textarea id="vertion-nota" class="vertion-nota" rows="5"
        placeholder="O que esse cliente precisa, o que já foi combinado..."></textarea>
      <label class="vertion-rotulo" for="vertion-lembrete">Voltar a falar em</label>
      <input type="date" id="vertion-lembrete" class="vertion-data" />
      <p class="vertion-salvo"></p>
    `;

    area.querySelector(".vertion-cliente-nome").textContent = contatoAtual;

    const grupo = area.querySelector(".vertion-status");
    D.STATUS.forEach((status) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className =
        "vertion-chip" + (fichaAtual.status === status.id ? " vertion-chip--ativo" : "");
      botao.textContent = status.rotulo;
      botao.style.setProperty("--cor", status.cor);
      botao.addEventListener("click", async () => {
        fichaAtual.status = fichaAtual.status === status.id ? "" : status.id;
        await gravarFicha();
        desenharCliente(painel);
      });
      grupo.appendChild(botao);
    });

    const nota = area.querySelector("#vertion-nota");
    const lembrete = area.querySelector("#vertion-lembrete");
    const salvo = area.querySelector(".vertion-salvo");

    nota.value = fichaAtual.nota ?? "";
    lembrete.value = fichaAtual.lembrete ?? "";

    let sumir;
    const marcarSalvo = () => {
      salvo.textContent = "Salvo";
      clearTimeout(sumir);
      sumir = setTimeout(() => (salvo.textContent = ""), 1600);
    };

    let espera;
    nota.addEventListener("input", () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        fichaAtual.nota = nota.value;
        await gravarFicha();
        marcarSalvo();
      }, 500);
    });

    lembrete.addEventListener("change", async () => {
      fichaAtual.lembrete = lembrete.value;
      await gravarFicha();
      marcarSalvo();
    });
  }

  /* ── aba: funil ─────────────────────────────────────────────────── */

  function cartaoDeCliente(nome, ficha, destaque) {
    const status = D.STATUS.find((s) => s.id === ficha.status);
    const cartao = document.createElement("button");
    cartao.type = "button";
    cartao.className = "vertion-item" + (destaque ? " vertion-item--alerta" : "");
    cartao.innerHTML = `
      <span class="vertion-item-topo">
        <span class="vertion-item-titulo"></span>
        <span class="vertion-item-atalho"></span>
      </span>
      <span class="vertion-item-texto"></span>
    `;
    cartao.querySelector(".vertion-item-titulo").textContent = nome;
    cartao.querySelector(".vertion-item-atalho").textContent = ficha.lembrete
      ? new Date(ficha.lembrete + "T12:00").toLocaleDateString("pt-BR")
      : status?.rotulo ?? "";
    cartao.querySelector(".vertion-item-texto").textContent =
      (ficha.nota || "").trim() || "sem anotação";
    cartao.addEventListener("click", () => procurarConversa(nome));
    return cartao;
  }

  function desenharFunil(painel) {
    const area = painel.querySelector(".vertion-conteudo");
    area.innerHTML = "";

    const atrasados = lembretesVencidos();
    const total = Object.keys(clientes).length;

    if (!total) {
      area.innerHTML = `<p class="vertion-vazio">Nenhuma ficha ainda. Marque a etapa de um cliente na aba Cliente.</p>`;
      return;
    }

    if (atrasados.length) {
      const titulo = document.createElement("p");
      titulo.className = "vertion-rotulo vertion-rotulo--alerta";
      titulo.textContent = `Retorno atrasado (${atrasados.length})`;
      area.appendChild(titulo);
      atrasados.forEach(([nome, ficha]) => area.appendChild(cartaoDeCliente(nome, ficha, true)));
    }

    D.STATUS.forEach((status) => {
      const doGrupo = Object.entries(clientes).filter(
        ([nome, ficha]) =>
          ficha.status === status.id && !atrasados.some(([outro]) => outro === nome)
      );
      if (!doGrupo.length) return;

      const titulo = document.createElement("p");
      titulo.className = "vertion-rotulo";
      titulo.textContent = `${status.rotulo} (${doGrupo.length})`;
      area.appendChild(titulo);
      doGrupo.forEach(([nome, ficha]) => area.appendChild(cartaoDeCliente(nome, ficha, false)));
    });
  }

  /* ── aba: novo contato ──────────────────────────────────────────── */

  function desenharNovo(painel) {
    const area = painel.querySelector(".vertion-conteudo");
    area.innerHTML = `
      <p class="vertion-explicacao">
        Abre conversa com um número que não está salvo na sua agenda.
      </p>
      <form class="vertion-campos">
        <label class="vertion-campo">
          <span>Telefone com DDD</span>
          <input type="tel" id="vertion-numero" placeholder="21 98765-4321" required />
        </label>
        <label class="vertion-campo">
          <span>Primeira mensagem (opcional)</span>
          <textarea id="vertion-primeira" rows="3" placeholder="Deixe em branco para abrir a conversa vazia."></textarea>
        </label>
        <div class="vertion-acoes">
          <button type="submit" class="vertion-botao-acao vertion-botao-acao--principal">Abrir conversa</button>
        </div>
      </form>
      <p class="vertion-explicacao">
        Números com até 11 dígitos recebem o DDI ${config.ddiPadrao || "55"} automaticamente.
        A mensagem entra no campo — você confere e envia.
      </p>
    `;

    const form = area.querySelector("form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      abrirPorNumero(
        area.querySelector("#vertion-numero").value,
        area.querySelector("#vertion-primeira").value
      );
    });
    area.querySelector("#vertion-numero").focus();
  }

  /* ── painel ─────────────────────────────────────────────────────── */

  function desenharConteudo(painel) {
    const busca = painel.querySelector(".vertion-busca");
    busca.hidden = aba !== "respostas";
    painel.querySelectorAll(".vertion-aba").forEach((botao) => {
      botao.classList.toggle("vertion-aba--ativa", botao.dataset.aba === aba);
    });

    if (aba === "respostas") desenharRespostas(painel, busca.value);
    else if (aba === "cliente") desenharCliente(painel);
    else if (aba === "funil") desenharFunil(painel);
    else desenharNovo(painel);
  }

  async function abrirPainel({ filtro = "", abaInicial = "respostas" } = {}) {
    if (document.getElementById(ID_PAINEL)) return;

    config = await D.lerConfig();
    clientes = await D.carregarClientes();
    await carregarFicha();

    const painel = document.createElement("div");
    painel.id = ID_PAINEL;
    painel.className = "vertion-painel";
    painel.innerHTML = `
      <div class="vertion-cabecalho">
        <span class="vertion-marca">Vertion</span>
        <button type="button" class="vertion-fechar" aria-label="Fechar">&times;</button>
      </div>
      <div class="vertion-abas" role="tablist">
        <button type="button" class="vertion-aba" data-aba="respostas">Respostas</button>
        <button type="button" class="vertion-aba" data-aba="cliente">Cliente</button>
        <button type="button" class="vertion-aba" data-aba="funil">Funil</button>
        <button type="button" class="vertion-aba" data-aba="novo">Novo</button>
      </div>
      <input type="text" class="vertion-busca" placeholder="Buscar resposta..." aria-label="Buscar resposta" />
      <div class="vertion-conteudo"></div>
      <p class="vertion-rodape">Enter insere no campo · você confere e envia</p>
    `;
    document.body.appendChild(painel);

    const busca = painel.querySelector(".vertion-busca");
    busca.value = filtro;
    aba = abaInicial;
    desenharConteudo(painel);

    painel.querySelectorAll(".vertion-aba").forEach((botao) => {
      botao.addEventListener("click", () => {
        aba = botao.dataset.aba;
        desenharConteudo(painel);
      });
    });

    busca.addEventListener("input", () => desenharRespostas(painel, busca.value));
    busca.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        destacar(painel, 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        destacar(painel, -1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const visiveis = filtrar(busca.value);
        if (visiveis[indiceSelecionado]) usar(visiveis[indiceSelecionado]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        fecharPainel();
      }
    });

    painel.querySelector(".vertion-fechar").addEventListener("click", fecharPainel);
    if (aba === "respostas") busca.focus();
    document.addEventListener("mousedown", fecharSeForaDoPainel, true);
  }

  function fecharSeForaDoPainel(evento) {
    const painel = document.getElementById(ID_PAINEL);
    if (!painel) return;
    if (painel.contains(evento.target)) return;
    if (document.getElementById(ID_BOTAO)?.contains(evento.target)) return;
    fecharPainel();
  }

  function fecharPainel() {
    document.getElementById(ID_PAINEL)?.remove();
    document.removeEventListener("mousedown", fecharSeForaDoPainel, true);
    modoAtalho = false;
  }

  function alternarPainel(abaInicial) {
    if (document.getElementById(ID_PAINEL)) fecharPainel();
    else abrirPainel({ abaInicial });
  }

  /* ── atalho digitado no campo ───────────────────────────────────── */

  function vigiarCampo(evento) {
    const campo = acharCampo();
    if (!campo || evento.target !== campo) return;

    const texto = campo.textContent ?? "";
    const combinacao = texto.match(/^\/([\p{L}0-9]*)$/u);

    if (!combinacao) {
      if (modoAtalho) fecharPainel();
      return;
    }

    modoAtalho = true;
    const painel = document.getElementById(ID_PAINEL);
    if (painel) {
      const busca = painel.querySelector(".vertion-busca");
      busca.value = combinacao[1];
      desenharRespostas(painel, combinacao[1]);
    } else {
      abrirPainel({ filtro: combinacao[1] });
    }
  }

  /* ── botão flutuante ────────────────────────────────────────────── */

  function garantirBotao() {
    if (document.getElementById(ID_BOTAO)) return;

    const botao = document.createElement("button");
    botao.id = ID_BOTAO;
    botao.type = "button";
    botao.className = "vertion-botao";
    botao.setAttribute("aria-label", "Abrir central de atendimento da Vertion");
    botao.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    `;
    // Com retorno atrasado, o clique já cai no funil, que é onde eles estão.
    botao.addEventListener("click", () =>
      alternarPainel(lembretesVencidos().length ? "funil" : "respostas")
    );
    document.body.appendChild(botao);
    atualizarBadge();
  }

  /* ── início ─────────────────────────────────────────────────────── */

  async function iniciar() {
    [respostas, clientes, config] = await Promise.all([
      D.carregar(),
      D.carregarClientes(),
      D.lerConfig(),
    ]);

    D.aoMudar((nova) => {
      respostas = nova;
      const painel = document.getElementById(ID_PAINEL);
      if (painel && aba === "respostas") {
        desenharRespostas(painel, painel.querySelector(".vertion-busca").value);
      }
    });

    garantirBotao();

    // O WhatsApp reconstrói a tela ao trocar de conversa e leva o botão junto.
    let ultimoContato = "";
    const observador = new MutationObserver(() => {
      garantirBotao();
      const nome = nomeDoContato();
      if (nome === ultimoContato) return;
      ultimoContato = nome;
      const painel = document.getElementById(ID_PAINEL);
      if (painel) carregarFicha().then(() => desenharConteudo(painel));
    });
    observador.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("input", vigiarCampo, true);

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        alternarPainel();
      }
    });
  }

  iniciar();
})();
