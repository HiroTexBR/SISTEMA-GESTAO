import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const { impressora_id, tipo_documento, comanda_id, pedido_producao_id, conteudo, modo_simulacao } = body

    // Buscar impressora
    const { data: impressora } = await supabase
      .from('impressoras')
      .select('*')
      .eq('id', impressora_id)
      .eq('ativa', true)
      .single()

    if (!impressora) {
      return NextResponse.json({ erro: 'Impressora não encontrada' }, { status: 404 })
    }

    // Criar entrada na fila
    const { data: filaItem, error } = await supabase
      .from('fila_impressao')
      .insert({
        tipo_documento,
        comanda_id: comanda_id || null,
        pedido_producao_id: pedido_producao_id || null,
        impressora_id,
        conteudo,
        status: 'pendente',
        modo_simulacao: modo_simulacao ?? impressora.modo_teste,
      })
      .select()
      .single()

    if (error) throw error

    // Log
    await supabase.from('logs_sistema').insert({
      usuario_id: user.id,
      acao: 'impressao_solicitada',
      descricao: `Solicitação de impressão: ${tipo_documento}`,
      detalhes: { impressora_id, tipo_documento, fila_id: filaItem.id },
    })

    return NextResponse.json({ ok: true, fila_id: filaItem.id })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

// GET: buscar status da fila
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const impressoraId = searchParams.get('impressora_id')

    const query = supabase
      .from('fila_impressao')
      .select('*, impressora:impressoras(nome, setor)')
      .order('criado_em', { ascending: false })
      .limit(20)

    if (impressoraId) query.eq('impressora_id', impressoraId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ fila: data })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
