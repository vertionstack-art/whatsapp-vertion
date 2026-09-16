/**
 * Injeta a biblioteca de respostas dentro do WhatsApp Web.
 *
 * Regra que guia todo este arquivo: a extensão NUNCA envia mensagem sozinha.
 * Ela só escreve o texto no campo — quem aperta enviar é a pessoa. É isso que
 * mantém o número longe de um banimento por automação.
 */

(() => {
  const ID_BOTAO = "vertion-botao";
  const ID_PAINEL = "vertion-painel";

  let respostas = [];
  let indiceSelecionado = 0;

  /* ── conversa com o WhatsApp ────────────────────────────────────── */

  /**
   * Acha o campo de digitação da conversa aberta.
   * O WhatsApp troca de classe a cada atualização, então procuramos pela
   * característica que não muda: um contenteditable dentro do rodapé.
   */
  function acharCampo() {
    return (
      document.querySelector('footer div[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('#main div[contenteditable="true"]')
    );
  }

  /**
   * Escreve o texto no campo sem enviar.
   * Usamos execCommand porque ele dispara os mesmos eventos de uma digitação
   * real — é o que faz o WhatsApp reconhecer o texto e habilitar o botão.
   */
  function escreverNoCampo(texto) {
    const campo = acharCampo();
    if (!campo) {
      avisar("Abra uma conversa antes de inserir a resposta.");
      return false;
    }

    campo.focus();

    const selecao = window.getSelection();
    selecao.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(campo);
    range.collapse(false);
    selecao.addRange(range);

    const ok = document.execCommand("insertText", false, texto);
    if (!ok) {
      // Caminho reserva, caso o navegador deixe de suportar execCommand.
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
    const aviso = document.createElement("div");
    aviso.className = "vertion-aviso";
    aviso.textContent = mensagem;
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 2600);
  }

  /* ── painel ─────────────────────────────────────────────────────── */

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

  function desenharLista(painel, termo) {
    const lista = painel.querySelector(".vertion-lista");
    const visiveis = filtrar(termo);
    indiceSelecionado = 0;
    lista.innerHTML = "";

    if (!visiveis.length) {
      const vazio = document.createElement("p");
      vazio.className = "vertion-vazio";
      vazio.textContent = "Nenhuma resposta encontrada.";
      lista.appendChild(vazio);
      return;
    }

    visiveis.forEach((resposta, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "vertion-item" + (i === 0 ? " vertion-item--ativo" : "");
      item.dataset.indice = String(i);
      item.innerHTML = `
        <span class="vertion-item-topo">
          <span class="vertion-item-titulo"></span>
          <span class="vertion-item-atalho"></span>
        </span>
        <span class="vertion-item-texto"></span>
      `;
      item.querySelector(".vertion-item-titulo").textContent = resposta.titulo;
      item.querySelector(".vertion-item-atalho").textContent = "/" + resposta.atalho;
      item.querySelector(".vertion-item-texto").textContent = resposta.texto;
      item.addEventListener("click", () => usar(resposta));
      lista.appendChild(item);
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
    if (escreverNoCampo(resposta.texto)) fecharPainel();
  }

  function abrirPainel() {
    if (document.getElementById(ID_PAINEL)) return;

    const painel = document.createElement("div");
    painel.id = ID_PAINEL;
    painel.className = "vertion-painel";
    painel.innerHTML = `
      <div class="vertion-cabecalho">
        <span class="vertion-marca">Vertion · respostas</span>
        <button type="button" class="vertion-fechar" aria-label="Fechar">&times;</button>
      </div>
      <input type="text" class="vertion-busca" placeholder="Buscar resposta..." aria-label="Buscar resposta" />
      <div class="vertion-lista"></div>
      <p class="vertion-rodape">Enter insere no campo · você confere e envia</p>
    `;
    document.body.appendChild(painel);

    const busca = painel.querySelector(".vertion-busca");
    desenharLista(painel, "");

    busca.addEventListener("input", () => desenharLista(painel, busca.value));
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
    const botao = document.getElementById(ID_BOTAO);
    if (!painel) return;
    if (painel.contains(evento.target) || botao?.contains(evento.target)) return;
    fecharPainel();
  }

  function fecharPainel() {
    document.getElementById(ID_PAINEL)?.remove();
    document.removeEventListener("mousedown", fecharSeForaDoPainel, true);
    acharCampo()?.focus();
  }

  function alternarPainel() {
    if (document.getElementById(ID_PAINEL)) fecharPainel();
    else abrirPainel();
  }

  /* ── botão flutuante ────────────────────────────────────────────── */

  function garantirBotao() {
    if (document.getElementById(ID_BOTAO)) return;

    const botao = document.createElement("button");
    botao.id = ID_BOTAO;
    botao.type = "button";
    botao.className = "vertion-botao";
    botao.title = "Respostas da Vertion (Ctrl+Shift+Espaço)";
    botao.setAttribute("aria-label", "Abrir respostas prontas");
    botao.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    `;
    botao.addEventListener("click", alternarPainel);
    document.body.appendChild(botao);
  }

  /* ── início ─────────────────────────────────────────────────────── */

  async function iniciar() {
    respostas = await globalThis.VertionRespostas.carregar();
    globalThis.VertionRespostas.aoMudar((nova) => {
      respostas = nova;
      const painel = document.getElementById(ID_PAINEL);
      if (painel) desenharLista(painel, painel.querySelector(".vertion-busca").value);
    });

    garantirBotao();

    // O WhatsApp reconstrói a tela ao trocar de conversa e leva o botão junto.
    const observador = new MutationObserver(() => garantirBotao());
    observador.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        alternarPainel();
      }
    });
  }

  iniciar();
})();
