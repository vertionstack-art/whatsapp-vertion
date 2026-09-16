import respostas from "@/lib/respostas.json";

/**
 * Biblioteca de respostas da equipe.
 *
 * A extensão busca esta lista de tempos em tempos, então editar
 * `src/lib/respostas.json` e publicar já atualiza todo mundo — ninguém
 * precisa reinstalar nem recarregar nada.
 *
 * CORS liberado de propósito: o conteúdo é público (é o mesmo texto que a
 * gente manda pro cliente) e a extensão precisa ler de outra origem.
 */

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // Meia hora de cache na borda: rápido para a extensão, sem atrasar demais
  // uma resposta nova que a equipe acabou de publicar.
  "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
};

export function GET() {
  return Response.json(
    {
      versao: 1,
      atualizadoEm: new Date().toISOString(),
      total: respostas.length,
      respostas,
    },
    { headers: CABECALHOS }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CABECALHOS });
}
