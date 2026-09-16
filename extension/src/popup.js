/** Tela de gerenciamento das respostas (o que abre ao clicar no ícone da extensão). */

const { carregar, salvar, carregarUso } = globalThis.VertionDados;

const lista = document.getElementById("lista");
const formulario = document.getElementById("formulario");
const campoId = document.getElementById("campo-id");
const campoTitulo = document.getElementById("campo-titulo");
const campoAtalho = document.getElementById("campo-atalho");
const campoTexto = document.getElementById("campo-texto");

let respostas = [];
let uso = {};

/** Vira um atalho seguro: minúsculo, sem espaço e sem acento. */
function normalizarAtalho(valor) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function desenhar() {
  lista.innerHTML = "";

  if (!respostas.length) {
    const vazio = document.createElement("li");
    vazio.className = "vazio";
    vazio.textContent = "Nenhuma resposta cadastrada ainda.";
    lista.appendChild(vazio);
    return;
  }

  respostas.forEach((resposta) => {
    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div class="item-topo">
        <strong class="item-titulo"></strong>
        <code class="item-atalho"></code>
      </div>
      <p class="item-texto"></p>
      <p class="item-uso"></p>
      <div class="item-acoes">
        <button type="button" class="botao botao--pequeno" data-acao="editar">Editar</button>
        <button type="button" class="botao botao--pequeno botao--perigo" data-acao="excluir">Excluir</button>
      </div>
    `;
    item.querySelector(".item-titulo").textContent = resposta.titulo;
    item.querySelector(".item-atalho").textContent = "/" + resposta.atalho;
    item.querySelector(".item-texto").textContent = resposta.texto;

    // Saber o que é usado ajuda a podar o que não serve.
    const vezes = uso[resposta.id] ?? 0;
    item.querySelector(".item-uso").textContent =
      vezes === 0 ? "ainda não usada" : `usada ${vezes}x`;

    item.querySelector('[data-acao="editar"]').addEventListener("click", () => editar(resposta));
    item.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluir(resposta));
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

function editar(resposta) {
  abrirFormulario(resposta);
}

async function excluir(resposta) {
  // Ação destrutiva: confirma antes, porque não dá pra desfazer.
  if (!confirm(`Excluir a resposta "${resposta.titulo}"?`)) return;
  respostas = respostas.filter((r) => r.id !== resposta.id);
  await salvar(respostas);
  desenhar();
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const atalho = normalizarAtalho(campoAtalho.value);
  if (!atalho) {
    alert("O atalho precisa ter pelo menos uma letra ou número.");
    return;
  }

  const id = campoId.value;
  const duplicado = respostas.find((r) => r.atalho === atalho && r.id !== id);
  if (duplicado) {
    alert(`O atalho /${atalho} já é usado por "${duplicado.titulo}".`);
    return;
  }

  const dados = {
    id: id || `r${Date.now()}`,
    titulo: campoTitulo.value.trim(),
    atalho,
    texto: campoTexto.value.trim(),
  };

  respostas = id
    ? respostas.map((r) => (r.id === id ? dados : r))
    : [...respostas, dados];

  await salvar(respostas);
  fecharFormulario();
  desenhar();
});

document.getElementById("nova").addEventListener("click", () => abrirFormulario(null));
document.getElementById("cancelar").addEventListener("click", fecharFormulario);

/* ── levar as respostas para os sócios ──────────────────────────────── */

document.getElementById("exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(respostas, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "respostas-vertion.json";
  link.click();
  URL.revokeObjectURL(url);
});

const arquivo = document.getElementById("arquivo");
document.getElementById("importar").addEventListener("click", () => arquivo.click());

arquivo.addEventListener("change", async () => {
  const selecionado = arquivo.files?.[0];
  if (!selecionado) return;

  try {
    const conteudo = JSON.parse(await selecionado.text());
    if (!Array.isArray(conteudo)) throw new Error("formato inesperado");

    const validas = conteudo.filter((r) => r?.titulo && r?.atalho && r?.texto);
    if (!validas.length) throw new Error("nenhuma resposta válida");

    if (!confirm(`Importar ${validas.length} resposta(s)? Isso substitui a lista atual.`)) return;

    respostas = validas.map((r, i) => ({
      id: r.id || `r${Date.now()}${i}`,
      titulo: String(r.titulo),
      atalho: normalizarAtalho(String(r.atalho)),
      texto: String(r.texto),
    }));
    await salvar(respostas);
    desenhar();
  } catch {
    alert("Não consegui ler esse arquivo. Use um exportado por esta extensão.");
  } finally {
    arquivo.value = "";
  }
});

Promise.all([carregar(), carregarUso()]).then(([iniciais, contagem]) => {
  respostas = iniciais;
  uso = contagem;
  desenhar();
});
