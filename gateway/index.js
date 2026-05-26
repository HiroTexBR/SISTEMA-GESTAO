/**
 * GATEWAY DE IMPRESSÃO — Sistema Império Pastéis
 * 
 * Este serviço Node.js monitora a fila de impressão no Supabase
 * e envia os comandos ESC/POS para as impressoras térmicas via TCP/IP.
 * 
 * INSTALAÇÃO:
 *   cd gateway
 *   npm install
 *   cp .env.example .env  (e preencher as variáveis)
 *   node index.js
 * 
 * REQUISITO: Rodar em um dispositivo na mesma rede local das impressoras.
 * Pode ser um Raspberry Pi, mini PC, ou qualquer computador/Android com Node.js.
 */

require('dotenv').config()
const net = require('net')
const { createClient } = require('@supabase/supabase-js')

// =====================================================
// Configuração
// =====================================================
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS ? parseInt(process.env.POLL_INTERVAL_MS) : 2000
const MAX_TENTATIVAS = 3

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log(`
╔══════════════════════════════════════════╗
║     GATEWAY DE IMPRESSÃO — v1.0.0       ║
║     Sistema Império Pastéis             ║
╚══════════════════════════════════════════╝
🔌 Conectado ao Supabase: ${SUPABASE_URL}
⏱️  Verificando fila a cada ${POLL_INTERVAL_MS}ms
`)

// =====================================================
// Loop principal — verifica fila a cada N ms
// =====================================================
let processando = false

async function verificarFila() {
  if (processando) return
  processando = true

  try {
    // Buscar itens pendentes
    const { data: itens, error } = await supabase
      .from('fila_impressao')
      .select('*, impressora:impressoras(*)')
      .eq('status', 'pendente')
      .eq('modo_simulacao', false)
      .lt('tentativas', MAX_TENTATIVAS)
      .is('proximo_retry_em', null)
      .order('criado_em', { ascending: true })
      .limit(5)

    if (error) {
      console.error('Erro ao consultar fila:', error.message)
      return
    }

    if (!itens || itens.length === 0) return

    console.log(`📋 ${itens.length} item(s) na fila para imprimir`)

    for (const item of itens) {
      await processarItem(item)
    }
  } catch (err) {
    console.error('Erro no loop principal:', err)
  } finally {
    processando = false
  }
}

// =====================================================
// Processar um item da fila
// =====================================================
async function processarItem(item) {
  const { id, impressora, conteudo, tentativas } = item

  if (!impressora) {
    await marcarFalha(id, 'Impressora não encontrada no banco')
    return
  }

  const { endereco_ip: ip, porta, largura_papel, corte_automatico } = impressora

  if (!ip || !porta) {
    await marcarFalha(id, 'IP ou porta da impressora não configurados')
    return
  }

  // Marcar como imprimindo
  await supabase.from('fila_impressao')
    .update({ status: 'imprimindo', processando_em: new Date().toISOString(), tentativas: tentativas + 1 })
    .eq('id', id)

  console.log(`🖨️  Imprimindo item ${id} → ${impressora.nome} (${ip}:${porta})`)

  try {
    await enviarParaImpressora(ip, porta, conteudo, corte_automatico)

    // Sucesso
    await supabase.from('fila_impressao')
      .update({ status: 'impresso', impresso_em: new Date().toISOString() })
      .eq('id', id)

    // Atualizar status do pedido de produção se aplicável
    if (item.pedido_producao_id) {
      await supabase.from('pedidos_producao')
        .update({ status_impressao: 'impresso' })
        .eq('id', item.pedido_producao_id)
    }

    console.log(`✅ Item ${id} impresso com sucesso!`)
  } catch (err) {
    const mensagemErro = err.message || 'Erro desconhecido'
    console.error(`❌ Falha ao imprimir item ${id}: ${mensagemErro}`)

    if (tentativas + 1 >= MAX_TENTATIVAS) {
      await marcarFalha(id, mensagemErro)
    } else {
      // Reagendar para retry em 30s
      const proximoRetry = new Date(Date.now() + 30000).toISOString()
      await supabase.from('fila_impressao')
        .update({
          status: 'pendente',
          erro: mensagemErro,
          proximo_retry_em: proximoRetry
        })
        .eq('id', id)
    }
  }
}

// =====================================================
// Enviar conteúdo para a impressora via TCP
// =====================================================
function enviarParaImpressora(ip, porta, conteudo, corteAutomatico) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const TIMEOUT = 8000

    socket.setTimeout(TIMEOUT)

    // Converter conteúdo para Buffer com encoding correto (CP850 para PT)
    const encoder = new TextEncoder()
    const dados = encoder.encode(conteudo + '\n')

    // Comandos ESC/POS
    const ESC = 0x1B
    const GS = 0x1D

    // Inicializar impressora
    const cmdInit = Buffer.from([ESC, 0x40])

    // Configurar charset para Latin-1 (acentos PT-BR)
    const cmdCharset = Buffer.from([ESC, 0x74, 0x02]) // Código de página CP850

    // Corte automático (se suportado)
    const cmdCorte = corteAutomatico
      ? Buffer.from([GS, 0x56, 0x42, 0x00]) // Corte parcial
      : Buffer.alloc(0)

    const payload = Buffer.concat([
      cmdInit,
      cmdCharset,
      Buffer.from(conteudo, 'latin1'),
      Buffer.from('\n\n\n'),
      cmdCorte,
    ])

    socket.connect(Number(porta), ip, () => {
      socket.write(payload, (err) => {
        if (err) {
          socket.destroy()
          reject(new Error(`Erro ao enviar dados: ${err.message}`))
          return
        }
        // Dar tempo para a impressora processar
        setTimeout(() => {
          socket.destroy()
          resolve(true)
        }, 1000)
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error(`Timeout: impressora ${ip}:${porta} não respondeu em ${TIMEOUT / 1000}s`))
    })

    socket.on('error', (err) => {
      reject(new Error(`Erro TCP: ${err.message}`))
    })
  })
}

// =====================================================
// Marcar item como falhou
// =====================================================
async function marcarFalha(filaId, erro) {
  await supabase.from('fila_impressao')
    .update({ status: 'falhou', erro })
    .eq('id', filaId)

  // Atualizar pedido se aplicável
  await supabase.from('pedidos_producao')
    .update({ status_impressao: 'falhou' })
    .eq('id', (await supabase.from('fila_impressao').select('pedido_producao_id').eq('id', filaId).single()).data?.pedido_producao_id)
    .not('pedido_producao_id', 'is', null)
}

// =====================================================
// Processar retries agendados
// =====================================================
async function processarRetries() {
  const agora = new Date().toISOString()
  
  // Resetar itens cujo retry chegou
  await supabase.from('fila_impressao')
    .update({ status: 'pendente', proximo_retry_em: null })
    .eq('status', 'pendente')
    .lte('proximo_retry_em', agora)
    .not('proximo_retry_em', 'is', null)
}

// =====================================================
// Iniciar loops
// =====================================================
setInterval(verificarFila, POLL_INTERVAL_MS)
setInterval(processarRetries, 10000) // Verificar retries a cada 10s

// Primeira execução imediata
verificarFila()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Gateway encerrando...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n🛑 Gateway encerrando...')
  process.exit(0)
})
