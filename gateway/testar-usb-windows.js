/**
 * ALTERNATIVA — Impressão USB via arquivo de dispositivo (Windows)
 *
 * No Windows, a forma mais confiável de imprimir via USB sem precisar
 * trocar o driver é usar o nome de porta USB do Windows (ex: USB001).
 * 
 * Este script detecta e usa a porta USB diretamente.
 */

const fs = require('fs')
const { execSync } = require('child_process')

console.log('\n🔍 Iniciando diagnóstico de impressora USB (modo Windows nativo)...\n')

// Comandos ESC/POS básicos
const ESC = 0x1B
const GS  = 0x1D

function buildCupomTeste() {
  const agora = new Date().toLocaleString('pt-BR')
  const linhas = [
    '============================',
    '  TESTE DE IMPRESSAO USB   ',
    '============================',
    '',
    'Impressora: KP-IMP609',
    `Data/hora: ${agora}`,
    '',
    'Se voce ve este cupom,',
    'a impressora USB esta',
    'funcionando corretamente!',
    '',
    'Sistema Imperio Pasteis',
    '============================',
    '', '', '',
  ]
  const texto = linhas.join('\r\n') + '\r\n'

  const cmdInit    = Buffer.from([ESC, 0x40])
  const cmdCharset = Buffer.from([ESC, 0x74, 0x02])
  const cmdCorte   = Buffer.from([GS, 0x56, 0x41, 0x00])

  return Buffer.concat([
    cmdInit,
    cmdCharset,
    Buffer.from(texto, 'latin1'),
    cmdCorte,
  ])
}

// Detectar portas USB disponíveis no Windows
function detectarPortasUSB() {
  const portas = []

  // Tentar de USB001 até USB010
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(3, '0')
    const porta = `\\\\.\\USB${num}`
    // No Windows, os arquivos de dispositivo USB de impressora são acessíveis como portas
    const portaSimples = `USB${num}`
    try {
      // Verificar se a porta existe tentando abrir
      const fd = fs.openSync(`\\\\.\\${portaSimples}`, 'w')
      fs.closeSync(fd)
      portas.push(portaSimples)
    } catch (_) {}
  }

  return portas
}

async function imprimirViaPortaWindows(nomePorta, payload) {
  return new Promise((resolve, reject) => {
    try {
      // No Windows, escrever direto na porta USB funciona como arquivo
      const caminho = `\\\\.\\${nomePorta}`
      fs.writeFile(caminho, payload, (err) => {
        if (err) reject(new Error(`Erro ao escrever na porta ${nomePorta}: ${err.message}`))
        else resolve(true)
      })
    } catch (e) {
      reject(e)
    }
  })
}

async function main() {
  // Detectar portas
  const portas = detectarPortasUSB()

  if (portas.length === 0) {
    console.log('⚠️  Nenhuma porta USB encontrada automaticamente.')
    console.log('\nTentando portas comuns...')
  } else {
    console.log(`✅ Portas USB encontradas: ${portas.join(', ')}`)
  }

  // Tentar imprimir em cada porta
  const tentativas = portas.length > 0 ? portas : ['USB001', 'USB002', 'USB003']
  const payload = buildCupomTeste()

  for (const porta of tentativas) {
    console.log(`\n🖨️  Tentando imprimir na porta ${porta}...`)
    try {
      await imprimirViaPortaWindows(porta, payload)
      console.log(`\n✅ Cupom enviado para ${porta} com sucesso!`)
      console.log('\n🎉 A impressora USB está funcionando!')
      console.log(`\n📝 Anote esta porta: ${porta}`)
      console.log('\nPróximos passos:')
      console.log('  1. No sistema → Configurações → Impressoras')
      console.log('  2. Cadastre com Tipo de Conexão = "USB (cabo)"')
      console.log('  3. Inicie o gateway: node index.js')
      return
    } catch (err) {
      console.log(`   ❌ ${err.message}`)
    }
  }

  console.error('\n❌ Não foi possível imprimir em nenhuma porta USB.')
  console.error('\n💡 Solução manual:')
  console.error('   1. Abra o Painel de Controle → Dispositivos e Impressoras')
  console.error('   2. Encontre a KP-IMP609 e veja qual porta USB está atribuída')
  console.error('   3. Use essa porta no gateway (ex: USB001)')
}

main()
