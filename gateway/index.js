/**
 * GATEWAY DE IMPRESSÃO — Sistema Império Pastéis
 *
 * Suporta dois modos de conexão:
 *   - ethernet: envia comandos ESC/POS via TCP/IP (porta 9100)
 *   - usb:      envia comandos ESC/POS direto via USB (ex: KP-IMP609)
 *
 * INSTALAÇÃO:
 *   cd gateway
 *   npm install
 *   cp .env.example .env  (e preencher as variáveis)
 *   node index.js
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

// =====================================================
// Suporte a impressora USB via porta Windows (ex: USB001)
// =====================================================
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

// Detectar a porta USB da impressora automaticamente
function detectarPortaUSBWindows() {
  try {
    const saida = execSync('powershell -Command "Get-PrinterPort | Select-Object Name | Format-List"', { encoding: 'utf8' })
    const match = saida.match(/Name\s*:\s*(USB\d+)/i)
    if (match) return match[1]
  } catch (_) {}
  return 'USB001' // fallback padrão
}

const PORTA_USB_WINDOWS = detectarPortaUSBWindows()
console.log(`📌 Porta USB Windows detectada: ${PORTA_USB_WINDOWS}`)

console.log(`
╔══════════════════════════════════════════╗
║     GATEWAY DE IMPRESSÃO — v2.0.0       ║
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

  const { tipo_conexao, endereco_ip: ip, porta, corte_automatico } = impressora

  // Validar configurações por tipo de conexão
  if (tipo_conexao === 'ethernet' && (!ip || !porta)) {
    await marcarFalha(id, 'IP ou porta da impressora não configurados para conexão Ethernet')
    return
  }

  if (tipo_conexao === 'usb') {
    // Verificar se porta USB existe no sistema
    try {
      execSync(`powershell -Command "Get-PrinterPort -Name ${PORTA_USB_WINDOWS} -ErrorAction Stop"`, { stdio: 'ignore' })
    } catch (_) {
      await marcarFalha(id, `Porta USB Windows '${PORTA_USB_WINDOWS}' não encontrada. Verifique se a impressora está conectada.`)
      return
    }
  }

  // Marcar como imprimindo
  await supabase.from('fila_impressao')
    .update({ status: 'imprimindo', processando_em: new Date().toISOString(), tentativas: tentativas + 1 })
    .eq('id', id)

  const destino = tipo_conexao === 'usb' ? 'USB' : `${ip}:${porta}`
  console.log(`🖨️  Imprimindo item ${id} → ${impressora.nome} (${destino})`)

  try {
    if (tipo_conexao === 'usb') {
      await enviarParaImpressoraUSB(conteudo, corte_automatico)
    } else {
      await enviarParaImpressoraTCP(ip, porta, conteudo, corte_automatico)
    }

    // Sucesso
    await supabase.from('fila_impressao')
      .update({ status: 'impresso', impresso_em: new Date().toISOString() })
      .eq('id', id)

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
// Enviar via USB — Windows nativo (copy /b para porta USB)
// =====================================================
function enviarParaImpressoraUSB(conteudo, corteAutomatico) {
  return new Promise((resolve, reject) => {
    try {
      const ESC = 0x1B
      const GS  = 0x1D
      const cmdInit    = Buffer.from([ESC, 0x40])
      const cmdCharset = Buffer.from([ESC, 0x74, 0x02])
      const cmdCorte   = corteAutomatico
        ? Buffer.from([GS, 0x56, 0x41, 0x00])
        : Buffer.alloc(0)

      const payload = Buffer.concat([
        cmdInit,
        cmdCharset,
        Buffer.from(conteudo, 'latin1'),
        Buffer.from('\r\n\r\n\r\n'),
        cmdCorte,
      ])

      // Salvar em arquivo temporário e copiar para porta USB (confiável no Windows)
      const tmpFile = path.join(os.tmpdir(), `cupom_${Date.now()}.bin`)
      fs.writeFileSync(tmpFile, payload)

      try {
        execSync(`cmd /c copy /b "${tmpFile}" ${PORTA_USB_WINDOWS}`, { stdio: 'ignore' })
        resolve(true)
      } catch (e) {
        reject(new Error(`Falha ao enviar para porta USB ${PORTA_USB_WINDOWS}: ${e.message}`))
      } finally {
        try { fs.unlinkSync(tmpFile) } catch (_) {}
      }
    } catch (e) {
      reject(new Error(`Erro ao preparar cupom USB: ${e.message}`))
    }
  })
}

// =====================================================
// Enviar via TCP/IP — socket direto na porta 9100
// =====================================================
function enviarParaImpressoraTCP(ip, porta, conteudo, corteAutomatico) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const TIMEOUT = 8000

    socket.setTimeout(TIMEOUT)

    // Comandos ESC/POS
    const ESC = 0x1B
    const GS = 0x1D

    const cmdInit    = Buffer.from([ESC, 0x40])          // Inicializar
    const cmdCharset = Buffer.from([ESC, 0x74, 0x02])    // CP850 — acentos PT-BR
    const cmdCorte   = corteAutomatico
      ? Buffer.from([GS, 0x56, 0x42, 0x00])              // Corte parcial
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
          return reject(new Error(`Erro ao enviar dados: ${err.message}`))
        }
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

  const { data } = await supabase
    .from('fila_impressao')
    .select('pedido_producao_id')
    .eq('id', filaId)
    .single()

  if (data?.pedido_producao_id) {
    await supabase.from('pedidos_producao')
      .update({ status_impressao: 'falhou' })
      .eq('id', data.pedido_producao_id)
  }
}

// =====================================================
// Processar retries agendados
// =====================================================
async function processarRetries() {
  const agora = new Date().toISOString()
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
setInterval(processarRetries, 10000)

verificarFila()

process.on('SIGTERM', () => { console.log('\n🛑 Gateway encerrando...'); process.exit(0) })
process.on('SIGINT',  () => { console.log('\n🛑 Gateway encerrando...'); process.exit(0) })
