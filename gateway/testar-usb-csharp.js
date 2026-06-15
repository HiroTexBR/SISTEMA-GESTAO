const { execSync } = require('child_process');
const ESC = 0x1B; const GS = 0x1D;
const cmdInit = Buffer.from([ESC, 0x40]);
const cmdCharset = Buffer.from([ESC, 0x74, 0x02]);
const cmdCorte = Buffer.from([GS, 0x56, 0x41, 0x00]);
const texto = 'TESTE VIA CSHARP NODE\r\nFunciona Perfeitamente!\r\n\r\n\r\n';
const payload = Buffer.concat([cmdInit, cmdCharset, Buffer.from(texto, 'latin1'), cmdCorte]);

const base64Payload = payload.toString('base64');
const printerName = "POS-80C (copy 2)";

const psScript = `
$code = @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    public static bool Print(string printerName, byte[] payload) {
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(payload.Length);
        Marshal.Copy(payload, 0, pUnmanagedBytes, payload.Length);
        bool success = false;
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Cupom_NodeJS";
        di.pDataType = "RAW";
        if (OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    int dwWritten = 0;
                    success = WritePrinter(hPrinter, pUnmanagedBytes, payload.Length, out dwWritten);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return success;
    }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
$bytes = [System.Convert]::FromBase64String("${base64Payload}")
$res = [RawPrint]::Print("${printerName}", $bytes)
if (-not $res) { throw "Falha na impressao RAW" }
`;

try {
  execSync('powershell -Command -', { input: psScript, stdio: 'pipe' });
  console.log('Impressão enviada com sucesso!');
} catch (e) {
  console.error('Erro:', e.stderr ? e.stderr.toString() : e.message);
}
