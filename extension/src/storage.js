/**
 * Camada de dados da extensão.
 *
 * Tudo vive no chrome.storage.sync, que acompanha a conta Google de cada
 * pessoa — some do PC e aparece no notebook sozinho. Para a equipe inteira
 * enxergar a mesma coisa, basta trocar o corpo destas funções por chamadas ao
 * painel na nuvem; nada fora deste arquivo precisa mudar.
 */

const CHAVE_RESPOSTAS = "vertion_respostas";
const CHAVE_CLIENTES = "vertion_clientes";
const CHAVE_USO = "vertion_uso";

/** Etapas do funil. A ordem é a do processo comercial da Vertion. */
const STATUS = [
  { id: "novo", rotulo: "Novo contato", cor: "#7A16E0" },
  { id: "diagnostico", rotulo: "Diagnóstico feito", cor: "#8C3BE8" },
  { id: "proposta", rotulo: "Proposta enviada", cor: "#B08D57" },
  { id: "fechado", rotulo: "Fechado", cor: "#2E7D3E" },
  { id: "producao", rotulo: "Em produção", cor: "#1E88E5" },
  { id: "sem-retorno", rotulo: "Sem retorno", cor: "#7C7593" },
];

/**
 * Respostas que já vêm prontas na primeira instalação.
 * {nome} e {primeiro_nome} são trocados pelo nome de quem está na conversa.
 */
const PADRAO = [
  {
    id: "abertura",
    atalho: "oi",
    titulo: "Abertura",
    texto:
      "Oi, {primeiro_nome}! Aqui é da Vertion Stack. Me conta um pouco do seu negócio e o que está te tomando mais tempo hoje que eu te digo se dá pra resolver com tecnologia.",
  },
  {
    id: "preco",
    atalho: "preco",
    titulo: "Quanto custa",
    texto:
      "Depende do que você precisa, {primeiro_nome}: uma landing page é bem diferente de um sistema completo. Me conta rapidinho o que está travando aí no seu dia que eu já te passo uma faixa de valor, sem compromisso.",
  },
  {
    id: "prazo",
    atalho: "prazo",
    titulo: "Quanto tempo demora",
    texto:
      "Site e landing page saem em 3 a 7 dias úteis. Dashboard e automação variam conforme a complexidade, e o prazo exato vai por escrito na proposta, depois que eu entender sua necessidade.",
  },
  {
    id: "fidelidade",
    atalho: "fidelidade",
    titulo: "Tem fidelidade",
    texto:
      "Não tem fidelidade. Você contrata o projeto que precisa e pronto, sem mensalidade obrigatória.",
  },
  {
    id: "como-funciona",
    atalho: "comofunciona",
    titulo: "Como funciona",
    texto:
      "São quatro passos: (1) uma conversa de 15 min pra eu entender seu processo, (2) proposta por escrito em até 48h com prazo e valor, (3) construção, e (4) entrega com suporte pra ajustes.",
  },
  {
    id: "horario",
    atalho: "horario",
    titulo: "Horário de atendimento",
    texto: "A gente atende das 8h às 23h. Fora disso eu respondo logo cedo, a partir das 8h.",
  },
  {
    id: "fechamento",
    atalho: "fechar",
    titulo: "Fechamento",
    texto:
      "Fechado, {primeiro_nome}! Vou montar a proposta com prazo e valor e te mando por aqui em até 48h. Qualquer dúvida no meio do caminho, é só chamar.",
  },
];

/* ── respostas ──────────────────────────────────────────────────────── */

async function carregar() {
  const dados = await chrome.storage.sync.get(CHAVE_RESPOSTAS);
  const lista = dados[CHAVE_RESPOSTAS];
  if (Array.isArray(lista) && lista.length) return lista;

  await chrome.storage.sync.set({ [CHAVE_RESPOSTAS]: PADRAO });
  return PADRAO;
}

async function salvar(lista) {
  await chrome.storage.sync.set({ [CHAVE_RESPOSTAS]: lista });
}

/* ── ficha do cliente (notas, status e lembrete) ────────────────────── */

async function carregarClientes() {
  const dados = await chrome.storage.sync.get(CHAVE_CLIENTES);
  return dados[CHAVE_CLIENTES] ?? {};
}

async function lerCliente(chave) {
  const clientes = await carregarClientes();
  return clientes[chave] ?? { nota: "", status: "", lembrete: "" };
}

async function salvarCliente(chave, ficha) {
  const clientes = await carregarClientes();

  const vazia = !ficha.nota?.trim() && !ficha.status && !ficha.lembrete;
  if (vazia) delete clientes[chave];
  else clientes[chave] = { ...ficha, atualizadoEm: new Date().toISOString() };

  await chrome.storage.sync.set({ [CHAVE_CLIENTES]: clientes });
}

/* ── contador de uso ────────────────────────────────────────────────── */

/** Conta quantas vezes cada resposta foi usada, pra saber o que vale manter. */
async function registrarUso(id) {
  const dados = await chrome.storage.sync.get(CHAVE_USO);
  const uso = dados[CHAVE_USO] ?? {};
  uso[id] = (uso[id] ?? 0) + 1;
  await chrome.storage.sync.set({ [CHAVE_USO]: uso });
}

async function carregarUso() {
  const dados = await chrome.storage.sync.get(CHAVE_USO);
  return dados[CHAVE_USO] ?? {};
}

/* ── avisos de mudança ──────────────────────────────────────────────── */

function aoMudar(callback) {
  chrome.storage.onChanged.addListener((mudancas, area) => {
    if (area !== "sync") return;
    if (mudancas[CHAVE_RESPOSTAS]) callback(mudancas[CHAVE_RESPOSTAS].newValue ?? []);
  });
}

globalThis.VertionDados = {
  STATUS,
  PADRAO,
  carregar,
  salvar,
  lerCliente,
  salvarCliente,
  carregarClientes,
  registrarUso,
  carregarUso,
  aoMudar,
};
