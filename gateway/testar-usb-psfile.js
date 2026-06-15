/**
 * testar-usb-psfile.js
 * Testa impressao via C# salvo em arquivo .ps1 temporario
 * (evita problema do pipe stdin que pode cortar o script)
 */

const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ESC = 0x1B, GS = 0x1D
const payload = Buffer.concat([
  Buffer.from([ESC, 0x40]),
  Buffer.from([ESC, 0x74, 0x02]),
  Buffer.from('TESTE VIA PS FILE\r\nSistema Imperio Pasteis\r\n\r\n\r\n', 'latin1'),
  Buffer.from([GS, 0x56, 0x41, 0x00]),
])

const printerName = 'POS-80C (copy 2)'
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
if(-not $r){throw "Falha: erro $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"}
Write-Host "OK"
`

const tmpPs = path.join(os.tmpdir(), `print_${Date.now()}.ps1`)
fs.writeFileSync(tmpPs, psContent, 'utf8')

try {
  const out = execFileSync('powershell', [
    '-ExecutionPolicy', 'Bypass',
    '-NonInteractive',
    '-File', tmpPs,
  ], { encoding: 'utf8', stdio: 'pipe' })
  console.log('✅ Impresso! Saida:', out.trim())
} catch (e) {
  console.error('❌ Erro:', e.stdout || '', e.stderr || '', e.message)
} finally {
  try { fs.unlinkSync(tmpPs) } catch (_) {}
}
