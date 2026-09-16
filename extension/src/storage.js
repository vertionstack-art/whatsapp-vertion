/**
 * Camada de dados da extensão.
 *
 * Hoje tudo mora no chrome.storage.sync, que acompanha a conta Google de cada
 * um — some do PC e aparece no notebook sozinho. Para a equipe inteira ver a
 * mesma lista, dá pra trocar o corpo de `carregar` e `salvar` por uma chamada
 * ao painel na nuvem sem mexer em mais nada.
 */

const CHAVE = "vertion_respostas";

/** Respostas que já vêm prontas na primeira instalação. */
const PADRAO = [
  {
    id: "preco",
    atalho: "preco",
    titulo: "Quanto custa",
    texto:
      "Depende do que você precisa: uma landing page é bem diferente de um sistema completo. Me conta rapidinho o que está travando aí no seu dia que eu já te passo uma faixa de valor, sem compromisso.",
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
    titulo: "Tem contrato de fidelidade",
    texto:
      "Não. Você contrata o projeto que precisa e pronto, sem fidelidade e sem mensalidade obrigatória.",
  },
  {
    id: "como-funciona",
    atalho: "comofunciona",
    titulo: "Como funciona",
    texto:
      "São quatro passos: (1) uma conversa de 15 min pra eu entender seu processo, (2) proposta por escrito em até 48h com prazo e valor, (3) construção, e (4) entrega com suporte pra ajustes.",
  },
  {
    id: "abertura",
    atalho: "oi",
    titulo: "Abertura",
    texto:
      "Oi! Aqui é da Vertion Stack. Me conta um pouco do seu negócio e o que está te tomando mais tempo hoje que eu te digo se dá pra resolver com tecnologia.",
  },
  {
    id: "fechamento",
    atalho: "fechar",
    titulo: "Fechamento",
    texto:
      "Fechado! Vou montar a proposta com prazo e valor e te mando por aqui em até 48h. Qualquer dúvida no meio do caminho, é só chamar.",
  },
];

/** Lê a lista salva. Na primeira vez, grava e devolve as respostas padrão. */
async function carregar() {
  const dados = await chrome.storage.sync.get(CHAVE);
  const lista = dados[CHAVE];
  if (Array.isArray(lista) && lista.length) return lista;

  await chrome.storage.sync.set({ [CHAVE]: PADRAO });
  return PADRAO;
}

async function salvar(lista) {
  await chrome.storage.sync.set({ [CHAVE]: lista });
}

/** Avisa quem estiver ouvindo que a lista mudou (o painel aberto, por exemplo). */
function aoMudar(callback) {
  chrome.storage.onChanged.addListener((mudancas, area) => {
    if (area === "sync" && mudancas[CHAVE]) callback(mudancas[CHAVE].newValue ?? []);
  });
}

globalThis.VertionRespostas = { carregar, salvar, aoMudar, CHAVE, PADRAO };
