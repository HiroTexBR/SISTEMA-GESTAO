'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Impressora, TesteImpressora } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import {
  Printer, Wifi, WifiOff, Send, CheckCircle2, XCircle,
  Loader2, Play, RefreshCw, Settings, AlertCircle, Clock,
  Monitor, Radio, FileText, Scissors, Type, AlignLeft, Zap
} from 'lucide-react'
import { toast } from 'sonner'

// Preview do cupom simulado
const CUPOM_PREVIEW = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       TESTE DE IMPRESSÃO
       IMPÉRIO PASTÉIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPRESSORA: PRODUÇÃO
LARGURA: 80MM
CONEXÃO: ETHERNET
IP: 192.168.0.100
PORTA: 9100

Se você está lendo isso,
a impressora está funcionando!

Texto normal: OK
NEGRITO: OK
Alinhamento centro: OK
Acentuação: àáâãäåæ OK
Corte automático: [CORTE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA/HORA: {datetime}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

const TIPOS_TESTE = [
  { id: 'teste_simples', label: 'Teste Simples', icon: FileText, desc: 'Texto básico' },
  { id: 'teste_completo', label: 'Teste Completo', icon: Printer, desc: 'Todos os recursos' },
  { id: 'pedido_producao', label: 'Pedido de Produção', icon: Monitor, desc: 'Simula um pedido' },
  { id: 'recibo_final', label: 'Recibo do Caixa', icon: FileText, desc: 'Simula um recibo' },
  { id: 'teste_corte', label: 'Corte Automático', icon: Scissors, desc: 'Testa o corte' },
  { id: 'teste_acentuacao', label: 'Acentuação', icon: Type, desc: 'Testa caracteres PT' },
  { id: 'teste_largura', label: 'Largura 80mm', icon: AlignLeft, desc: 'Testa largura' },
]

const STATUS_BOTAO = {
  idle: { label: '🖨️ Enviar Teste', cls: 'from-orange-500 to-orange-600' },
  enviando: { label: 'Enviando...', cls: 'from-amber-500 to-amber-600' },
  fila: { label: 'Na fila...', cls: 'from-blue-500 to-blue-600' },
  imprimindo: { label: 'Imprimindo...', cls: 'from-purple-500 to-purple-600' },
  sucesso: { label: '✅ Enviado com sucesso!', cls: 'from-emerald-500 to-emerald-600' },
  erro: { label: '❌ Falha ao enviar', cls: 'from-red-500 to-red-600' },
}

export default function TesteImpressaoPage() {
  const supabase = createClient()
  const [impressoras, setImpressoras] = useState<Impressora[]>([])
  const [impressoraSelecionada, setImpressoraSelecionada] = useState<Impressora | null>(null)
  const [modo, setModo] = useState<'simulacao' | 'real'>('simulacao')
  const [tipoTeste, setTipoTeste] = useState('teste_completo')
  const [historico, setHistorico] = useState<TesteImpressora[]>([])
  const [statusBotao, setStatusBotao] = useState<keyof typeof STATUS_BOTAO>('idle')
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(true)

  // Config da impressora
  const [ip, setIp] = useState('192.168.0.100')
  const [porta, setPorta] = useState(9100)
  const [largura, setLargura] = useState<'58mm' | '80mm'>('80mm')
  const [corteAuto, setCorteAuto] = useState(true)
  const [impressaoAuto, setImpressaoAuto] = useState(true)
  const [testingConexao, setTestingConexao] = useState(false)
  const [statusConexao, setStatusConexao] = useState<'idle' | 'ok' | 'erro'>('idle')

  const carregar = useCallback(async () => {
    const [{ data: imps }, { data: hist }] = await Promise.all([
      supabase.from('impressoras').select('*').eq('ativa', true).order('setor'),
      supabase.from('testes_impressora')
        .select('*, impressora:impressoras(nome), usuario:usuarios(nome)')
        .order('criado_em', { ascending: false })
        .limit(10),
    ])

    if (imps) {
      setImpressoras(imps)
      if (!impressoraSelecionada && imps.length > 0) {
        const prod = imps.find(i => i.setor === 'producao') || imps[0]
        setImpressoraSelecionada(prod)
        setIp(prod.endereco_ip || '192.168.0.100')
        setPorta(prod.porta || 9100)
        setLargura(prod.largura_papel || '80mm')
        setCorteAuto(prod.corte_automatico)
        setImpressaoAuto(prod.impressao_automatica)
      }
    }
    if (hist) setHistorico(hist)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    // Realtime na fila de impressão
    const channel = supabase
      .channel('fila-impressao-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_impressao' }, carregar)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [carregar])

  async function testarConexao() {
    if (!impressoraSelecionada || modo !== 'real') return
    setTestingConexao(true)
    setStatusConexao('idle')

    try {
      const res = await fetch('/api/impressao/testar-conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, porta }),
      })
      const data = await res.json()

      if (data.ok) {
        setStatusConexao('ok')
        toast.success('✅ Impressora conectada com sucesso!')
        // Atualizar status no banco
        await supabase.from('impressoras')
          .update({ status: 'online', endereco_ip: ip, porta })
          .eq('id', impressoraSelecionada.id)
      } else {
        setStatusConexao('erro')
        toast.error(`❌ Falha na conexão: ${data.erro || 'Impressora não responde'}`)
        await supabase.from('impressoras')
          .update({ status: 'offline', ultimo_erro: data.erro })
          .eq('id', impressoraSelecionada.id)
      }
    } catch {
      setStatusConexao('erro')
      toast.error('Erro ao verificar conexão. Verifique o gateway de impressão.')
    } finally {
      setTestingConexao(false)
    }
  }

  async function enviarTeste() {
    if (!impressoraSelecionada) {
      toast.error('Selecione uma impressora')
      return
    }

    setStatusBotao('enviando')
    setShowPreview(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const conteudo = gerarConteudoTeste(tipoTeste, impressoraSelecionada, ip, porta, largura)

      setStatusBotao('fila')

      // Criar entrada na fila de impressão
      const { data: filaItem } = await supabase.from('fila_impressao').insert({
        tipo_documento: tipoTeste,
        impressora_id: impressoraSelecionada.id,
        conteudo,
        status: 'pendente',
        modo_simulacao: modo === 'simulacao',
      }).select().single()

      // Registrar teste
      await supabase.from('testes_impressora').insert({
        impressora_id: impressoraSelecionada.id,
        usuario_id: user?.id,
        tipo_teste: tipoTeste,
        modo,
        resultado: 'pendente',
        conteudo_teste: conteudo,
        fila_impressao_id: filaItem?.id,
      })

      // Atualizar impressora
      await supabase.from('impressoras').update({
        ultimo_teste_em: new Date().toISOString(),
        impressao_automatica: impressaoAuto,
      }).eq('id', impressoraSelecionada.id)

      if (modo === 'simulacao') {
        // Simular fluxo
        setStatusBotao('imprimindo')
        await new Promise(r => setTimeout(r, 1500))

        await supabase.from('fila_impressao').update({ status: 'simulado' }).eq('id', filaItem?.id)
        await supabase.from('testes_impressora')
          .update({ resultado: 'sucesso' })
          .eq('fila_impressao_id', filaItem?.id)

        setStatusBotao('sucesso')
        toast.success('🖨️ Impressão simulada com sucesso!')
      } else {
        // Modo real — gateway processa
        setStatusBotao('imprimindo')
        toast.info('Aguardando o gateway de impressão...')

        // Verificar resultado após timeout
        setTimeout(async () => {
          const { data: filaAtual } = await supabase
            .from('fila_impressao').select('status').eq('id', filaItem?.id).single()

          if (filaAtual?.status === 'impresso') {
            setStatusBotao('sucesso')
            toast.success('✅ Teste impresso com sucesso!')
          } else if (filaAtual?.status === 'falhou') {
            setStatusBotao('erro')
            toast.error('❌ Falha na impressão')
          }
        }, 5000)
      }

      carregar()
    } catch (err) {
      setStatusBotao('erro')
      toast.error('Erro ao enviar teste de impressão')
    } finally {
      setTimeout(() => setStatusBotao('idle'), 4000)
    }
  }

  async function salvarImpressora() {
    if (!impressoraSelecionada) return
    const { error } = await supabase.from('impressoras').update({
      endereco_ip: ip,
      porta,
      largura_papel: largura,
      corte_automatico: corteAuto,
      impressao_automatica: impressaoAuto,
    }).eq('id', impressoraSelecionada.id)

    if (error) toast.error('Erro ao salvar')
    else toast.success('✅ Impressora salva!')
    carregar()
  }

  const btnConfig = STATUS_BOTAO[statusBotao]

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <Printer className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teste de Impressão</h1>
          <p className="text-sm text-gray-500">Configure e teste suas impressoras térmicas</p>
        </div>
        <button onClick={carregar} className="ml-auto p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel esquerdo — Config */}
        <div className="lg:col-span-1 space-y-4">

          {/* Seleção de impressora */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-500" />
              Impressora
            </h2>
            <div className="space-y-2">
              {impressoras.map(imp => (
                <button
                  key={imp.id}
                  onClick={() => {
                    setImpressoraSelecionada(imp)
                    setIp(imp.endereco_ip || '')
                    setPorta(imp.porta)
                    setLargura(imp.largura_papel)
                    setCorteAuto(imp.corte_automatico)
                    setImpressaoAuto(imp.impressao_automatica)
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    impressoraSelecionada?.id === imp.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    imp.status === 'online' ? 'bg-emerald-100' :
                    imp.status === 'offline' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <Printer className={`w-5 h-5 ${
                      imp.status === 'online' ? 'text-emerald-600' :
                      imp.status === 'offline' ? 'text-red-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{imp.nome}</p>
                    <p className="text-xs text-gray-500 capitalize">{imp.setor} · {imp.tipo_conexao}</p>
                  </div>
                  <StatusDot status={imp.status} />
                </button>
              ))}
              {impressoras.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma impressora cadastrada</p>
              )}
            </div>
          </div>

          {/* Configuração */}
          {impressoraSelecionada && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-orange-500" />
                Configuração
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Endereço IP</label>
                  <input value={ip} onChange={e => setIp(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="192.168.0.100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Porta</label>
                  <input type="number" value={porta} onChange={e => setPorta(Number(e.target.value))}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Largura do Papel</label>
                <div className="flex gap-2">
                  {(['58mm', '80mm'] as const).map(l => (
                    <button key={l} onClick={() => setLargura(l)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        largura === l ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <Toggle label="Corte Automático" icon={Scissors} value={corteAuto} onChange={setCorteAuto} />
                <Toggle label="Impressão Automática" icon={Zap} value={impressaoAuto} onChange={setImpressaoAuto} />
              </div>

              <div className="flex gap-2">
                <button onClick={salvarImpressora}
                  className="flex-1 bg-orange-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95">
                  Salvar
                </button>
                <button onClick={testarConexao} disabled={modo !== 'real' || testingConexao}
                  className="flex-1 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {testingConexao ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  {statusConexao === 'ok' ? '✅ OK' : statusConexao === 'erro' ? '❌ Erro' : 'Testar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Painel direito — Teste */}
        <div className="lg:col-span-2 space-y-4">

          {/* Modo */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Modo de Teste</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setModo('simulacao')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  modo === 'simulacao' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <Monitor className={`w-8 h-8 ${modo === 'simulacao' ? 'text-blue-500' : 'text-gray-400'}`} />
                <div className="text-center">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">Simulação</p>
                  <p className="text-xs text-gray-500">Sem impressora física</p>
                </div>
              </button>
              <button
                onClick={() => setModo('real')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  modo === 'real' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <Printer className={`w-8 h-8 ${modo === 'real' ? 'text-emerald-500' : 'text-gray-400'}`} />
                <div className="text-center">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">Impressora Real</p>
                  <p className="text-xs text-gray-500">Via IP/porta</p>
                </div>
              </button>
            </div>

            {modo === 'simulacao' && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💡 Modo simulação: a impressão será simulada na tela, sem necessidade de impressora física conectada.
                </p>
              </div>
            )}
          </div>

          {/* Tipo de teste */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Tipo de Teste</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {TIPOS_TESTE.map(t => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    onClick={() => setTipoTeste(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      tipoTeste === t.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${tipoTeste === t.id ? 'text-orange-500' : 'text-gray-400'}`} />
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">{t.label}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* BOTÃO PRINCIPAL: ENVIAR TESTE */}
          <button
            onClick={enviarTeste}
            disabled={statusBotao !== 'idle' || !impressoraSelecionada}
            className={`w-full bg-gradient-to-r ${btnConfig.cls} text-white font-black py-5 rounded-2xl shadow-xl text-xl transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-80 flex items-center justify-center gap-3`}
          >
            {(statusBotao === 'enviando' || statusBotao === 'fila' || statusBotao === 'imprimindo') ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : statusBotao === 'sucesso' ? (
              <CheckCircle2 className="w-7 h-7" />
            ) : statusBotao === 'erro' ? (
              <XCircle className="w-7 h-7" />
            ) : (
              <Send className="w-7 h-7" />
            )}
            {btnConfig.label}
          </button>

          {/* Preview do cupom */}
          {showPreview && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">Prévia do Cupom</h2>
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-medium">
                  {largura}
                </span>
              </div>
              <div className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-4 font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre border border-dashed border-gray-300 dark:border-gray-600 overflow-x-auto ${largura === '58mm' ? 'max-w-[280px]' : 'max-w-[380px]'} mx-auto`}>
                {CUPOM_PREVIEW.replace('{datetime}', new Date().toLocaleString('pt-BR'))}
              </div>
            </div>
          )}

          {/* Histórico de testes */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Histórico de Testes
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {historico.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum teste realizado ainda</p>
              ) : historico.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  {t.resultado === 'sucesso' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  ) : t.resultado === 'falhou' ? (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-amber-500 flex-shrink-0 animate-spin" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                      {(t.impressora as any)?.nome || 'Impressora'} · {t.tipo_teste.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {t.modo === 'simulacao' ? '💻 Simulação' : '🖨️ Real'} · {(t.usuario as any)?.nome}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400">{formatDateTime(t.criado_em)}</p>
                    {t.erro && (
                      <p className="text-[10px] text-red-500 truncate max-w-24">{t.erro}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const m: Record<string, string> = {
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
    erro: 'bg-amber-500',
    nao_configurada: 'bg-gray-400',
  }
  return <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m[status] || 'bg-gray-400'}`} />
}

function Toggle({ label, icon: Icon, value, onChange }: {
  label: string; icon: any; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5.5 rounded-full transition-colors ${value ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        style={{ height: '22px', width: '40px' }}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function gerarConteudoTeste(tipo: string, impressora: Impressora, ip: string, porta: number, largura: string): string {
  const dt = new Date().toLocaleString('pt-BR')
  const linha = largura === '80mm'
    ? '================================================'
    : '================================'

  const base = `
${linha}
      TESTE DE IMPRESSÃO
      IMPÉRIO PASTÉIS
${linha}

IMPRESSORA: ${impressora.nome.toUpperCase()}
SETOR: ${impressora.setor.toUpperCase()}
LARGURA: ${largura.toUpperCase()}
CONEXÃO: ${impressora.tipo_conexao.toUpperCase()}
IP: ${ip}
PORTA: ${porta}

Se você está lendo isso,
a impressora está funcionando!

${linha}
DATA/HORA: ${dt}
${linha}
`

  if (tipo === 'teste_acentuacao') return base + '\nÁÀÂÃÄ ÉÈÊË ÍÌÎÏ ÓÒÔÕÖ ÚÙÛÜ\nÇ ç Ñ ñ\n'
  if (tipo === 'teste_corte') return base + '\n[CORTE AUTOMÁTICO]\n'
  if (tipo === 'teste_largura') return base + '\n' + '1234567890'.repeat(8) + '\n'
  if (tipo === 'pedido_producao') return `
${linha}
        MESA 05
   COMANDA #000123
GARÇOM: João Silva
HORÁRIO: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
${linha}

2x Pastel de Carne
   OBS: Sem cebola

1x Coca-Cola 2L

1x Porção de Batata
   OBS: Bem frita

${linha}
  SETOR: PRODUÇÃO
  IMPRESSÃO AUTOMÁTICA
${linha}
`
  if (tipo === 'recibo_final') return `
${linha}
      IMPÉRIO PASTÉIS
        MESA 05
   COMANDA #000123
${linha}

2x Pastel de Carne - R$ 20,00
1x Coca-Cola 2L - R$ 15,00
1x Porção de Batata - R$ 18,00

${linha}
SUBTOTAL: R$ 53,00
TOTAL: R$ 53,00
PAGAMENTO: PIX

${linha}
  Obrigado pela preferência!
${linha}
`
  return base
}
