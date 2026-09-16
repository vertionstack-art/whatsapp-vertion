/**
 * Camada de dados da extensão.
 *
 * São duas origens de resposta:
 *
 *  1. BIBLIOTECA DA EQUIPE — vem da nuvem (o painel publicado na Vercel).
 *     Quando alguém edita e publica, todo mundo recebe sozinho, sem
 *     reinstalar e sem recarregar. Fica em cache local para funcionar
 *     mesmo sem internet.
 *
 *  2. RESPOSTAS PESSOAIS — criadas no popup por cada um. Ficam no
 *     chrome.storage.sync, então acompanham a conta Google da pessoa.
 *
 * Na hora de usar, as duas listas são juntadas. Se um atalho existir nas
 * duas, a pessoal ganha — quem ajustou o texto para si tem a última palavra.
 */

const CHAVE_PESSOAIS = "vertion_respostas";
const CHAVE_CLIENTES = "vertion_clientes";
const CHAVE_USO = "vertion_uso";
const CHAVE_CONFIG = "vertion_config";
const CHAVE_CACHE = "vertion_biblioteca";

/** Endereço padrão da biblioteca. Dá para trocar no popup. */
const URL_PADRAO = "https://whatsapp-vertion.vercel.app/api/respostas";

/** De quanto em quanto tempo buscar a biblioteca de novo. */
const INTERVALO_MS = 30 * 60 * 1000;

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
 * Rede de segurança: se a nuvem não responder, vale a biblioteca que veio
 * junto com a extensão (gerada a partir de src/lib/respostas.json).
 */
const PADRAO = globalThis.VertionBiblioteca ?? [];

/* ── configuração ───────────────────────────────────────────────────── */

async function lerConfig() {
  const dados = await chrome.storage.sync.get(CHAVE_CONFIG);
  return { urlBiblioteca: URL_PADRAO, sincronizadoEm: "", ...(dados[CHAVE_CONFIG] ?? {}) };
}

async function salvarConfig(parcial) {
  const atual = await lerConfig();
  await chrome.storage.sync.set({ [CHAVE_CONFIG]: { ...atual, ...parcial } });
}

/* ── biblioteca da equipe ───────────────────────────────────────────── */

function valida(item) {
  return item && typeof item.titulo === "string" && typeof item.atalho === "string" && typeof item.texto === "string";
}

async function lerCache() {
  const dados = await chrome.storage.local.get(CHAVE_CACHE);
  const cache = dados[CHAVE_CACHE];
  return Array.isArray(cache?.respostas) ? cache : { respostas: [], buscadoEm: 0 };
}

/**
 * Busca a biblioteca na nuvem e guarda em cache.
 * Falha em silêncio de propósito: sem internet, a extensão continua
 * funcionando com o que já estava salvo.
 */
async function sincronizar({ forcar = false } = {}) {
  const cache = await lerCache();
  const vencido = Date.now() - (cache.buscadoEm ?? 0) > INTERVALO_MS;
  if (!forcar && !vencido && cache.respostas.length) return { ok: true, doCache: true };

  const { urlBiblioteca } = await lerConfig();
  try {
    const resposta = await fetch(urlBiblioteca, { cache: "no-store" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const corpo = await resposta.json();
    const lista = (Array.isArray(corpo) ? corpo : corpo?.respostas ?? []).filter(valida);
    if (!lista.length) throw new Error("biblioteca vazia");

    await chrome.storage.local.set({
      [CHAVE_CACHE]: { respostas: lista, buscadoEm: Date.now() },
    });
    await salvarConfig({ sincronizadoEm: new Date().toISOString() });
    return { ok: true, total: lista.length };
  } catch (erro) {
    return { ok: false, erro: String(erro.message ?? erro) };
  }
}

/* ── respostas pessoais ─────────────────────────────────────────────── */

async function lerPessoais() {
  const dados = await chrome.storage.sync.get(CHAVE_PESSOAIS);
  return Array.isArray(dados[CHAVE_PESSOAIS]) ? dados[CHAVE_PESSOAIS] : [];
}

async function salvar(lista) {
  await chrome.storage.sync.set({ [CHAVE_PESSOAIS]: lista });
}

/* ── lista final ────────────────────────────────────────────────────── */

/** Junta biblioteca + pessoais. Em caso de atalho repetido, a pessoal vence. */
async function carregar() {
  sincronizar(); // roda em segundo plano; não segura a tela

  const [cache, pessoais] = await Promise.all([lerCache(), lerPessoais()]);
  const equipe = cache.respostas.length ? cache.respostas : PADRAO;

  const porAtalho = new Map();
  equipe.forEach((r) => porAtalho.set(r.atalho, { ...r, origem: "equipe" }));
  pessoais.forEach((r) => porAtalho.set(r.atalho, { ...r, origem: "pessoal" }));

  return [...porAtalho.values()];
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
  chrome.storage.onChanged.addListener(async (mudancas, area) => {
    const mexeuNaLista =
      (area === "sync" && mudancas[CHAVE_PESSOAIS]) ||
      (area === "local" && mudancas[CHAVE_CACHE]);
    if (mexeuNaLista) callback(await carregar());
  });
}

globalThis.VertionDados = {
  STATUS,
  PADRAO,
  URL_PADRAO,
  carregar,
  salvar,
  lerPessoais,
  sincronizar,
  lerConfig,
  salvarConfig,
  lerCliente,
  salvarCliente,
  carregarClientes,
  registrarUso,
  carregarUso,
  aoMudar,
};
