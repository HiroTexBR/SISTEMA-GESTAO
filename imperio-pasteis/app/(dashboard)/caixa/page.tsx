'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Comanda, ComandaItem } from '@/lib/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  CreditCard, Search, Receipt, CheckCircle2,
  Smartphone, ChevronRight, Loader2, X,
  Calculator, Banknote
} from 'lucide-react'
import { toast } from 'sonner'
import { Suspense } from 'react'
import { createPortal } from 'react-dom'

const FORMAS_PAGAMENTO = [
  { id: 'pix',      label: 'PIX',      icon: Smartphone, color: 'var(--color-status-free)'  },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote,   color: '#22C55E'                   },
  { id: 'credito',  label: 'Crédito',  icon: CreditCard, color: 'var(--color-status-prep)'  },
  { id: 'debito',   label: 'Débito',   icon: CreditCard, color: '#A855F7'                   },
  { id: 'misto',    label: 'Misto',    icon: Calculator, color: 'var(--color-brand-accent)'  },
]

const S = {
  bg:      'var(--color-surface-bg)',
  card:    'var(--color-surface-card)',
  cardH:   'var(--color-surface-card-hover)',
  border:  'var(--color-surface-border)',
  main:    'var(--color-text-main)',
  sub:     'var(--color-text-sub)',
  muted:   'var(--color-text-muted)',
  accent:  'var(--color-brand-accent)',
  green:   'var(--color-status-free)',
  red:     'var(--color-status-busy)',
  yellow:  'var(--color-status-wait)',
}

export default function CaixaPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: S.accent }} />
      </div>
    }>
      <CaixaContent />
    </Suspense>
  )
}

function CaixaContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [comandasAbertas, setComandasAbertas] = useState<Comanda[]>([])
  const [comandaSelecionada, setComandaSelecionada] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagando, setPagando] = useState(false)
  const [showPagamento, setShowPagamento] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [desconto, setDesconto] = useState(0)
  const [descontoTipo, setDescontoTipo] = useState<'reais' | 'pct'>('reais')
  const [taxaServico, setTaxaServico] = useState(0)
  const [valorRecebido, setValorRecebido] = useState(0)

  const carregarComandas = useCallback(async () => {
    const { data } = await supabase
      .from('comandas')
      .select('*, mesa:mesas(numero), garcom:usuarios!garcom_id(nome)')
      .in('status', ['aberta', 'aguardando_pagamento'])
      .order('aberta_em', { ascending: false })
    if (data) setComandasAbertas(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregarComandas()
    const comandaId = searchParams.get('comanda')
    if (comandaId) setTimeout(() => selecionarComanda(comandaId), 500)
    const interval = setInterval(carregarComandas, 15000)
    return () => clearInterval(interval)
  }, [carregarComandas])

  async function selecionarComanda(comandaId: string) {
    const { data: comanda } = await supabase
      .from('comandas')
      .select('*, mesa:mesas(numero), garcom:usuarios!garcom_id(nome)')
      .eq('id', comandaId).single()
    if (comanda) {
      setComandaSelecionada(comanda)
      const { data: itensData } = await supabase
        .from('comanda_itens').select('*')
        .eq('comanda_id', comandaId).neq('status', 'cancelado').order('criado_em')
      if (itensData) setItens(itensData)
    }
  }

  const subtotal = itens.reduce((acc, i) => acc + i.total, 0)
  const descontoValor = descontoTipo === 'reais' ? desconto : subtotal * desconto / 100
  const total = Math.max(0, subtotal - descontoValor + taxaServico)
  const troco = formaPagamento === 'dinheiro' ? Math.max(0, valorRecebido - total) : 0

  async function finalizarPagamento() {
    if (!comandaSelecionada) return
    setPagando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('pagamentos').insert({
        comanda_id: comandaSelecionada.id, usuario_id: user?.id,
        forma_pagamento: formaPagamento, valor: total,
        valor_recebido: formaPagamento === 'dinheiro' ? valorRecebido : total, troco,
      })
      await supabase.from('comandas').update({
        status: 'fechada',
        desconto_reais: descontoTipo === 'reais' ? descontoValor : 0,
        desconto_percentual: descontoTipo === 'pct' ? desconto : 0,
        taxa_servico: taxaServico, total,
        fechada_em: new Date().toISOString(),
      }).eq('id', comandaSelecionada.id)

      const { data: impressora } = await supabase
        .from('impressoras').select('id, modo_teste').eq('setor', 'caixa').eq('ativa', true).single()
      if (impressora) {
        const conteudo = gerarRecibo(comandaSelecionada, itens, total, formaPagamento, troco)
        await supabase.from('fila_impressao').insert({
          tipo_documento: 'recibo_final', comanda_id: comandaSelecionada.id,
          impressora_id: impressora.id, conteudo, status: 'pendente', modo_simulacao: impressora.modo_teste,
        })
      }
      toast.success('✅ Pagamento finalizado!')
      setShowPagamento(false); setComandaSelecionada(null); setItens([])
      carregarComandas()
    } catch { toast.error('Erro ao finalizar pagamento') }
    finally { setPagando(false) }
  }

  function gerarRecibo(comanda: Comanda, itens: ComandaItem[], total: number, forma: string, troco: number): string {
    const nome = process.env.NEXT_PUBLIC_NOME_ESTABELECIMENTO || 'IMPÉRIO PASTÉIS'
    return [
      '', `        ${nome}`, `      Mesa ${(comanda.mesa as any)?.numero || '?'}`,
      `Comanda #${String(comanda.numero).padStart(6, '0')}`, '--------------------------------',
      ...itens.map(i => `${i.quantidade}x ${i.nome_produto} - ${formatCurrency(i.total)}`),
      '--------------------------------', `TOTAL: ${formatCurrency(total)}`,
      `PAGAMENTO: ${forma.toUpperCase()}`,
      troco > 0 ? `TROCO: ${formatCurrency(troco)}` : '',
      '--------------------------------', '    Obrigado pela preferência!', '',
    ].filter(Boolean).join('\n')
  }

  const comandasFiltradas = comandasAbertas.filter(c => {
    if (!busca) return true
    const mesa = (c.mesa as any)?.numero?.toString() || ''
    return mesa.includes(busca) || c.numero?.toString().includes(busca)
  })

  return (
    <div className="flex flex-col lg:flex-row" style={{ backgroundColor: S.bg, minHeight: 'calc(100vh - 56px)' }}>

      {/* ── LISTA LATERAL ── */}
      <div
        className={`${comandaSelecionada ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-72 xl:w-80 flex-shrink-0`}
        style={{ backgroundColor: S.card, borderRight: `1px solid ${S.border}` }}
      >
        {/* Header */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: `1px solid ${S.border}` }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}>
              <CreditCard className="w-5 h-5" style={{ color: S.green }} />
            </div>
            <div>
              <h1 className="font-display font-bold text-base" style={{ color: S.main }}>Caixa</h1>
              <p className="text-xs" style={{ color: S.muted }}>
                {comandasAbertas.length} comanda{comandasAbertas.length !== 1 ? 's' : ''} abertas
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.muted }} />
            <input
              type="text" placeholder="Mesa ou comanda..."
              value={busca} onChange={e => setBusca(e.target.value)}
              className="input pl-9 py-2.5"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: S.accent }} />
            </div>
          ) : comandasFiltradas.length === 0 ? (
            <div className="text-center py-14" style={{ color: S.muted }}>
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma comanda aberta</p>
            </div>
          ) : comandasFiltradas.map(comanda => (
            <button
              key={comanda.id}
              onClick={() => selecionarComanda(comanda.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all"
              style={{
                backgroundColor: comandaSelecionada?.id === comanda.id ? 'rgba(34,197,94,0.06)' : 'transparent',
                borderBottom: `1px solid ${S.border}`,
              }}
              onMouseEnter={e => { if (comandaSelecionada?.id !== comanda.id) e.currentTarget.style.backgroundColor = S.cardH }}
              onMouseLeave={e => { if (comandaSelecionada?.id !== comanda.id) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center font-display font-black text-lg flex-shrink-0 text-white"
                style={{ backgroundColor: S.accent }}
              >
                {(comanda.mesa as any)?.numero || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: S.main }}>
                  Mesa {(comanda.mesa as any)?.numero || '?'}
                </p>
                <p className="text-xs truncate" style={{ color: S.muted }}>
                  #{String(comanda.numero).padStart(6, '0')} · {(comanda.garcom as any)?.nome || '?'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm" style={{ color: S.green }}>{formatCurrency(comanda.total || 0)}</p>
                <ChevronRight className="w-4 h-4 ml-auto" style={{ color: S.muted }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── DETALHE COMANDA ── */}
      {comandaSelecionada ? (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 h-14 flex-shrink-0"
            style={{ backgroundColor: S.card, borderBottom: `1px solid ${S.border}` }}
          >
            <button
              onClick={() => { setComandaSelecionada(null); setItens([]) }}
              className="lg:hidden p-2 rounded-lg" style={{ color: S.muted }}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h2 className="font-display font-bold text-base" style={{ color: S.main }}>
                Mesa {(comandaSelecionada.mesa as any)?.numero}
              </h2>
              <p className="text-xs" style={{ color: S.muted }}>
                #{String(comandaSelecionada.numero).padStart(6, '0')} · {formatDateTime(comandaSelecionada.aberta_em)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: S.muted }}>Total</p>
              <p className="font-display font-bold text-xl" style={{ color: S.green }}>
                {formatCurrency(comandaSelecionada.total || 0)}
              </p>
            </div>
          </div>

          {/* Itens */}
          <div className="overflow-y-auto p-4 space-y-2" style={{ flex: '1 1 0', minHeight: '80px' }}>
            {itens.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3.5 rounded-lg"
                style={{ backgroundColor: S.card, border: `1px solid ${S.border}` }}
              >
                <span className="text-sm font-bold w-8 flex-shrink-0" style={{ color: S.accent }}>
                  {item.quantidade}x
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: S.main }}>{item.nome_produto}</p>
                  {item.observacao && (
                    <p className="text-xs italic mt-0.5" style={{ color: S.muted }}>{item.observacao}</p>
                  )}
                </div>
                <p className="font-semibold text-sm" style={{ color: S.main }}>{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="p-4 space-y-3 sticky bottom-0 pb-24 lg:pb-4"
            style={{ backgroundColor: S.card, borderTop: `1px solid ${S.border}`, zIndex: 10 }}
          >
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: S.muted }}>Subtotal</span>
              <span className="font-medium" style={{ color: S.sub }}>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: S.main }}>Total</span>
              <span className="font-display font-bold text-xl" style={{ color: S.green }}>
                {formatCurrency(comandaSelecionada.total || 0)}
              </span>
            </div>
            <button
              onClick={() => setShowPagamento(true)}
              className="btn-primary w-full py-4 text-base"
            >
              <CreditCard className="w-5 h-5" />
              Fechar Conta
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center" style={{ backgroundColor: S.bg }}>
          <div className="text-center">
            <Receipt className="w-14 h-14 mx-auto mb-4 opacity-20" style={{ color: S.muted }} />
            <p className="text-sm" style={{ color: S.muted }}>Selecione uma comanda para fechar</p>
          </div>
        </div>
      )}

      {/* ── MODAL DE PAGAMENTO ── */}
      {showPagamento && comandaSelecionada && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-end lg:items-center justify-center animate-fade-in">
          <div
            className="w-full lg:max-w-md max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: S.card,
              borderRadius: '12px 12px 0 0',
            }}
          >
            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>Fechar Conta</h3>
                <button
                  onClick={() => setShowPagamento(false)}
                  className="p-2 rounded-lg" style={{ color: S.muted, backgroundColor: S.cardH }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: S.muted }}>
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS_PAGAMENTO.map(f => {
                    const Icon = f.icon
                    const selected = formaPagamento === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFormaPagamento(f.id)}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all"
                        style={{
                          backgroundColor: selected ? `${f.color}15` : S.cardH,
                          border: `1.5px solid ${selected ? f.color : S.border}`,
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${f.color}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: f.color }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: selected ? f.color : S.muted }}>
                          {f.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Desconto */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                  Desconto
                </label>
                <div className="flex gap-2">
                  <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${S.border}` }}>
                    <button
                      onClick={() => setDescontoTipo('reais')}
                      className="px-3 py-2 text-sm font-bold transition-all"
                      style={{
                        backgroundColor: descontoTipo === 'reais' ? S.accent : S.cardH,
                        color: descontoTipo === 'reais' ? '#fff' : S.muted,
                      }}
                    >R$</button>
                    <button
                      onClick={() => setDescontoTipo('pct')}
                      className="px-3 py-2 text-sm font-bold transition-all"
                      style={{
                        backgroundColor: descontoTipo === 'pct' ? S.accent : S.cardH,
                        color: descontoTipo === 'pct' ? '#fff' : S.muted,
                      }}
                    >%</button>
                  </div>
                  <input
                    type="number" min="0" value={desconto || ''}
                    onChange={e => setDesconto(Number(e.target.value))}
                    placeholder="0" className="input flex-1"
                  />
                </div>
              </div>

              {/* Taxa de serviço */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                  Taxa de Serviço (R$)
                </label>
                <input
                  type="number" min="0" value={taxaServico || ''}
                  onChange={e => setTaxaServico(Number(e.target.value))}
                  placeholder="0" className="input"
                />
              </div>

              {/* Valor recebido (dinheiro) */}
              {formaPagamento === 'dinheiro' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                    Valor Recebido
                  </label>
                  <input
                    type="number" min="0" value={valorRecebido || ''}
                    onChange={e => setValorRecebido(Number(e.target.value))}
                    placeholder={total.toString()} className="input"
                  />
                </div>
              )}

              {/* Resumo */}
              <div className="p-4 rounded-lg space-y-2" style={{ backgroundColor: S.bg }}>
                {descontoValor > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: S.muted }}>Desconto</span>
                    <span style={{ color: S.red }}>− {formatCurrency(descontoValor)}</span>
                  </div>
                )}
                {taxaServico > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: S.muted }}>Taxa de Serviço</span>
                    <span style={{ color: S.sub }}>+ {formatCurrency(taxaServico)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between pt-2"
                  style={{ borderTop: `1px solid ${S.border}` }}
                >
                  <span className="font-bold text-lg" style={{ color: S.main }}>Total</span>
                  <span className="font-display font-bold text-xl" style={{ color: S.green }}>
                    {formatCurrency(total)}
                  </span>
                </div>
                {troco > 0 && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span style={{ color: S.muted }}>Troco</span>
                    <span style={{ color: S.green }}>{formatCurrency(troco)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={finalizarPagamento}
                disabled={pagando}
                className="btn-primary w-full py-4 text-base"
              >
                {pagando
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <CheckCircle2 className="w-5 h-5" />}
                {pagando ? 'Finalizando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
