/**
 * Injeta a central de atendimento da Vertion dentro do WhatsApp Web.
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
  let aba = "respostas";
  let indiceSelecionado = 0;
  let contatoAtual = "";
  let fichaAtual = { nota: "", status: "", lembrete: "" };
  let clientes = {};
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

  /** Nome de quem está na conversa aberta. Serve de chave da ficha e de {nome}. */
  function nomeDoContato() {
    const cabecalho = document.querySelector("#main header");
    if (!cabecalho) return "";
    const comTitulo = cabecalho.querySelector("span[title]");
    if (comTitulo?.getAttribute("title")) return comTitulo.getAttribute("title").trim();
    return cabecalho.querySelector("span")?.textContent?.trim() ?? "";
  }

  function primeiroNome(nome) {
    return (nome || "").trim().split(/\s+/)[0] ?? "";
  }

  /** Troca {nome} e {primeiro_nome} pelo contato da conversa aberta. */
  function aplicarVariaveis(texto) {
    const nome = contatoAtual;
    return texto
      .replaceAll("{primeiro_nome}", primeiroNome(nome))
      .replaceAll("{nome}", nome)
      .replace(/^(Oi|Olá|Fechado),\s*!/i, "$1!") // sem nome, não deixa vírgula solta
      .replace(/\s+,/g, ",");
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
    return Object.entries(clientes).filter(
      ([, ficha]) => ficha.lembrete && ficha.lembrete <= hoje
    );
  }

  function atualizarBadge() {
    const botao = document.getElementById(ID_BOTAO);
    if (!botao) return;
    const total = lembretesVencidos().length;
    let badge = botao.querySelector(".vertion-badge");

    if (!total) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "vertion-badge";
      botao.appendChild(badge);
    }
    badge.textContent = String(total);
    botao.title = `${total} lembrete(s) vencido(s) · Ctrl+Shift+Espaço`;
  }

  /* ── lista de respostas ─────────────────────────────────────────── */

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

  function usar(resposta) {
    const texto = aplicarVariaveis(resposta.texto);
    if (escreverNoCampo(texto, { substituirTudo: modoAtalho })) {
      D.registrarUso(resposta.id);
      fecharPainel();
    }
  }

  /* ── aba do cliente ─────────────────────────────────────────────── */

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

    let timer;
    const marcarSalvo = () => {
      salvo.textContent = "Salvo";
      clearTimeout(timer);
      timer = setTimeout(() => (salvo.textContent = ""), 1600);
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

  /* ── painel ─────────────────────────────────────────────────────── */

  function desenharConteudo(painel) {
    const busca = painel.querySelector(".vertion-busca");
    busca.hidden = aba !== "respostas";
    painel.querySelectorAll(".vertion-aba").forEach((botao) => {
      botao.classList.toggle("vertion-aba--ativa", botao.dataset.aba === aba);
    });

    if (aba === "respostas") desenharRespostas(painel, busca.value);
    else desenharCliente(painel);
  }

  async function abrirPainel({ filtro = "" } = {}) {
    if (document.getElementById(ID_PAINEL)) return;

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
        <button type="button" class="vertion-aba vertion-aba--ativa" data-aba="respostas">Respostas</button>
        <button type="button" class="vertion-aba" data-aba="cliente">Cliente</button>
      </div>
      <input type="text" class="vertion-busca" placeholder="Buscar resposta..." aria-label="Buscar resposta" />
      <div class="vertion-conteudo"></div>
      <p class="vertion-rodape">Enter insere no campo · você confere e envia</p>
    `;
    document.body.appendChild(painel);

    const busca = painel.querySelector(".vertion-busca");
    busca.value = filtro;
    aba = "respostas";
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
    busca.focus();
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
    acharCampo()?.focus();
  }

  function alternarPainel() {
    if (document.getElementById(ID_PAINEL)) fecharPainel();
    else abrirPainel();
  }

  /* ── atalho digitado no campo ───────────────────────────────────── */

  /**
   * Digitar "/preco" no campo abre o painel já filtrado. Ao escolher, o
   * "/preco" some e a resposta entra no lugar.
   */
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
    botao.title = "Central da Vertion (Ctrl+Shift+Espaço)";
    botao.setAttribute("aria-label", "Abrir central de atendimento da Vertion");
    botao.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    `;
    botao.addEventListener("click", alternarPainel);
    document.body.appendChild(botao);
    atualizarBadge();
  }

  /* ── início ─────────────────────────────────────────────────────── */

  async function iniciar() {
    respostas = await D.carregar();
    clientes = await D.carregarClientes();

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
