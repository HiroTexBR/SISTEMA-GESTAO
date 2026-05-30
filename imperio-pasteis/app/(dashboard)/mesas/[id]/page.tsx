'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Mesa, Comanda, ComandaItem, Produto, Categoria, Adicional, ProdutoAdicionalConfig } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Plus, Minus, Trash2, Send,
  Search, ShoppingCart, ChevronRight, Loader2, X,
  MessageSquare, CheckCircle2, AlertCircle, Receipt, Tag
} from 'lucide-react'
import { toast } from 'sonner'

const S = {
  bg: 'var(--color-surface-bg)', card: 'var(--color-surface-card)',
  cardH: 'var(--color-surface-card-hover)', border: 'var(--color-surface-border)',
  borderL: 'var(--color-surface-border-light)',
  main: 'var(--color-text-main)', sub: 'var(--color-text-sub)', muted: 'var(--color-text-muted)',
  accent: 'var(--color-brand-accent)', green: 'var(--color-status-free)',
  red: 'var(--color-status-busy)', yellow: 'var(--color-status-wait)',
  blue: 'var(--color-status-prep)',
}

// Passo do modal de adicionar item
type Passo = 'lista' | 'adicionais' | 'confirmar'

export default function ComandaPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const mesaId = params.id as string

  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState<Adicional[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // Modal cardápio
  const [showCardapio, setShowCardapio] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')

  // Passos do fluxo de adicionar
  const [passo, setPasso] = useState<Passo>('lista')
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [configAdicional, setConfigAdicional] = useState<ProdutoAdicionalConfig | null>(null)
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<Adicional[]>([])
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [showObs, setShowObs] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const { data: mesaData } = await supabase.from('mesas').select('*').eq('id', mesaId).single()
      if (mesaData) setMesa(mesaData)

      const { data: comandaData } = await supabase
        .from('comandas').select('*').eq('mesa_id', mesaId)
        .in('status', ['aberta', 'aguardando_pagamento'])
        .order('aberta_em', { ascending: false }).limit(1).single()

      if (comandaData) {
        setComanda(comandaData)
        const { data: itensData } = await supabase
          .from('comanda_itens')
          .select('*')
          .eq('comanda_id', comandaData.id)
          .neq('status', 'cancelado')
          .order('criado_em')
        if (itensData) setItens(itensData)
      }

      const [{ data: prods }, { data: cats }, { data: adics }] = await Promise.all([
        supabase.from('produtos').select('*, categoria:categorias(*)').eq('ativo', true).order('nome'),
        supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
        supabase.from('adicionais').select('*').eq('ativo', true).order('ordem'),
      ])
      if (prods) setProdutos(prods)
      if (cats) setCategorias(cats)
      if (adics) setAdicionaisDisponiveis(adics)
    } catch {
      toast.error('Erro ao carregar comanda')
    } finally {
      setLoading(false)
    }
  }, [mesaId])

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel(`comanda-${mesaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comanda_itens' }, carregar)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [carregar])

  async function criarComanda() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userExists } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
    if (!userExists) {
      await supabase.from('usuarios').insert({
        id: user.id, nome: user.email?.split('@')[0] || 'Usuário',
        email: user.email, cargo: 'admin', ativo: true,
      })
    }

    const { data, error } = await supabase
      .from('comandas').insert({ mesa_id: mesaId, garcom_id: user.id, status: 'aberta' })
      .select().single()
    if (error) { toast.error('Erro ao abrir comanda: ' + error.message); return }
    setComanda(data)
    toast.success('Comanda aberta!')
  }

  // ── Seleção de produto → verificar se tem adicionais ──
  async function selecionarProduto(produto: Produto) {
    setProdutoSelecionado(produto)
    setQuantidade(1)
    setObservacao('')
    setAdicionaisSelecionados([])
    setShowObs(false)

    // Buscar config de adicionais do produto
    const { data: config } = await supabase
      .from('produto_adicionais_config')
      .select('*')
      .eq('produto_id', produto.id)
      .single()

    setConfigAdicional(config || null)

    if (config?.aceita_adicionais) {
      setPasso('adicionais')
    } else {
      setPasso('confirmar')
    }
  }

  // ── Toggle de adicional ──
  function toggleAdicional(adicional: Adicional) {
    setAdicionaisSelecionados(prev => {
      const jatem = prev.find(a => a.id === adicional.id)
      if (jatem) return prev.filter(a => a.id !== adicional.id)
      return [...prev, adicional]
    })
  }

  // ── Cálculo do preço dos adicionais ──
  function calcularPrecoAdicionais(): number {
    if (!configAdicional) return 0
    const extras = Math.max(0, adicionaisSelecionados.length - configAdicional.max_gratis)
    return extras * (configAdicional.preco_por_extra || 1)
  }

  function calcularTotal(): number {
    if (!produtoSelecionado) return 0
    return quantidade * produtoSelecionado.preco_venda + calcularPrecoAdicionais()
  }

  // ── Adicionar item na comanda ──
  async function adicionarItem() {
    if (!comanda || !produtoSelecionado) return
    const { data: { user } } = await supabase.auth.getUser()

    const totalAdicionais = calcularPrecoAdicionais()
    const totalItem = quantidade * produtoSelecionado.preco_venda + totalAdicionais

    // Monta texto resumido dos adicionais para impressão
    const adicionaisTexto = adicionaisSelecionados.length > 0
      ? adicionaisSelecionados.map((a, idx) => {
          const gratis = idx < (configAdicional?.max_gratis ?? 2)
          return gratis ? a.nome : `${a.nome} (+R$1)`
        }).join(', ')
      : null

    const { data: itemInserido, error } = await supabase.from('comanda_itens').insert({
      comanda_id: comanda.id,
      produto_id: produtoSelecionado.id,
      nome_produto: produtoSelecionado.nome,
      quantidade,
      preco_unitario: produtoSelecionado.preco_venda,
      total: totalItem,
      total_adicionais: totalAdicionais,
      adicionais_texto: adicionaisTexto,
      observacao: observacao || null,
      garcom_id: user?.id,
      status: 'pendente',
    }).select().single()

    if (error) { toast.error('Erro ao adicionar item'); return }

    // Inserir adicionais vinculados
    if (adicionaisSelecionados.length > 0 && itemInserido) {
      const adicionaisParaInserir = adicionaisSelecionados.map((a, idx) => ({
        comanda_item_id: itemInserido.id,
        adicional_id: a.id,
        nome_adicional: a.nome,
        preco_cobrado: idx < (configAdicional?.max_gratis ?? 2) ? 0 : (configAdicional?.preco_por_extra ?? 1),
      }))
      await supabase.from('comanda_item_adicionais').insert(adicionaisParaInserir)
    }

    // Resetar estado
    setProdutoSelecionado(null)
    setConfigAdicional(null)
    setAdicionaisSelecionados([])
    setQuantidade(1)
    setObservacao('')
    setShowObs(false)
    setPasso('lista')

    toast.success(`${produtoSelecionado.nome} adicionado!`)
    carregar()
  }

  async function removerItem(itemId: string, nome: string) {
    if (!confirm(`Remover "${nome}"?`)) return
    await supabase.from('comanda_itens')
      .update({ status: 'cancelado', motivo_cancelamento: 'Removido pelo garçom' })
      .eq('id', itemId)
    toast.success('Item removido')
    carregar()
  }

  async function enviarParaProducao() {
    if (!comanda || itens.length === 0) return
    const itensNaoEnviados = itens.filter(i => !i.enviado_para_producao)
    if (itensNaoEnviados.length === 0) { toast.info('Todos os itens já foram enviados'); return }

    setEnviando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: usuarioData } = await supabase.from('usuarios').select('nome').eq('id', user?.id).single()

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos_producao').insert({
          comanda_id: comanda.id, mesa_id: mesaId, mesa_numero: mesa?.numero,
          garcom_id: user?.id, garcom_nome: usuarioData?.nome,
          status: 'novo', status_impressao: 'pendente',
        }).select().single()

      if (pedidoError) throw pedidoError

      await supabase.from('pedido_itens').insert(
        itensNaoEnviados.map(item => ({
          pedido_producao_id: pedido.id, comanda_item_id: item.id,
          produto_id: item.produto_id, nome_produto: item.nome_produto,
          quantidade: item.quantidade,
          // Inclui adicionais na observação de produção
          observacao: [
            item.adicionais_texto ? `+ ${item.adicionais_texto}` : '',
            item.observacao || '',
          ].filter(Boolean).join(' | ') || null,
        }))
      )

      await supabase.from('comanda_itens')
        .update({ enviado_para_producao: true, enviado_em: new Date().toISOString(), status: 'enviado' })
        .in('id', itensNaoEnviados.map(i => i.id))

      const { data: impressora } = await supabase
        .from('impressoras').select('id, modo_teste').eq('setor', 'producao').eq('ativa', true).single()

      if (impressora) {
        const linhas = [
          '', `        MESA ${mesa?.numero || '?'}`,
          `     COMANDA #${String(comanda?.numero || '?').padStart(6, '0')}`,
          `GARÇOM: ${usuarioData?.nome || '?'}`,
          `HORÁRIO: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          '--------------------------------',
          ...itensNaoEnviados.map(item => {
            const linhaItem = `${item.quantidade}x ${item.nome_produto}`
            const linhaAdic = item.adicionais_texto ? `   + ${item.adicionais_texto}` : ''
            const linhaObs = item.observacao ? `   OBS: ${item.observacao}` : ''
            return [linhaItem, linhaAdic, linhaObs].filter(Boolean).join('\n')
          }),
          '--------------------------------', '      SETOR: PRODUÇÃO', '',
        ]
        await supabase.from('fila_impressao').insert({
          tipo_documento: 'pedido_producao', comanda_id: comanda.id,
          pedido_producao_id: pedido.id, impressora_id: impressora.id,
          conteudo: linhas.join('\n'), status: 'pendente', modo_simulacao: impressora.modo_teste,
        })
      }

      toast.success('✅ Pedido enviado para produção!')
      carregar()
    } catch { toast.error('Erro ao enviar pedido') }
    finally { setEnviando(false) }
  }

  const itensNaoEnviados = itens.filter(i => !i.enviado_para_producao)
  const totalComanda = itens.reduce((acc, i) => acc + i.total, 0)

  // ── Adicionais filtrados por tipo do produto ──
  const adicionaisParaExibir = adicionaisDisponiveis.filter(a => {
    if (!configAdicional) return false
    if (configAdicional.tipo_adicional === 'ambos') return a.tipo === 'salgado' || a.tipo === 'doce' || a.tipo === 'recheio_extra'
    return a.tipo === configAdicional.tipo_adicional || a.tipo === 'recheio_extra'
  })

  const produtosFiltrados = produtos
    .filter(p => categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro)
    .filter(p => buscaProduto === '' || p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))

  function fecharModal() {
    setShowCardapio(false)
    setProdutoSelecionado(null)
    setConfigAdicional(null)
    setAdicionaisSelecionados([])
    setPasso('lista')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: S.accent }} />
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: S.bg }}>

      {/* ── HEADER ── */}
      <div
        className="flex items-center gap-3 px-4 h-14 flex-shrink-0 sticky top-0 z-20"
        style={{ backgroundColor: S.card, borderBottom: `1px solid ${S.border}` }}
      >
        <button onClick={() => router.back()} className="p-2 rounded-lg" style={{ color: S.muted }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base tracking-tight" style={{ color: S.main }}>
            {mesa?.descricao ? mesa.descricao.match(/^([A-Z]\d+)/)?.[1] || mesa.numero : mesa?.numero}
          </h1>
          {comanda ? (
            <p className="text-xs" style={{ color: S.muted }}>Comanda #{String(comanda.numero).padStart(6, '0')} · {mesa?.descricao?.replace(/^[A-Z]\d+\s*—\s*/, '') || ''}</p>
          ) : (
            <p className="text-xs" style={{ color: S.muted }}>{mesa?.descricao || 'Mesa livre'}</p>
          )}
        </div>
        {comanda && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: S.muted }}>Total</p>
            <p className="font-display font-bold text-base" style={{ color: S.accent }}>{formatCurrency(totalComanda)}</p>
          </div>
        )}
      </div>

      {/* ── SEM COMANDA ── */}
      {!comanda ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
              <Receipt className="w-8 h-8" style={{ color: S.green }} />
            </div>
            <h2 className="font-display font-bold text-xl mb-2" style={{ color: S.main }}>Mesa Livre</h2>
            <p className="text-sm mb-6" style={{ color: S.muted }}>Toque para abrir uma comanda</p>
            <button onClick={criarComanda} className="btn-primary px-8 py-3.5 text-base">Abrir Comanda</button>
          </div>
        </div>
      ) : (
        <>
          {/* ── LISTA DE ITENS ── */}
          <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-2">
            {itens.length === 0 ? (
              <div className="text-center py-16" style={{ color: S.muted }}>
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum item adicionado</p>
                <p className="text-xs mt-1 opacity-60">Toque em "+ Adicionar" para começar</p>
              </div>
            ) : (
              itens.map(item => (
                <ItemCard key={item.id} item={item} onRemover={() => removerItem(item.id, item.nome_produto)} />
              ))
            )}
          </div>

          {/* ── BARRA INFERIOR ── */}
          <div
            className="fixed bottom-0 inset-x-0 lg:relative p-4 space-y-3 safe-bottom"
            style={{ backgroundColor: S.card, borderTop: `1px solid ${S.border}` }}
          >
            {itensNaoEnviados.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'rgba(251,191,36,0.08)', color: S.yellow }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {itensNaoEnviados.length} {itensNaoEnviados.length === 1 ? 'item não enviado' : 'itens não enviados'} para produção
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowCardapio(true); setPasso('lista') }} className="btn-secondary flex-1">
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
              <button
                onClick={enviarParaProducao}
                disabled={enviando || itensNaoEnviados.length === 0}
                className="btn-primary flex-1"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? 'Enviando...' : `Enviar (${itensNaoEnviados.length})`}
              </button>
            </div>
            <button
              onClick={() => router.push(`/caixa?comanda=${comanda.id}`)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all"
              style={{ border: `1.5px solid ${S.green}`, color: S.green }}
            >
              <Receipt className="w-4 h-4" />
              Fechar Conta — {formatCurrency(totalComanda)}
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
           MODAL DO CARDÁPIO (3 passos)
         ══════════════════════════════════════════════════════ */}
      {showCardapio && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6 animate-fade-in">
          <div
            className="w-full lg:max-w-xl max-h-[92vh] flex flex-col"
            style={{ backgroundColor: S.card, borderRadius: '12px 12px 0 0' }}
          >
            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.borderL }} />
            </div>

            {/* ─── PASSO: LISTA DE PRODUTOS ─── */}
            {passo === 'lista' && (
              <>
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${S.border}` }}>
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.muted }} />
                    <input
                      type="text" placeholder="Buscar produto..."
                      value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)}
                      autoFocus className="input pl-9 py-2.5"
                    />
                  </div>
                  <button onClick={fecharModal} className="p-2 rounded-lg"
                    style={{ color: S.muted, backgroundColor: S.cardH }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Filtro categorias */}
                <div className="flex gap-2 px-4 py-2.5 overflow-x-auto flex-shrink-0 no-select"
                  style={{ borderBottom: `1px solid ${S.border}` }}>
                  <button onClick={() => setCategoriaFiltro('todas')}
                    className="px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: categoriaFiltro === 'todas' ? S.accent : S.cardH,
                      color: categoriaFiltro === 'todas' ? '#fff' : S.muted,
                    }}>Todos</button>
                  {categorias.map(cat => (
                    <button key={cat.id} onClick={() => setCategoriaFiltro(cat.id)}
                      className="px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                      style={{
                        backgroundColor: categoriaFiltro === cat.id ? S.accent : S.cardH,
                        color: categoriaFiltro === cat.id ? '#fff' : S.muted,
                      }}>
                      {cat.icone} {cat.nome}
                    </button>
                  ))}
                </div>

                {/* Lista de produtos */}
                <div className="flex-1 overflow-y-auto">
                  {produtosFiltrados.map(produto => (
                    <button key={produto.id} onClick={() => selecionarProduto(produto)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                      style={{ borderBottom: `1px solid ${S.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = S.cardH)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
                        {(produto as any).categoria?.icone || '🍽️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: S.main }}>{produto.nome}</p>
                        <p className="text-xs truncate" style={{ color: S.muted }}>{(produto as any).categoria?.nome}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: S.accent }}>
                          {formatCurrency(produto.preco_venda)}
                        </span>
                        <ChevronRight className="w-4 h-4" style={{ color: S.muted }} />
                      </div>
                    </button>
                  ))}
                  {produtosFiltrados.length === 0 && (
                    <div className="text-center py-10" style={{ color: S.muted }}>
                      <p className="text-sm">Nenhum produto encontrado</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── PASSO: ADICIONAIS ─── */}
            {passo === 'adicionais' && produtoSelecionado && configAdicional && (
              <>
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${S.border}` }}>
                  <button onClick={() => setPasso('lista')} className="p-2 rounded-lg"
                    style={{ color: S.muted, backgroundColor: S.cardH }}>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <p className="font-display font-bold text-sm" style={{ color: S.main }}>{produtoSelecionado.nome}</p>
                    <p className="text-xs" style={{ color: S.muted }}>Escolha os adicionais</p>
                  </div>
                  <button onClick={fecharModal} className="p-2 rounded-lg"
                    style={{ color: S.muted, backgroundColor: S.cardH }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Banner de regra */}
                <div className="mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: `1px solid rgba(34,197,94,0.15)` }}>
                  <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: S.green }} />
                  <p className="text-xs font-semibold" style={{ color: S.green }}>
                    Até {configAdicional.max_gratis} adicionais GRÁTIS · A partir do {configAdicional.max_gratis + 1}°: R$1,00 cada
                  </p>
                </div>

                {/* Contador */}
                <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: S.muted }}>
                    Adicionais disponíveis
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm" style={{ color: adicionaisSelecionados.length > configAdicional.max_gratis ? S.accent : S.green }}>
                      {adicionaisSelecionados.length} selecionado{adicionaisSelecionados.length !== 1 ? 's' : ''}
                    </span>
                    {adicionaisSelecionados.length > configAdicional.max_gratis && (
                      <span className="text-xs font-bold" style={{ color: S.accent }}>
                        +{formatCurrency(calcularPrecoAdicionais())}
                      </span>
                    )}
                  </div>
                </div>

                {/* Lista de adicionais */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  {/* Separadores por tipo */}
                  {['salgado', 'doce', 'recheio_extra'].map(tipo => {
                    const lista = adicionaisParaExibir.filter(a => a.tipo === tipo)
                    if (lista.length === 0) return null
                    const labels: Record<string, string> = {
                      salgado: '🧂 Adicionais Salgados',
                      doce: '🍬 Adicionais Doces',
                      recheio_extra: '🥩 Recheio Extra (R$3,00 cada)'
                    }
                    return (
                      <div key={tipo} className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-3"
                          style={{ color: S.muted }}>{labels[tipo]}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {lista.map((adicional, idx) => {
                            const sel = adicionaisSelecionados.find(a => a.id === adicional.id)
                            // Posição se selecionado (para saber se é grátis ou pago)
                            const posicao = adicionaisSelecionados.indexOf(adicional)
                            const ePago = sel && posicao >= configAdicional.max_gratis
                            return (
                              <button
                                key={adicional.id}
                                onClick={() => toggleAdicional(adicional)}
                                className="flex items-center gap-2.5 p-3 rounded-lg text-left transition-all"
                                style={{
                                  backgroundColor: sel ? 'rgba(249,115,22,0.12)' : S.cardH,
                                  border: `1.5px solid ${sel ? S.accent : S.border}`,
                                }}
                              >
                                <div
                                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                                  style={{
                                    backgroundColor: sel ? S.accent : S.border,
                                  }}
                                >
                                  {sel && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold truncate" style={{ color: sel ? S.main : S.sub }}>
                                    {adicional.nome}
                                  </p>
                                  {adicional.tipo === 'recheio_extra' && (
                                    <p className="text-[10px]" style={{ color: S.accent }}>+R$3,00</p>
                                  )}
                                  {ePago && adicional.tipo !== 'recheio_extra' && (
                                    <p className="text-[10px]" style={{ color: S.accent }}>+R$1,00</p>
                                  )}
                                  {sel && !ePago && adicional.tipo !== 'recheio_extra' && (
                                    <p className="text-[10px]" style={{ color: S.green }}>Grátis</p>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="px-4 pb-4 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${S.border}` }}>
                  <button onClick={() => setPasso('confirmar')} className="btn-primary w-full py-3.5">
                    Continuar
                    {adicionaisSelecionados.length > 0 && (
                      <span className="ml-1 text-white/70">
                        ({adicionaisSelecionados.length} adicional{adicionaisSelecionados.length !== 1 ? 'is' : ''})
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ─── PASSO: CONFIRMAR ─── */}
            {passo === 'confirmar' && produtoSelecionado && (
              <>
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${S.border}` }}>
                  <button
                    onClick={() => setPasso(configAdicional?.aceita_adicionais ? 'adicionais' : 'lista')}
                    className="p-2 rounded-lg"
                    style={{ color: S.muted, backgroundColor: S.cardH }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <p className="font-display font-bold text-sm" style={{ color: S.main }}>{produtoSelecionado.nome}</p>
                    <p className="text-xs" style={{ color: S.muted }}>Confirmar pedido</p>
                  </div>
                  <button onClick={fecharModal} className="p-2 rounded-lg"
                    style={{ color: S.muted, backgroundColor: S.cardH }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Resumo do produto */}
                  <div className="p-4 rounded-lg" style={{ backgroundColor: S.bg }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                        style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
                        🥟
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: S.main }}>{produtoSelecionado.nome}</p>
                        <p className="text-sm" style={{ color: S.accent }}>{formatCurrency(produtoSelecionado.preco_venda)}</p>
                      </div>
                    </div>

                    {/* Adicionais resumo */}
                    {adicionaisSelecionados.length > 0 && (
                      <div className="space-y-1 pt-2" style={{ borderTop: `1px solid ${S.border}` }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: S.muted }}>
                          Adicionais
                        </p>
                        {adicionaisSelecionados.map((a, idx) => {
                          const gratis = idx < (configAdicional?.max_gratis ?? 2)
                          const ehRecheioExtra = a.tipo === 'recheio_extra'
                          const preco = ehRecheioExtra ? a.preco_extra : (gratis ? 0 : configAdicional?.preco_por_extra ?? 1)
                          return (
                            <div key={a.id} className="flex items-center justify-between">
                              <span className="text-xs" style={{ color: S.sub }}>+ {a.nome}</span>
                              <span className="text-xs font-bold" style={{ color: gratis && !ehRecheioExtra ? S.green : S.accent }}>
                                {gratis && !ehRecheioExtra ? 'Grátis' : `+${formatCurrency(preco)}`}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: S.muted }}>
                      Quantidade
                    </label>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                        className="w-11 h-11 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: S.cardH, color: S.main }}>
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-display font-bold text-2xl w-10 text-center" style={{ color: S.main }}>
                        {quantidade}
                      </span>
                      <button onClick={() => setQuantidade(quantidade + 1)}
                        className="w-11 h-11 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: S.accent, color: '#fff' }}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <button onClick={() => setShowObs(!showObs)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors"
                      style={{ color: showObs ? S.accent : S.muted }}>
                      <MessageSquare className="w-4 h-4" />
                      {showObs ? 'Remover observação' : 'Adicionar observação'}
                    </button>
                    {showObs && (
                      <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
                        placeholder="Ex: Sem cebola, bem passado..."
                        rows={2} className="input mt-2 resize-none" />
                    )}
                  </div>

                  {/* Total final */}
                  <div className="flex items-center justify-between p-4 rounded-lg"
                    style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
                    <div>
                      <p className="text-xs" style={{ color: S.muted }}>{quantidade}x {formatCurrency(produtoSelecionado.preco_venda)}</p>
                      {calcularPrecoAdicionais() > 0 && (
                        <p className="text-xs" style={{ color: S.accent }}>+ {formatCurrency(calcularPrecoAdicionais())} adicionais</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: S.muted }}>Total</p>
                      <p className="font-display font-bold text-xl" style={{ color: S.accent }}>
                        {formatCurrency(calcularTotal())}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${S.border}` }}>
                  <button onClick={adicionarItem} className="btn-primary w-full py-3.5">
                    <Plus className="w-4 h-4" />
                    Adicionar à Comanda
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ItemCard ──────────────────────────────────────────────────
function ItemCard({ item, onRemover }: { item: ComandaItem; onRemover: () => void }) {
  return (
    <div
      className="flex gap-3 p-3.5 rounded-lg transition-all"
      style={{
        backgroundColor: item.enviado_para_producao ? 'var(--color-surface-card)' : 'rgba(249,115,22,0.05)',
        border: `1px solid ${item.enviado_para_producao ? 'var(--color-surface-border)' : 'rgba(249,115,22,0.15)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--color-text-main)' }}>
            {item.nome_produto}
          </span>
          {item.enviado_para_producao ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-status-free)' }} />
          ) : (
            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 animate-pulse"
              style={{ backgroundColor: 'var(--color-brand-accent)' }} />
          )}
        </div>

        {/* Adicionais */}
        {item.adicionais_texto && (
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <span style={{ color: 'var(--color-brand-accent)' }}>+</span>
            {item.adicionais_texto}
          </p>
        )}

        {/* Observação */}
        {item.observacao && (
          <p className="text-xs italic mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            📝 {item.observacao}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: 'var(--color-surface-card-hover)', color: 'var(--color-text-muted)' }}>
            {item.quantidade}x
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatCurrency(item.preco_unitario)}
            {(item.total_adicionais ?? 0) > 0 && (
              <span style={{ color: 'var(--color-brand-accent)' }}> +{formatCurrency(item.total_adicionais ?? 0)}</span>
            )}
          </span>
          <span className="text-sm font-bold ml-auto" style={{ color: 'var(--color-brand-accent)' }}>
            {formatCurrency(item.total)}
          </span>
        </div>
      </div>
      {!item.enviado_para_producao && (
        <button
          onClick={onRemover}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 self-start transition-colors"
          style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--color-status-busy)', minHeight: 'unset' }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
