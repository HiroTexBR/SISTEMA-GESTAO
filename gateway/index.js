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
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, execFileSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')

// Variáveis globais removidas pois voltamos ao modo de arquivo temporário


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

  if (tipo_conexao === 'usb' && !ip) {
    await marcarFalha(id, 'Nome da impressora no Windows não configurado no campo de IP')
    return
  }

  // Marcar como imprimindo (com trava de concorrência)
  const { data: claimData } = await supabase.from('fila_impressao')
    .update({ status: 'imprimindo', processando_em: new Date().toISOString(), tentativas: (tentativas || 0) + 1 })
    .eq('id', id)
    .eq('status', 'pendente')
    .select()

  // Se claimData vier vazio, significa que outro gateway já puxou esse pedido!
  if (!claimData || claimData.length === 0) {
    return
  }

  const destino = tipo_conexao === 'usb' ? `USB (${ip})` : `${ip}:${porta}`
  console.log(`🖨️  Imprimindo item ${id} → ${impressora.nome} (${destino})`)

  try {
    if (tipo_conexao === 'usb') {
      await enviarParaImpressoraUSB(ip, conteudo, corte_automatico)
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

    if ((tentativas || 0) + 1 >= MAX_TENTATIVAS) {
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
// Enviar via USB — C# RAW via arquivo .ps1 temporário
// (stdin pipe trunca o script; -File é confiável)
// =====================================================
function enviarParaImpressoraUSB(printerName, conteudo, corteAutomatico) {
  return new Promise((resolve, reject) => {
    try {
      const ESC = 0x1B
      const GS  = 0x1D
      const cmdInit    = Buffer.from([ESC, 0x40])
      const cmdCharset = Buffer.from([ESC, 0x74, 0x02])
      const cmdCorte   = corteAutomatico
        ? Buffer.from([GS, 0x56, 0x41, 0x00])
        : Buffer.alloc(0)

      // Normalize \n to \r\n for thermal printers (POS ignores raw \n)
      const normalizedConteudo = conteudo.replace(/(?<!\r)\n/g, '\r\n')

      const payload = Buffer.concat([
        cmdInit,
        cmdCharset,
        Buffer.from(normalizedConteudo, 'latin1'),
        Buffer.from('\r\n\r\n\r\n'),
        cmdCorte,
      ])

      const b64 = payload.toString('base64')

      const psContent = `
Add-Type -Language CSharp -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class RawPr {
  [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr p);
  [DllImport("winspool.Drv",EntryPoint="ClosePrinter",SetLastError=true,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true,CharSet=CharSet.Ansi,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr h,int l,[In,MarshalAs(UnmanagedType.LPStruct)]DOCINFOA d);
  [DllImport("winspool.Drv",EntryPoint="EndDocPrinter",SetLastError=true,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartPagePrinter",SetLastError=true,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="EndPagePrinter",SetLastError=true,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
  public class DOCINFOA{[MarshalAs(UnmanagedType.LPStr)]public string pDocName;[MarshalAs(UnmanagedType.LPStr)]public string pOutputFile;[MarshalAs(UnmanagedType.LPStr)]public string pDataType;}
  public static bool Print(string n,byte[] data){
    IntPtr p=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,p,data.Length);
    bool ok=false;IntPtr h=IntPtr.Zero;
    var d=new DOCINFOA();d.pDocName="Cupom";d.pDataType="RAW";
    if(OpenPrinter(n,out h,IntPtr.Zero)){if(StartDocPrinter(h,1,d)){if(StartPagePrinter(h)){int w=0;ok=WritePrinter(h,p,data.Length,out w);EndPagePrinter(h);}EndDocPrinter(h);}ClosePrinter(h);}
    Marshal.FreeCoTaskMem(p);return ok;
  }
}
'@
$bytes=[System.Convert]::FromBase64String("${b64}")
$r=[RawPr]::Print("${printerName}",$bytes)
if(-not $r){throw "Falha USB: erro $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"}
Write-Host "OK"
`

      const tmpPs = path.join(os.tmpdir(), `cupom_${Date.now()}.ps1`)
      fs.writeFileSync(tmpPs, psContent, 'utf8')

      try {
        execFileSync('powershell', [
          '-ExecutionPolicy', 'Bypass',
          '-NonInteractive',
          '-File', tmpPs,
        ], { encoding: 'utf8', stdio: 'pipe' })
        resolve(true)
      } catch (e) {
        const errOut = (e.stdout || '') + (e.stderr || '') + e.message
        reject(new Error(`Falha USB (${printerName}): ${errOut.trim()}`))
      } finally {
        try { fs.unlinkSync(tmpPs) } catch (_) {}
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
