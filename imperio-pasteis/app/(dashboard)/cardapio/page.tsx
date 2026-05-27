'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Produto, Categoria } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Search, Edit2, Trash2, X, Loader2,
  Package, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

const S = {
  bg: 'var(--color-surface-bg)', card: 'var(--color-surface-card)',
  cardH: 'var(--color-surface-card-hover)', border: 'var(--color-surface-border)',
  main: 'var(--color-text-main)', sub: 'var(--color-text-sub)', muted: 'var(--color-text-muted)',
  accent: 'var(--color-brand-accent)', green: 'var(--color-status-free)',
  red: 'var(--color-status-busy)', yellow: 'var(--color-status-wait)',
}

const FORM_INICIAL = {
  nome: '', descricao: '', categoria_id: '', preco_venda: '', preco_custo: '',
  estoque_atual: '0', estoque_minimo: '5', controlar_estoque: false,
  enviar_para_producao: true, tempo_preparo_min: '10', codigo_interno: '', ativo: true,
}

const EMOJIS = ['🍽️','🥟','🍕','🍔','🌭','🍦','☕','🥤','🍺','🍹','🧃','🍰','🥗','🍤','🌮']

export default function CardapioPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [showFormCat, setShowFormCat] = useState(false)
  const [nomeCategoria, setNomeCategoria] = useState('')
  const [iconeCategoria, setIconeCategoria] = useState('🍽️')

  const carregar = useCallback(async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('*, categoria:categorias(*)').order('nome'),
      supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
    ])
    if (prods) setProdutos(prods)
    if (cats) setCategorias(cats)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirEditar(produto: Produto) {
    setEditando(produto)
    setForm({
      nome: produto.nome, descricao: produto.descricao || '',
      categoria_id: produto.categoria_id || '',
      preco_venda: produto.preco_venda.toString(), preco_custo: produto.preco_custo.toString(),
      estoque_atual: produto.estoque_atual.toString(), estoque_minimo: produto.estoque_minimo.toString(),
      controlar_estoque: produto.controlar_estoque, enviar_para_producao: produto.enviar_para_producao,
      tempo_preparo_min: produto.tempo_preparo_min.toString(), codigo_interno: produto.codigo_interno || '',
      ativo: produto.ativo,
    })
    setShowForm(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.preco_venda) { toast.error('Nome e preço são obrigatórios'); return }
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(), descricao: form.descricao || null,
        categoria_id: form.categoria_id || null,
        preco_venda: parseFloat(form.preco_venda), preco_custo: parseFloat(form.preco_custo || '0'),
        estoque_atual: parseInt(form.estoque_atual || '0'), estoque_minimo: parseInt(form.estoque_minimo || '0'),
        controlar_estoque: form.controlar_estoque, enviar_para_producao: form.enviar_para_producao,
        tempo_preparo_min: parseInt(form.tempo_preparo_min || '10'),
        codigo_interno: form.codigo_interno || null, ativo: form.ativo,
      }
      if (editando) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('✅ Produto atualizado!')
      } else {
        const { error } = await supabase.from('produtos').insert(payload)
        if (error) throw error
        toast.success('✅ Produto criado!')
      }
      setShowForm(false); carregar()
    } catch (err: any) { toast.error(`Erro: ${err.message}`) }
    finally { setSalvando(false) }
  }

  async function toggleAtivo(produto: Produto) {
    await supabase.from('produtos').update({ ativo: !produto.ativo }).eq('id', produto.id)
    toast.success(produto.ativo ? 'Produto desativado' : 'Produto ativado')
    carregar()
  }

  async function excluir(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"?`)) return
    await supabase.from('produtos').delete().eq('id', produto.id)
    toast.success('Produto excluído')
    carregar()
  }

  async function salvarCategoria() {
    if (!nomeCategoria.trim()) return
    const { error } = await supabase.from('categorias').insert({
      nome: nomeCategoria.trim(), icone: iconeCategoria, ordem: categorias.length + 1,
    })
    if (error) { toast.error('Erro ao criar categoria'); return }
    toast.success('Categoria criada!')
    setNomeCategoria(''); setShowFormCat(false); carregar()
  }

  const produtosFiltrados = produtos.filter(p => {
    const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchCat = categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro
    return matchBusca && matchCat
  })

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in max-w-5xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: S.main }}>Cardápio</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            {produtos.filter(p => p.ativo).length} produtos ativos
          </p>
        </div>
        <button onClick={() => { setEditando(null); setForm(FORM_INICIAL); setShowForm(true) }} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Produto</span>
        </button>
      </div>

      {/* ── FILTRO DE CATEGORIAS ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        <button
          onClick={() => setCategoriaFiltro('todas')}
          className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
          style={{
            backgroundColor: categoriaFiltro === 'todas' ? S.accent : S.card,
            color: categoriaFiltro === 'todas' ? '#fff' : S.muted,
          }}
        >
          🍽️ Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoriaFiltro(cat.id)}
            className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              backgroundColor: categoriaFiltro === cat.id ? S.accent : S.card,
              color: categoriaFiltro === cat.id ? '#fff' : S.muted,
            }}
          >
            {cat.icone} {cat.nome}
          </button>
        ))}
        <button
          onClick={() => setShowFormCat(!showFormCat)}
          className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
          style={{
            backgroundColor: 'transparent',
            border: `1.5px dashed ${S.border}`,
            color: S.muted,
          }}
        >
          + Categoria
        </button>
      </div>

      {/* Form nova categoria */}
      {showFormCat && (
        <div className="card p-4 space-y-3 animate-fade-in">
          <p className="text-sm font-bold" style={{ color: S.main }}>Nova Categoria</p>
          <div className="flex gap-1.5 flex-wrap">
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setIconeCategoria(e)}
                className="w-9 h-9 rounded-lg text-lg transition-all"
                style={{
                  backgroundColor: iconeCategoria === e ? 'rgba(249,115,22,0.15)' : S.cardH,
                  outline: iconeCategoria === e ? `2px solid ${S.accent}` : 'none',
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={nomeCategoria} onChange={e => setNomeCategoria(e.target.value)}
              placeholder="Nome da categoria..." className="input flex-1"
            />
            <button onClick={salvarCategoria} className="btn-primary px-4">Criar</button>
            <button
              onClick={() => setShowFormCat(false)}
              className="p-2.5 rounded-lg" style={{ backgroundColor: S.cardH, color: S.muted }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── BUSCA ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.muted }} />
        <input
          type="text" placeholder="Buscar produto..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* ── LISTA DE PRODUTOS ── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 skeleton" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {produtosFiltrados.map(produto => (
            <div
              key={produto.id}
              className="flex items-center gap-4 p-4 rounded-lg transition-all"
              style={{
                backgroundColor: S.card,
                opacity: produto.ativo ? 1 : 0.5,
              }}
            >
              {/* Ícone */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}
              >
                {(produto as any).categoria?.icone || '🍽️'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate" style={{ color: S.main }}>{produto.nome}</p>
                  {produto.controlar_estoque && produto.estoque_atual <= produto.estoque_minimo && (
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: S.red }} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-bold text-sm" style={{ color: S.accent }}>
                    {formatCurrency(produto.preco_venda)}
                  </span>
                  <span className="text-xs" style={{ color: S.muted }}>
                    {(produto as any).categoria?.nome || 'Sem categoria'}
                  </span>
                  {produto.controlar_estoque && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: produto.estoque_atual > produto.estoque_minimo
                          ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                        color: produto.estoque_atual > produto.estoque_minimo ? S.green : S.red,
                      }}
                    >
                      Estoque: {produto.estoque_atual}
                    </span>
                  )}
                  {produto.enviar_para_producao && (
                    <span className="badge" style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: 'var(--color-status-prep)' }}>
                      Produção
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleAtivo(produto)}
                  className="p-2 rounded-lg transition-all"
                  style={{ color: produto.ativo ? S.green : S.muted }}
                >
                  {produto.ativo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => abrirEditar(produto)}
                  className="p-2 rounded-lg transition-all"
                  style={{ color: 'var(--color-status-prep)' }}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => excluir(produto)}
                  className="p-2 rounded-lg transition-all"
                  style={{ color: S.red }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {produtosFiltrados.length === 0 && (
            <div className="text-center py-14" style={{ color: S.muted }}>
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL PRODUTO ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center animate-fade-in">
          <div
            className="w-full lg:max-w-2xl max-h-[95vh] overflow-y-auto"
            style={{ backgroundColor: S.card, borderRadius: '12px 12px 0 0' }}
          >
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg" style={{ color: S.main }}>
                  {editando ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-lg" style={{ color: S.muted, backgroundColor: S.cardH }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <FormField label="Nome do produto *">
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Pastel de Carne" className="input"
                />
              </FormField>

              <FormField label="Descrição">
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição breve..." rows={2}
                  className="input resize-none"
                />
              </FormField>

              <FormField label="Categoria">
                <select
                  value={form.categoria_id}
                  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                  className="input"
                  style={{ backgroundColor: S.card }}
                >
                  <option value="">Sem categoria</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icone} {cat.nome}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Preço de Venda *">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: S.muted }}>R$</span>
                    <input
                      type="number" step="0.01" min="0" value={form.preco_venda}
                      onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))}
                      className="input pl-9"
                    />
                  </div>
                </FormField>
                <FormField label="Preço de Custo">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: S.muted }}>R$</span>
                    <input
                      type="number" step="0.01" min="0" value={form.preco_custo}
                      onChange={e => setForm(f => ({ ...f, preco_custo: e.target.value }))}
                      className="input pl-9"
                    />
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Tempo de Preparo (min)">
                  <input
                    type="number" min="0" value={form.tempo_preparo_min}
                    onChange={e => setForm(f => ({ ...f, tempo_preparo_min: e.target.value }))}
                    className="input"
                  />
                </FormField>
                <FormField label="Código Interno">
                  <input
                    value={form.codigo_interno}
                    onChange={e => setForm(f => ({ ...f, codigo_interno: e.target.value }))}
                    placeholder="Ex: PAST-001" className="input"
                  />
                </FormField>
              </div>

              {/* Toggles */}
              <div className="p-4 rounded-lg space-y-3" style={{ backgroundColor: S.bg }}>
                <Toggle2 label="Enviar para produção" desc="Aparece no painel da cozinha"
                  value={form.enviar_para_producao} onChange={v => setForm(f => ({ ...f, enviar_para_producao: v }))} />
                <Toggle2 label="Controlar estoque" desc="Alerta quando estoque baixar"
                  value={form.controlar_estoque} onChange={v => setForm(f => ({ ...f, controlar_estoque: v }))} />
                <Toggle2 label="Produto ativo" desc="Aparece no cardápio"
                  value={form.ativo} onChange={v => setForm(f => ({ ...f, ativo: v }))} />
              </div>

              {form.controlar_estoque && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Estoque Atual">
                    <input type="number" min="0" value={form.estoque_atual}
                      onChange={e => setForm(f => ({ ...f, estoque_atual: e.target.value }))} className="input" />
                  </FormField>
                  <FormField label="Estoque Mínimo">
                    <input type="number" min="0" value={form.estoque_minimo}
                      onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} className="input" />
                  </FormField>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="btn-primary flex-1">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editando ? 'Salvar' : 'Criar Produto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Toggle2({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 transition-all rounded-full"
        style={{
          width: 44, height: 24,
          backgroundColor: value ? 'var(--color-brand-accent)' : 'var(--color-surface-border-light)',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  )
}
