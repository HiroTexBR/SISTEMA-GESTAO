'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { Impressora } from '@/lib/types'
import {
  Package, AlertTriangle, Plus, Minus,
  RefreshCw, Search, History, X, Loader2, CheckCircle2,
  BarChart3, ArrowUpRight, ArrowDownRight, Edit2, Trash2,
  Save, PackagePlus, TrendingDown, ShoppingCart, Printer,
  ClipboardList, ShoppingBag
} from 'lucide-react'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'

type TipoMovimento = 'entrada' | 'saida' | 'ajuste'

type Insumo = {
  id: string
  nome: string
  descricao: string | null
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
  preco_custo: number
  fornecedor: string | null
  ativo: boolean
  criado_em: string
}

type Movimentacao = {
  id: string
  insumo_id: string
  tipo: string
  quantidade: number
  quantidade_anterior: number
  quantidade_posterior: number
  observacao: string | null
  criado_em: string
  insumo?: { nome: string; unidade: string } | null
  usuario?: { nome: string } | null
}

const S = {
  bg: 'var(--color-surface-bg)', card: 'var(--color-surface-card)',
  cardH: 'var(--color-surface-card-hover)', border: 'var(--color-surface-border)',
  main: 'var(--color-text-main)', sub: 'var(--color-text-sub)', muted: 'var(--color-text-muted)',
  accent: 'var(--color-brand-accent)', green: 'var(--color-status-free)',
  red: 'var(--color-status-busy)', yellow: 'var(--color-status-wait)',
  blue: 'var(--color-status-prep)',
}

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'sc', 'lt', 'fardo', 'dz', 'maço']

const TIPOS_MOV = [
  { id: 'entrada', label: 'Entrada',  icon: ArrowUpRight,   color: 'var(--color-status-free)' },
  { id: 'saida',   label: 'Saída',    icon: ArrowDownRight,  color: 'var(--color-status-busy)' },
  { id: 'ajuste',  label: 'Ajuste',   icon: BarChart3,       color: 'var(--color-status-prep)' },
]

// Ícones por categoria de nome
function iconeInsumo(nome: string): string {
  const n = nome.toLowerCase()
  if (n.includes('queijo') || n.includes('mussarela')) return '🧀'
  if (n.includes('batata')) return '🥔'
  if (n.includes('frango') || n.includes('galinha')) return '🍗'
  if (n.includes('carne') || n.includes('boi') || n.includes('bife')) return '🥩'
  if (n.includes('óleo') || n.includes('azeite')) return '🫙'
  if (n.includes('farinha') || n.includes('trigo')) return '🌾'
  if (n.includes('sal') || n.includes('tempero')) return '🧂'
  if (n.includes('calabresa') || n.includes('linguiça')) return '🌭'
  if (n.includes('presunto') || n.includes('frios')) return '🥓'
  if (n.includes('palmito')) return '🌿'
  if (n.includes('ovo') || n.includes('ovos')) return '🥚'
  if (n.includes('tomate') || n.includes('molho')) return '🍅'
  if (n.includes('cebola') || n.includes('alho')) return '🧅'
  if (n.includes('açúcar') || n.includes('acucar')) return '🍬'
  if (n.includes('refrigerante') || n.includes('suco') || n.includes('bebida')) return '🥤'
  if (n.includes('embalagem') || n.includes('caixa') || n.includes('saco')) return '📦'
  if (n.includes('guardanapo') || n.includes('papel')) return '🧻'
  return '🏭'
}

export default function EstoquePage() {
  const supabase = createClient()

  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [tabelaExiste, setTabelaExiste] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'baixo' | 'zerado'>('todos')

  // Modal movimentação
  const [showMovModal, setShowMovModal] = useState(false)
  const [insumoSelecionado, setInsumoSelecionado] = useState<Insumo | null>(null)
  const [tipoMov, setTipoMov] = useState<TipoMovimento>('entrada')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [observacao, setObservacao] = useState('')
  const [salvandoMov, setSalvandoMov] = useState(false)

  // Modal cadastro/edição
  const [showCadModal, setShowCadModal] = useState(false)
  const [editando, setEditando] = useState<Insumo | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formUnidade, setFormUnidade] = useState('kg')
  const [formQtdAtual, setFormQtdAtual] = useState(0)
  const [formQtdMinima, setFormQtdMinima] = useState(0)
  const [formFornecedor, setFormFornecedor] = useState('')
  const [salvandoCad, setSalvandoCad] = useState(false)

  // Modal exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletando, setDeletando] = useState<Insumo | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Modal balanço do dia
  const [showBalanco, setShowBalanco] = useState(false)
  const [impressoras, setImpressoras] = useState<Impressora[]>([])
  const [imprimindoTermica, setImprimindoTermica] = useState(false)

  const carregar = useCallback(async () => {
    // Tenta carregar da tabela insumos
    const { data: ins, error: errIns } = await supabase
      .from('insumos')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (errIns) {
      // Tabela ainda não existe - migration não foi rodada
      setTabelaExiste(false)
      setLoading(false)
      return
    }

    setTabelaExiste(true)
    if (ins) setInsumos(ins as Insumo[])

    const { data: movs } = await supabase
      .from('insumo_movimentacoes')
      .select('*, insumo:insumos(nome, unidade), usuario:usuarios(nome)')
      .order('criado_em', { ascending: false })
      .limit(50)

    if (movs) setMovimentacoes(movs as Movimentacao[])

    // Carrega impressoras ativas
    const { data: imps } = await supabase.from('impressoras').select('*').eq('ativa', true)
    if (imps) setImpressoras(imps as Impressora[])

    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Cadastro / Edição ─────────────────────────────────────
  function abrirNovo() {
    setEditando(null)
    setFormNome(''); setFormDescricao(''); setFormUnidade('kg')
    setFormQtdAtual(0); setFormQtdMinima(0); setFormFornecedor('')
    setShowCadModal(true)
  }

  function abrirEdicao(ins: Insumo) {
    setEditando(ins)
    setFormNome(ins.nome)
    setFormDescricao(ins.descricao || '')
    setFormUnidade(ins.unidade)
    setFormQtdAtual(ins.quantidade_atual)
    setFormQtdMinima(ins.quantidade_minima)
    setFormFornecedor(ins.fornecedor || '')
    setShowCadModal(true)
  }

  async function salvarCadastro() {
    if (!formNome.trim()) { toast.error('Informe o nome do insumo'); return }
    setSalvandoCad(true)
    try {
      if (editando) {
        const { error } = await supabase.from('insumos').update({
          nome: formNome.trim(),
          descricao: formDescricao.trim() || null,
          unidade: formUnidade,
          quantidade_minima: formQtdMinima,
          fornecedor: formFornecedor.trim() || null,
        }).eq('id', editando.id)
        if (error) throw error
        toast.success('✅ Insumo atualizado!')
      } else {
        const { error } = await supabase.from('insumos').insert({
          nome: formNome.trim(),
          descricao: formDescricao.trim() || null,
          unidade: formUnidade,
          quantidade_atual: formQtdAtual,
          quantidade_minima: formQtdMinima,
          fornecedor: formFornecedor.trim() || null,
          ativo: true,
        })
        if (error) throw error
        toast.success('✅ Insumo cadastrado no estoque!')
      }
      setShowCadModal(false)
      carregar()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || ''))
    } finally { setSalvandoCad(false) }
  }

  // ── Exclusão ──────────────────────────────────────────────
  async function confirmarExclusao() {
    if (!deletando) return
    setExcluindo(true)
    try {
      await supabase.from('insumos').update({ ativo: false }).eq('id', deletando.id)
      toast.success('Insumo removido do estoque')
      setShowDeleteModal(false); setDeletando(null)
      carregar()
    } catch { toast.error('Erro ao remover') }
    finally { setExcluindo(false) }
  }

  // ── Movimentação ──────────────────────────────────────────
  function abrirMovimentacao(ins: Insumo, tipo: TipoMovimento = 'entrada') {
    setInsumoSelecionado(ins)
    setTipoMov(tipo)
    setQuantidade(1)
    setObservacao('')
    setShowMovModal(true)
  }

  async function registrarMovimento() {
    if (!insumoSelecionado || quantidade <= 0) return
    setSalvandoMov(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const qAnt = insumoSelecionado.quantidade_atual
      let qNova = qAnt
      if (tipoMov === 'entrada') qNova = qAnt + quantidade
      else if (tipoMov === 'saida') qNova = Math.max(0, qAnt - quantidade)
      else qNova = quantidade

      const { error: errMov } = await supabase.from('insumo_movimentacoes').insert({
        insumo_id: insumoSelecionado.id, tipo: tipoMov, quantidade,
        quantidade_anterior: qAnt, quantidade_posterior: qNova,
        usuario_id: user?.id, observacao: observacao || null,
      })
      if (errMov) throw errMov

      const { error: errUp } = await supabase
        .from('insumos').update({ quantidade_atual: qNova }).eq('id', insumoSelecionado.id)
      if (errUp) throw errUp

      toast.success(`✅ ${tipoMov === 'entrada' ? 'Entrada' : tipoMov === 'saida' ? 'Saída' : 'Ajuste'} registrado: ${qAnt} → ${qNova} ${insumoSelecionado.unidade}`)
      setShowMovModal(false); carregar()
    } catch (err: any) { toast.error('Erro: ' + (err?.message || '')) }
    finally { setSalvandoMov(false) }
  }

  async function enviarParaTermica(impressora: Impressora) {
    setImprimindoTermica(true)
    try {
      const zerados = insumos.filter(i => i.quantidade_atual === 0)
      const baixos = insumos.filter(i => i.quantidade_atual > 0 && i.quantidade_atual <= i.quantidade_minima)
      const okItems = insumos.filter(i => i.quantidade_atual > i.quantidade_minima)
      const precisaComprar = [...zerados, ...baixos]
      
      const largura = impressora.largura_papel === '80mm' ? 48 : 32
      const linha = '='.repeat(largura)
      const linhaFraca = '-'.repeat(largura)
      
      let conteudo = `
${linha}
       BALANCO DO DIA - ESTOQUE
       IMPERIO PASTEIS
${linha}
DATA/HORA: ${new Date().toLocaleString('pt-BR')}

RESUMO:
 OK: ${okItems.length} | BAIXO: ${baixos.length} | ZERADO: ${zerados.length}
`
      if (precisaComprar.length > 0) {
        conteudo += `\n${linha}\n      LISTA DE COMPRAS (${precisaComprar.length})\n${linha}\n`
        
        if (zerados.length > 0) {
          conteudo += `\n[ ZERADOS - URGENTE ]\n`
          zerados.forEach(ins => {
            conteudo += `${ins.nome}\n`
            conteudo += ` > COMPRAR: ${ins.quantidade_minima} ${ins.unidade}\n`
            conteudo += `${linhaFraca}\n`
          })
        }
        
        if (baixos.length > 0) {
          conteudo += `\n[ ABAIXO DO MINIMO ]\n`
          baixos.forEach(ins => {
            conteudo += `${ins.nome}\n`
            conteudo += ` > ATUAL: ${ins.quantidade_atual} ${ins.unidade}\n`
            conteudo += ` > COMPRAR: ${Math.ceil(ins.quantidade_minima - ins.quantidade_atual)} ${ins.unidade}\n`
            conteudo += `${linhaFraca}\n`
          })
        }
      }
      
      conteudo += `\n${linha}\nCONFERIDO POR: ________________\n\n\n[CORTE]\n`

      const { error } = await supabase.from('fila_impressao').insert({
        tipo_documento: 'balanco_estoque',
        impressora_id: impressora.id,
        conteudo,
        status: 'pendente',
        modo_simulacao: false
      })
      
      if (error) throw error
      toast.success(`Enviado para a impressora ${impressora.nome}!`)
    } catch (err: any) {
      toast.error('Erro ao enviar para impressora: ' + err.message)
    } finally {
      setImprimindoTermica(false)
    }
  }

  // ── Filtros ───────────────────────────────────────────────
  const insumosFiltrados = insumos.filter(ins => {
    const matchBusca = !busca || ins.nome.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro = filtro === 'todos' ||
      (filtro === 'baixo' && ins.quantidade_atual <= ins.quantidade_minima && ins.quantidade_atual > 0) ||
      (filtro === 'zerado' && ins.quantidade_atual === 0)
    return matchBusca && matchFiltro
  })

  const stats = {
    total: insumos.length,
    baixo: insumos.filter(i => i.quantidade_atual <= i.quantidade_minima && i.quantidade_atual > 0).length,
    zerado: insumos.filter(i => i.quantidade_atual === 0).length,
    ok: insumos.filter(i => i.quantidade_atual > i.quantidade_minima).length,
  }

  const resultadoMov = insumoSelecionado
    ? tipoMov === 'entrada'
      ? insumoSelecionado.quantidade_atual + quantidade
      : tipoMov === 'saida'
        ? Math.max(0, insumoSelecionado.quantidade_atual - quantidade)
        : quantidade
    : 0

  // ── Tela de migration pendente ────────────────────────────
  if (!loading && !tabelaExiste) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="card p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}>
            <Package className="w-8 h-8" style={{ color: S.accent }} />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl" style={{ color: S.main }}>
              Configure o Estoque
            </h2>
            <p className="text-sm mt-2" style={{ color: S.muted }}>
              Para usar o controle de estoque de insumos (Queijo, Batata Palha, Óleo, etc.),
              você precisa executar a migration no Supabase.
            </p>
          </div>

          <div className="p-4 rounded-xl text-left space-y-3"
            style={{ backgroundColor: S.bg, border: `1px solid ${S.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: S.muted }}>
              1. Acesse o SQL Editor do Supabase
            </p>
            <p className="text-xs" style={{ color: S.muted }}>
              supabase.com → Seu projeto → SQL Editor
            </p>
            <p className="text-xs font-bold uppercase tracking-wider mt-3" style={{ color: S.muted }}>
              2. Execute o seguinte SQL:
            </p>
            <pre className="text-xs p-3 rounded-lg overflow-x-auto"
              style={{ backgroundColor: S.card, color: S.accent, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
{`CREATE TABLE insumos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',
  quantidade_atual DECIMAL(10,3) NOT NULL DEFAULT 0,
  quantidade_minima DECIMAL(10,3) NOT NULL DEFAULT 0,
  preco_custo DECIMAL(10,2) DEFAULT 0,
  fornecedor VARCHAR(200),
  codigo_interno VARCHAR(50),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE insumo_movimentacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE,
  tipo tipo_movimentacao NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL,
  quantidade_anterior DECIMAL(10,3),
  quantidade_posterior DECIMAL(10,3),
  usuario_id UUID REFERENCES usuarios(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_insumos" ON insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_insumo_mov" ON insumo_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);`}
            </pre>
          </div>

          <button onClick={carregar} className="btn-primary px-6 py-3 mx-auto">
            <RefreshCw className="w-4 h-4" />
            Verificar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: S.main }}>
            Estoque
          </h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            Ingredientes e insumos da cozinha — {stats.total} itens
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="p-2.5 rounded-lg transition-colors"
            style={{ backgroundColor: S.card, color: S.muted }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowBalanco(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: S.card, color: S.main, border: `1px solid ${S.border}` }}
          >
            <Printer className="w-4 h-4" style={{ color: S.accent }} />
            <span className="hidden sm:inline">Balanço do Dia</span>
          </button>
          <button onClick={abrirNovo} className="btn-primary px-4 py-2.5 text-sm">
            <PackagePlus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Insumo</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* ── ALERTAS ── */}
      {(stats.baixo > 0 || stats.zerado > 0) && (
        <div className="space-y-2">
          {stats.zerado > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl"
              style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: `1px solid rgba(248,113,113,0.2)` }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: S.red }} />
              <p className="text-sm font-semibold" style={{ color: S.red }}>
                🚨 {stats.zerado} insumo{stats.zerado > 1 ? 's' : ''} zerado{stats.zerado > 1 ? 's' : ''} — reabastecer urgente!
              </p>
            </div>
          )}
          {stats.baixo > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl"
              style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: `1px solid rgba(251,191,36,0.2)` }}>
              <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: S.yellow }} />
              <p className="text-sm font-semibold" style={{ color: S.yellow }}>
                ⚠ {stats.baixo} insumo{stats.baixo > 1 ? 's' : ''} abaixo do estoque mínimo
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',   value: stats.total,  color: S.blue,   emoji: '📦' },
          { label: 'OK',      value: stats.ok,     color: S.green,  emoji: '✅' },
          { label: 'Baixo',   value: stats.baixo,  color: S.yellow, emoji: '⚠️' },
          { label: 'Zerado',  value: stats.zerado, color: S.red,    emoji: '🚨' },
        ].map(s => (
          <div key={s.label} className="card p-3 lg:p-4 text-center">
            <p className="text-lg lg:hidden">{s.emoji}</p>
            <p className="font-display font-bold text-xl lg:text-2xl leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] lg:text-[11px] uppercase tracking-wider font-semibold mt-1" style={{ color: S.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.muted }} />
          <input type="text" placeholder="Queijo, Batata, Óleo..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="input pl-9"
          />
        </div>
        {(['todos', 'baixo', 'zerado'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className="px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all flex-shrink-0"
            style={{
              backgroundColor: filtro === f ? S.accent : S.card,
              color: filtro === f ? '#fff' : S.muted,
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Lista de insumos */}
        <div className="lg:col-span-3 space-y-2">
          {loading ? (
            [...Array(6)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)
          ) : insumosFiltrados.length === 0 ? (
            <div className="text-center py-16 card rounded-xl space-y-4" style={{ color: S.muted }}>
              <div className="text-5xl">🏭</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: S.main }}>Nenhum insumo encontrado</p>
                {insumos.length === 0 && (
                  <p className="text-xs mt-1.5 opacity-70">
                    Cadastre os ingredientes usados na cozinha: Queijo, Batata Palha, Óleo, Farinha...
                  </p>
                )}
              </div>
              {insumos.length === 0 && (
                <button onClick={abrirNovo} className="btn-primary px-6 py-2.5 text-sm mx-auto">
                  <PackagePlus className="w-4 h-4" />
                  Cadastrar primeiro insumo
                </button>
              )}
            </div>
          ) : insumosFiltrados.map(ins => {
            const status = ins.quantidade_atual === 0 ? 'zerado'
              : ins.quantidade_atual <= ins.quantidade_minima ? 'baixo' : 'ok'
            const statusColor = status === 'zerado' ? S.red : status === 'baixo' ? S.yellow : S.green
            const pct = ins.quantidade_minima > 0
              ? Math.min(100, (ins.quantidade_atual / ins.quantidade_minima) * 100)
              : 100

            return (
              <div key={ins.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{ backgroundColor: S.card, border: `1px solid ${S.border}` }}>

                <div className="flex items-center gap-3 p-4">
                  {/* Emoji */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: 'rgba(249,115,22,0.07)' }}>
                    {iconeInsumo(ins.nome)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate" style={{ color: S.main }}>{ins.nome}</p>
                      {status !== 'ok' && (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
                          {status === 'zerado' ? '🚨 ZERADO' : '⚠ BAIXO'}
                        </span>
                      )}
                    </div>
                    {ins.fornecedor && (
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: S.muted }}>{ins.fornecedor}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="font-display font-bold text-base" style={{ color: statusColor }}>
                        {ins.quantidade_atual}
                      </span>
                      <span className="text-xs" style={{ color: S.muted }}>{ins.unidade}</span>
                      <span className="text-xs" style={{ color: S.muted }}>
                        · mín: {ins.quantidade_minima} {ins.unidade}
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => abrirMovimentacao(ins, 'entrada')} title="Entrada"
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                      style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: S.green }}>
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => abrirMovimentacao(ins, 'saida')} title="Saída"
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                      style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: S.red }}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={() => abrirEdicao(ins)} title="Editar"
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                      style={{ backgroundColor: S.cardH, color: S.muted }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeletando(ins); setShowDeleteModal(true) }} title="Remover"
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                      style={{ backgroundColor: 'rgba(248,113,113,0.08)', color: S.red }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Barra de progresso */}
                {ins.quantidade_minima > 0 && (
                  <div className="h-1 w-full" style={{ backgroundColor: S.bg }}>
                    <div className="h-1 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: statusColor,
                        opacity: 0.7,
                      }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Histórico de movimentações */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" style={{ color: S.accent }} />
              <h2 className="font-display font-semibold text-sm" style={{ color: S.main }}>Histórico</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.muted }}>
              últimos 50
            </span>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {movimentacoes.length === 0 ? (
              <div className="text-center py-10">
                <History className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: S.muted }} />
                <p className="text-xs" style={{ color: S.muted }}>Nenhuma movimentação ainda</p>
              </div>
            ) : movimentacoes.map(mov => {
              const color = mov.tipo === 'entrada' ? S.green : mov.tipo === 'saida' ? S.red : S.blue
              const Icon = mov.tipo === 'entrada' ? ArrowUpRight : mov.tipo === 'saida' ? ArrowDownRight : BarChart3
              const label = mov.tipo === 'entrada' ? '+' : mov.tipo === 'saida' ? '-' : '~'
              return (
                <div key={mov.id} className="flex items-start gap-2.5 pb-3"
                  style={{ borderBottom: `1px solid ${S.border}` }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${color}14` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold truncate" style={{ color: S.main }}>
                        {(mov.insumo as any)?.nome || '—'}
                      </p>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color }}>
                        {label}{mov.quantidade} {(mov.insumo as any)?.unidade || 'un'}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>
                      {mov.quantidade_anterior} → {mov.quantidade_posterior} · {(mov.usuario as any)?.nome || 'sistema'}
                    </p>
                    {mov.observacao && (
                      <p className="text-[10px] italic truncate mt-0.5" style={{ color: S.muted }}>
                        "{mov.observacao}"
                      </p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>
                      {formatDateTime(mov.criado_em)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL — CADASTRAR / EDITAR INSUMO
      ══════════════════════════════════════════════════ */}
      {showCadModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-end lg:items-center justify-center animate-fade-in">
          <div className="w-full lg:max-w-lg max-h-[92vh] overflow-y-auto"
            style={{ backgroundColor: S.card, borderRadius: '20px 20px 0 0' }}>

            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>

            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-xl" style={{ color: S.main }}>
                    {editando ? '✏️ Editar Insumo' : '📦 Novo Insumo'}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: S.muted }}>
                    {editando
                      ? 'Atualize as informações do ingrediente'
                      : 'Cadastre um ingrediente ou material da cozinha'}
                  </p>
                </div>
                <button onClick={() => setShowCadModal(false)} className="p-2 rounded-lg flex-shrink-0"
                  style={{ color: S.muted, backgroundColor: S.cardH }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nome */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Nome do Insumo *
                </label>
                <input
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Queijo Mussarela, Batata Palha, Óleo de Soja..."
                  className="input text-base"
                  autoFocus
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Descrição / Marca (opcional)
                </label>
                <input
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  placeholder="Ex: Mussarela tipo 1, Marca X..."
                  className="input"
                />
              </div>

              {/* Fornecedor */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Fornecedor (opcional)
                </label>
                <input
                  value={formFornecedor}
                  onChange={e => setFormFornecedor(e.target.value)}
                  placeholder="Ex: Laticínios do Sul, Atacadão..."
                  className="input"
                />
              </div>

              {/* Unidade de medida */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                  Unidade de Medida
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNIDADES.map(u => (
                    <button key={u} onClick={() => setFormUnidade(u)}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                      style={{
                        backgroundColor: formUnidade === u ? S.accent : S.cardH,
                        color: formUnidade === u ? '#fff' : S.muted,
                        border: `1.5px solid ${formUnidade === u ? S.accent : S.border}`,
                      }}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantidade Atual (só no cadastro) */}
              {!editando && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                    Quantidade Atual ({formUnidade})
                  </label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setFormQtdAtual(Math.max(0, formQtdAtual - 1))}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: S.cardH, color: S.main }}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <input type="number" min="0" step="0.1" value={formQtdAtual}
                      onChange={e => setFormQtdAtual(Math.max(0, Number(e.target.value)))}
                      className="input flex-1 text-center font-display font-bold text-2xl" />
                    <button onClick={() => setFormQtdAtual(formQtdAtual + 1)}
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: S.accent }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Quantidade Mínima */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1 block" style={{ color: S.muted }}>
                  Estoque Mínimo ({formUnidade})
                </label>
                <p className="text-[11px] mb-2" style={{ color: S.muted }}>
                  Abaixo disso o sistema vai alertar que precisa repor
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFormQtdMinima(Math.max(0, formQtdMinima - 1))}
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: S.cardH, color: S.main }}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <input type="number" min="0" step="0.1" value={formQtdMinima}
                    onChange={e => setFormQtdMinima(Math.max(0, Number(e.target.value)))}
                    className="input flex-1 text-center font-display font-bold text-2xl" />
                  <button onClick={() => setFormQtdMinima(formQtdMinima + 1)}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: S.accent }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Botão */}
              <button onClick={salvarCadastro} disabled={salvandoCad || !formNome.trim()}
                className="btn-primary w-full py-4 text-base">
                {salvandoCad ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {editando ? 'Salvar Alterações' : 'Cadastrar Insumo'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════════════════════════════════
          MODAL — MOVIMENTAÇÃO
      ══════════════════════════════════════════════════ */}
      {showMovModal && insumoSelecionado && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-end lg:items-center justify-center animate-fade-in">
          <div className="w-full lg:max-w-md max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: S.card, borderRadius: '20px 20px 0 0' }}>

            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>
                    Movimentar Estoque
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                    Registre entrada, saída ou ajuste
                  </p>
                </div>
                <button onClick={() => setShowMovModal(false)} className="p-2 rounded-lg"
                  style={{ color: S.muted, backgroundColor: S.cardH }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Insumo selecionado */}
              <div className="flex items-center gap-3 p-4 rounded-xl"
                style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: `1px solid rgba(249,115,22,0.15)` }}>
                <div className="text-3xl">{iconeInsumo(insumoSelecionado.nome)}</div>
                <div>
                  <p className="font-bold text-base" style={{ color: S.main }}>{insumoSelecionado.nome}</p>
                  <p className="text-sm mt-0.5" style={{ color: S.muted }}>
                    Atual: <strong style={{ color: S.main }}>
                      {insumoSelecionado.quantidade_atual} {insumoSelecionado.unidade}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Tipo de movimentação */}
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_MOV.map(t => {
                  const Icon = t.icon
                  const sel = tipoMov === t.id
                  return (
                    <button key={t.id} onClick={() => setTipoMov(t.id as TipoMovimento)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                      style={{
                        backgroundColor: sel ? `${t.color}14` : S.cardH,
                        border: `2px solid ${sel ? t.color : S.border}`,
                      }}>
                      <Icon className="w-5 h-5" style={{ color: sel ? t.color : S.muted }} />
                      <span className="text-xs font-bold" style={{ color: sel ? t.color : S.muted }}>
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Quantidade */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                  {tipoMov === 'ajuste' ? `Novo valor (${insumoSelecionado.unidade})` : `Quantidade (${insumoSelecionado.unidade})`}
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantidade(Math.max(0, quantidade - 1))}
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: S.cardH, color: S.main }}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <input type="number" min="0" step="0.1" value={quantidade}
                    onChange={e => setQuantidade(Math.max(0, Number(e.target.value)))}
                    className="input flex-1 text-center font-display font-bold text-2xl" />
                  <button onClick={() => setQuantidade(quantidade + 1)}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: S.accent }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Observação (opcional)
                </label>
                <input value={observacao} onChange={e => setObservacao(e.target.value)}
                  placeholder="Ex: Compra do atacadão, validade 12/2026..." className="input" />
              </div>

              {/* Resultado preview */}
              {tipoMov !== 'ajuste' && (
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ backgroundColor: S.bg, border: `1px solid ${S.border}` }}>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: S.muted }}>Resultado</p>
                    <p className="text-sm mt-1" style={{ color: S.muted }}>
                      {insumoSelecionado.quantidade_atual} {insumoSelecionado.unidade} →
                    </p>
                  </div>
                  <p className="font-display font-bold text-2xl"
                    style={{ color: resultadoMov <= insumoSelecionado.quantidade_minima ? S.yellow : S.green }}>
                    {resultadoMov} {insumoSelecionado.unidade}
                  </p>
                </div>
              )}

              <button onClick={registrarMovimento} disabled={salvandoMov || quantidade <= 0}
                className="btn-primary w-full py-4 text-base">
                {salvandoMov ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Registrar {tipoMov === 'entrada' ? 'Entrada' : tipoMov === 'saida' ? 'Saída' : 'Ajuste'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════════════════════════════════
          MODAL — CONFIRMAR EXCLUSÃO
      ══════════════════════════════════════════════════ */}
      {showDeleteModal && deletando && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center animate-fade-in px-4">
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: S.card }}>
            <div className="text-4xl text-center">{iconeInsumo(deletando.nome)}</div>
            <div className="text-center">
              <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>Remover do Estoque?</h3>
              <p className="text-sm mt-1" style={{ color: S.muted }}>
                <strong style={{ color: S.main }}>{deletando.nome}</strong> será removido do controle.
                O histórico de movimentações será mantido.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletando(null) }}
                className="btn-secondary flex-1 py-3">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={excluindo}
                className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all"
                style={{ backgroundColor: S.red }}>
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL — BALANÇO DO DIA (com impressão)
      ══════════════════════════════════════════════════════════════ */}
      {showBalanco && (() => {
        const agora = new Date()
        const dataFormatada = agora.toLocaleDateString('pt-BR', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        })
        const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

        const zerados   = insumos.filter(i => i.quantidade_atual === 0)
        const baixos    = insumos.filter(i => i.quantidade_atual > 0 && i.quantidade_atual <= i.quantidade_minima)
        const okItems   = insumos.filter(i => i.quantidade_atual > i.quantidade_minima)

        const precisaComprar = [...zerados, ...baixos]

        if (typeof document === 'undefined') return null

        return createPortal(
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-start justify-center overflow-y-auto py-4 px-2 animate-fade-in">
            {/* Estilos de impressão inline */}
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                #balanco-print, #balanco-print * { visibility: visible !important; }
                #balanco-print {
                  position: fixed !important;
                  top: 0 !important; left: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  font-family: Arial, sans-serif !important;
                  padding: 20px !important;
                  font-size: 12pt !important;
                }
                .no-print { display: none !important; }
              }
            `}</style>

            <div id="balanco-print" className="w-full max-w-3xl rounded-2xl overflow-hidden"
              style={{ backgroundColor: '#fff', color: '#111' }}>

              {/* ── CABEÇALHO IMPRIMÍVEL ── */}
              <div className="p-6 border-b-2 border-gray-200"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="font-black text-2xl text-white tracking-tight">
                      🥟 IMPÉRIO PASTÉIS
                    </h1>
                    <p className="text-orange-100 text-sm font-semibold mt-1">
                      Balanço Diário de Estoque
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm capitalize">{dataFormatada}</p>
                    <p className="text-orange-100 text-sm">Gerado às {horaFormatada}</p>
                  </div>
                </div>

                {/* Resumo rápido */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { label: '✅ OK',      value: okItems.length,  bg: 'rgba(255,255,255,0.15)' },
                    { label: '⚠️ Baixo',   value: baixos.length,   bg: 'rgba(251,191,36,0.3)'  },
                    { label: '🚨 Zerado',  value: zerados.length,  bg: 'rgba(248,113,113,0.3)' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                      <p className="text-white font-black text-2xl">{s.value}</p>
                      <p className="text-orange-100 text-xs font-bold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-6" style={{ backgroundColor: '#fff' }}>

                {/* ── LISTA DE COMPRAS (PRIORITÁRIA) ── */}
                {precisaComprar.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingBag className="w-5 h-5 text-red-500" />
                      <h2 className="font-black text-lg text-gray-900">
                        Lista de Compras — {precisaComprar.length} iten{precisaComprar.length !== 1 ? 's' : ''}
                      </h2>
                    </div>

                    <div className="rounded-xl overflow-hidden border-2 border-red-200">
                      {/* Cabeçalho tabela */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
                        style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                        <div className="col-span-1"></div>
                        <div className="col-span-4">Insumo</div>
                        <div className="col-span-2 text-center">Atual</div>
                        <div className="col-span-2 text-center">Mínimo</div>
                        <div className="col-span-2 text-center">Comprar</div>
                        <div className="col-span-1 text-center">✓</div>
                      </div>

                      {/* Zerados primeiro */}
                      {zerados.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest"
                            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                            🚨 ZERADO — URGENTE
                          </div>
                          {zerados.map((ins, idx) => {
                            const deficit = ins.quantidade_minima
                            return (
                              <div key={ins.id}
                                className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-t border-red-100"
                                style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fff7f7' }}>
                                <div className="col-span-1 text-xl">{iconeInsumo(ins.nome)}</div>
                                <div className="col-span-4">
                                  <p className="font-bold text-sm text-gray-900">{ins.nome}</p>
                                  {ins.fornecedor && (
                                    <p className="text-[10px] text-gray-400">{ins.fornecedor}</p>
                                  )}
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="font-black text-red-600 text-sm">
                                    0 {ins.unidade}
                                  </span>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="text-sm text-gray-500">
                                    {ins.quantidade_minima} {ins.unidade}
                                  </span>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="font-black text-sm px-2 py-0.5 rounded-lg"
                                    style={{ backgroundColor: '#fecaca', color: '#991b1b' }}>
                                    +{deficit} {ins.unidade}
                                  </span>
                                </div>
                                <div className="col-span-1 text-center">
                                  <div className="w-5 h-5 border-2 border-gray-300 rounded mx-auto" />
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}

                      {/* Baixos */}
                      {baixos.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest"
                            style={{ backgroundColor: '#fffbeb', color: '#92400e' }}>
                            ⚠️ ABAIXO DO MÍNIMO
                          </div>
                          {baixos.map((ins, idx) => {
                            const deficit = Math.ceil(ins.quantidade_minima - ins.quantidade_atual)
                            return (
                              <div key={ins.id}
                                className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-t border-yellow-100"
                                style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fffdf0' }}>
                                <div className="col-span-1 text-xl">{iconeInsumo(ins.nome)}</div>
                                <div className="col-span-4">
                                  <p className="font-bold text-sm text-gray-900">{ins.nome}</p>
                                  {ins.fornecedor && (
                                    <p className="text-[10px] text-gray-400">{ins.fornecedor}</p>
                                  )}
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="font-bold text-sm text-yellow-700">
                                    {ins.quantidade_atual} {ins.unidade}
                                  </span>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="text-sm text-gray-500">
                                    {ins.quantidade_minima} {ins.unidade}
                                  </span>
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="font-bold text-sm px-2 py-0.5 rounded-lg"
                                    style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                                    +{deficit} {ins.unidade}
                                  </span>
                                </div>
                                <div className="col-span-1 text-center">
                                  <div className="w-5 h-5 border-2 border-gray-300 rounded mx-auto" />
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── ESTOQUE COMPLETO ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ClipboardList className="w-5 h-5 text-gray-500" />
                    <h2 className="font-black text-lg text-gray-900">
                      Situação Completa do Estoque
                    </h2>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-gray-200">
                    {/* Cabeçalho */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
                      style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      <div className="col-span-1"></div>
                      <div className="col-span-5">Insumo</div>
                      <div className="col-span-2 text-center">Qtd Atual</div>
                      <div className="col-span-2 text-center">Mínimo</div>
                      <div className="col-span-2 text-center">Status</div>
                    </div>

                    {insumos.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        Nenhum insumo cadastrado
                      </div>
                    ) : insumos.map((ins, idx) => {
                      const status = ins.quantidade_atual === 0 ? 'zerado'
                        : ins.quantidade_atual <= ins.quantidade_minima ? 'baixo' : 'ok'
                      const statusConfig = {
                        ok:     { label: '✅ OK',      bg: '#f0fdf4', text: '#166534', rowBg: idx % 2 === 0 ? '#fff' : '#f9fafb' },
                        baixo:  { label: '⚠️ Baixo',   bg: '#fef9c3', text: '#854d0e', rowBg: idx % 2 === 0 ? '#fff' : '#fffdf0' },
                        zerado: { label: '🚨 Zerado',  bg: '#fee2e2', text: '#991b1b', rowBg: idx % 2 === 0 ? '#fff' : '#fff7f7' },
                      }[status]

                      return (
                        <div key={ins.id}
                          className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-t border-gray-100"
                          style={{ backgroundColor: statusConfig.rowBg }}>
                          <div className="col-span-1 text-lg">{iconeInsumo(ins.nome)}</div>
                          <div className="col-span-5">
                            <p className="font-semibold text-sm text-gray-900">{ins.nome}</p>
                            {ins.descricao && (
                              <p className="text-[10px] text-gray-400">{ins.descricao}</p>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="font-bold text-sm text-gray-800">
                              {ins.quantidade_atual} {ins.unidade}
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-sm text-gray-500">
                              {ins.quantidade_minima} {ins.unidade}
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                              style={{ backgroundColor: statusConfig.bg, color: statusConfig.text }}>
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rodapé imprimível */}
                <div className="border-t-2 border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <p>Sistema Império Pastéis — Balanço gerado em {dataFormatada} às {horaFormatada}</p>
                    <p>Conferido por: ___________________</p>
                  </div>
                  <div className="mt-3 p-3 rounded-lg text-xs text-gray-500 bg-gray-50">
                    <strong>Observações:</strong>{' '}
                    <span className="inline-block w-full border-b border-gray-300 mt-1">
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </span>
                  </div>
                </div>

                {/* Botões de ação (não imprimem) */}
                <div className="no-print space-y-3 mt-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowBalanco(false)}
                      className="btn-secondary flex-1 py-3"
                    >
                      <X className="w-4 h-4" />
                      Fechar
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="btn-primary flex-1 py-3"
                      style={{ backgroundColor: '#f97316' }}
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir (A4)
                    </button>
                  </div>

                  {impressoras.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                      <p className="text-xs text-gray-500 font-semibold text-center uppercase tracking-widest">
                        Imprimir na Térmica
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {impressoras.map(imp => (
                          <button
                            key={imp.id}
                            onClick={() => enviarParaTermica(imp)}
                            disabled={imprimindoTermica}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold transition-colors disabled:opacity-50"
                          >
                            {imprimindoTermica ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 text-gray-500" />}
                            {imp.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        , document.body)
      })()}
    </div>
  )
}
