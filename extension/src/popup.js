/** Tela que abre ao clicar no ícone da extensão. */

const D = globalThis.VertionDados;

const lista = document.getElementById("lista");
const formulario = document.getElementById("formulario");
const campoId = document.getElementById("campo-id");
const campoTitulo = document.getElementById("campo-titulo");
const campoAtalho = document.getElementById("campo-atalho");
const campoTexto = document.getElementById("campo-texto");
const campoUrl = document.getElementById("campo-url");
const statusSincronia = document.getElementById("sincronia-status");

let todas = [];
let pessoais = [];
let uso = {};

/** Vira um atalho seguro: minúsculo, sem espaço e sem acento. */
function normalizarAtalho(valor) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function quandoFoi(iso) {
  if (!iso) return "nunca sincronizada";
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "atualizada agora";
  if (minutos < 60) return `atualizada há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `atualizada há ${horas}h`;
  return `atualizada há ${Math.round(horas / 24)} dia(s)`;
}

function desenhar() {
  lista.innerHTML = "";

  if (!todas.length) {
    lista.innerHTML = `<li class="vazio">Nenhuma resposta ainda.</li>`;
    return;
  }

  todas.forEach((resposta) => {
    const daEquipe = resposta.origem === "equipe";
    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div class="item-topo">
        <strong class="item-titulo"></strong>
        <code class="item-atalho"></code>
      </div>
      <p class="item-texto"></p>
      <div class="item-rodape">
        <span class="etiqueta"></span>
        <span class="item-uso"></span>
      </div>
      <div class="item-acoes"></div>
    `;
    item.querySelector(".item-titulo").textContent = resposta.titulo;
    item.querySelector(".item-atalho").textContent = "/" + resposta.atalho;
    item.querySelector(".item-texto").textContent = resposta.texto;

    const etiqueta = item.querySelector(".etiqueta");
    etiqueta.textContent = daEquipe ? "equipe" : "minha";
    etiqueta.classList.add(daEquipe ? "etiqueta--equipe" : "etiqueta--minha");

    const vezes = uso[resposta.id] ?? 0;
    item.querySelector(".item-uso").textContent =
      vezes === 0 ? "ainda não usada" : `usada ${vezes}x`;

    const acoes = item.querySelector(".item-acoes");
    if (daEquipe) {
      // Editar uma da equipe cria uma cópia pessoal que passa na frente —
      // é o caminho certo pra quem quer ajustar o texto só pra si.
      const copiar = document.createElement("button");
      copiar.type = "button";
      copiar.className = "botao botao--pequeno";
      copiar.textContent = "Criar minha versão";
      copiar.addEventListener("click", () => abrirFormulario({ ...resposta, id: "" }));
      acoes.appendChild(copiar);
    } else {
      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "botao botao--pequeno";
      editar.textContent = "Editar";
      editar.addEventListener("click", () => abrirFormulario(resposta));

      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "botao botao--pequeno botao--perigo";
      excluir.textContent = "Excluir";
      excluir.addEventListener("click", () => remover(resposta));

      acoes.append(editar, excluir);
    }

    lista.appendChild(item);
  });
}

function abrirFormulario(resposta) {
  campoId.value = resposta?.id ?? "";
  campoTitulo.value = resposta?.titulo ?? "";
  campoAtalho.value = resposta?.atalho ?? "";
  campoTexto.value = resposta?.texto ?? "";
  formulario.hidden = false;
  campoTitulo.focus();
}

function fecharFormulario() {
  formulario.reset();
  campoId.value = "";
  formulario.hidden = true;
}

async function remover(resposta) {
  // Ação destrutiva: confirma antes, porque não dá pra desfazer.
  if (!confirm(`Excluir a resposta "${resposta.titulo}"?`)) return;
  pessoais = pessoais.filter((r) => r.id !== resposta.id);
  await D.salvar(pessoais);
  await recarregar();
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const atalho = normalizarAtalho(campoAtalho.value);
  if (!atalho) {
    alert("O atalho precisa ter pelo menos uma letra ou número.");
    return;
  }

  const id = campoId.value;
  const duplicada = pessoais.find((r) => r.atalho === atalho && r.id !== id);
  if (duplicada) {
    alert(`O atalho /${atalho} já é usado por "${duplicada.titulo}".`);
    return;
  }

  const dados = {
    id: id || `p${Date.now()}`,
    titulo: campoTitulo.value.trim(),
    atalho,
    texto: campoTexto.value.trim(),
  };

  pessoais = id ? pessoais.map((r) => (r.id === id ? dados : r)) : [...pessoais, dados];

  await D.salvar(pessoais);
  fecharFormulario();
  await recarregar();
});

document.getElementById("nova").addEventListener("click", () => abrirFormulario(null));
document.getElementById("cancelar").addEventListener("click", fecharFormulario);

/* ── biblioteca da equipe ───────────────────────────────────────────── */

document.getElementById("sincronizar").addEventListener("click", async () => {
  statusSincronia.textContent = "buscando...";
  const resultado = await D.sincronizar({ forcar: true });
  if (resultado.ok) await recarregar();
  else statusSincronia.textContent = "não consegui acessar a biblioteca";
});

document.getElementById("salvar-url").addEventListener("click", async () => {
  const url = campoUrl.value.trim();
  if (url && !url.startsWith("https://")) {
    alert("O endereço precisa começar com https://");
    return;
  }
  await D.salvarConfig({ urlBiblioteca: url || D.URL_PADRAO });
  const resultado = await D.sincronizar({ forcar: true });
  if (resultado.ok) await recarregar();
  else statusSincronia.textContent = "esse endereço não respondeu";
});

document.getElementById("exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(pessoais, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "minhas-respostas-vertion.json";
  link.click();
  URL.revokeObjectURL(url);
});

/* ── carga ──────────────────────────────────────────────────────────── */

async function recarregar() {
  const [merged, minhas, contagem, config] = await Promise.all([
    D.carregar(),
    D.lerPessoais(),
    D.carregarUso(),
    D.lerConfig(),
  ]);

  todas = merged;
  pessoais = minhas;
  uso = contagem;

  campoUrl.value = config.urlBiblioteca;
  const daEquipe = merged.filter((r) => r.origem === "equipe").length;
  statusSincronia.textContent = `${daEquipe} da equipe · ${quandoFoi(config.sincronizadoEm)}`;

  desenhar();
}

recarregar();
