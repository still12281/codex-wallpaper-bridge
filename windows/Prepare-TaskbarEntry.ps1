[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$entryCodeRoot=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$entryRoot=Get-WallpaperDataRoot
. (Join-Path $entryCodeRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
$entryCodex=Get-DreamSkinCodexInstall
if($null -eq $entryCodex){throw 'Official Codex package unavailable'}
$entryLink=Join-Path $entryRoot 'Codex.lnk'
$entryIcon=Join-Path $entryRoot 'Codex.ico'
. (Join-Path $PSScriptRoot 'Official-Icon.ps1')
$entryIconSource=Copy-WallpaperOfficialIcon $entryCodex $entryIcon
$entryShell=New-Object -ComObject WScript.Shell
$entryShortcut=$entryShell.CreateShortcut($entryLink)
$entryShortcut.TargetPath=Join-Path $entryRoot 'CodexEntry.exe'
if(-not (Test-Path -LiteralPath $entryShortcut.TargetPath)){throw 'Native Codex entry is not built'}
$entryShortcut.Arguments=''
$entryShortcut.WorkingDirectory=$entryRoot
$entryShortcut.IconLocation="$entryIcon,0"
$entryShortcut.Description='Codex'
$entryShortcut.WindowStyle=7
$entryShortcut.Save()

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
namespace CodexWallpaperEntry {
 [StructLayout(LayoutKind.Sequential)] public struct PropertyKey { public Guid fmtid; public uint pid; }
 [StructLayout(LayoutKind.Explicit,Size=24)] public struct PropVariant {
  [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr pointer;
 }
 [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IPropertyStore {
  [PreserveSig] int GetCount(out uint count);
  [PreserveSig] int GetAt(uint index,out PropertyKey key);
  [PreserveSig] int GetValue(ref PropertyKey key,out PropVariant value);
  [PreserveSig] int SetValue(ref PropertyKey key,ref PropVariant value);
  [PreserveSig] int Commit();
 }
 public static class LinkIdentity {
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant value);
  public static string Set(string path,string appId,string command,string icon) {
   object link=Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046")));
   var persist=(IPersistFile)link; persist.Load(path,2);
   var store=(IPropertyStore)link;
   var key=new PropertyKey {fmtid=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),pid=5};
   PropVariant value;
   uint[] ids={2,4,3,5};string[] values={command,"Codex",icon,appId};
   for(int i=0;i<ids.Length;i++){var field=new PropertyKey{fmtid=key.fmtid,pid=ids[i]};value=new PropVariant{vt=31,pointer=Marshal.StringToCoTaskMemUni(values[i])};try{Marshal.ThrowExceptionForHR(store.SetValue(ref field,ref value));}finally{PropVariantClear(ref value);}}
   Marshal.ThrowExceptionForHR(store.Commit());persist.Save(path,true);
   Marshal.ThrowExceptionForHR(store.GetValue(ref key,out value));
   string actual; try {actual=value.vt==31?Marshal.PtrToStringUni(value.pointer):null;}finally {PropVariantClear(ref value);Marshal.FinalReleaseComObject(link);}
   return actual;
  }
 }
}
'@
$entryAppId=$entryCodex.AppUserModelId
$entryCommand='"'+$entryShortcut.TargetPath+'"'
$entryActual=[CodexWallpaperEntry.LinkIdentity]::Set($entryLink,$entryAppId,$entryCommand,"$entryIcon,0")
if($entryActual -cne $entryAppId){throw 'Shortcut AppUserModelID verification failed'}
[ordered]@{shortcut=$entryLink;icon=$entryIcon;officialIconSource=$entryIconSource;iconSha256=(Get-FileHash -LiteralPath $entryIcon).Hash;appUserModelId=$entryActual;target=$entryShortcut.TargetPath;arguments=$entryShortcut.Arguments;existingPinnedEntryModified=$false;taskbarGroupingVerified=$false;clientColdLaunchVerified=$false} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $entryRoot 'taskbar-entry-status.json') -Encoding utf8 -ErrorAction Stop
Get-Content -LiteralPath (Join-Path $entryRoot 'taskbar-entry-status.json') -Raw
