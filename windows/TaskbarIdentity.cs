using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Collections.Generic;

internal static class WallpaperIdentity {
 internal const string AppId="OpenAI.Codex_2p2nqsd0c76g0!App";
 internal const string RequestEvent="Local\\CodexWallpaperBridge.Reconnect.9335";
 [StructLayout(LayoutKind.Sequential)] struct Key {public Guid fmt;public uint id;public Key(uint n){fmt=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");id=n;}}
 [StructLayout(LayoutKind.Explicit,Size=24)] struct Value {[FieldOffset(0)]public ushort vt;[FieldOffset(8)]public IntPtr ptr;}
 [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Store {
  [PreserveSig]int GetCount(out uint count);[PreserveSig]int GetAt(uint i,out Key key);[PreserveSig]int GetValue(ref Key key,out Value value);[PreserveSig]int SetValue(ref Key key,ref Value value);[PreserveSig]int Commit();
 }
 delegate bool WindowCallback(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback cb,IntPtr l);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint command);
 [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr h,ref Guid iid,out Store store);
 [DllImport("ole32.dll")] static extern int PropVariantClear(ref Value v);
 [DllImport("iphlpapi.dll")] static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int tableClass,uint reserved);
 internal static bool Official(Process p){try{string f=p.MainModule.FileName;return !p.HasExited&&p.ProcessName.Equals("ChatGPT",StringComparison.OrdinalIgnoreCase)&&f.IndexOf(@"\WindowsApps\OpenAI.Codex_",StringComparison.OrdinalIgnoreCase)>=0&&f.EndsWith(@"\app\ChatGPT.exe",StringComparison.OrdinalIgnoreCase);}catch{return false;}}
 internal static Dictionary<int,IntPtr> VisibleClients(){var result=new Dictionary<int,IntPtr>();EnumWindows(delegate(IntPtr h,IntPtr l){uint pid;GetWindowThreadProcessId(h,out pid);if(!IsWindowVisible(h)||GetWindow(h,4)!=IntPtr.Zero||result.ContainsKey((int)pid))return true;try{using(var p=Process.GetProcessById((int)pid)){if(Official(p))result[(int)pid]=h;}}catch{}return true;},IntPtr.Zero);return result;}
 internal static IntPtr VisibleWindow(int pid){IntPtr h;return VisibleClients().TryGetValue(pid,out h)?h:IntPtr.Zero;}
 internal static int PortOwner(int port){int size=0;GetExtendedTcpTable(IntPtr.Zero,ref size,false,2,5,0);IntPtr data=Marshal.AllocHGlobal(size);try{if(GetExtendedTcpTable(data,ref size,false,2,5,0)!=0)return 0;int count=Marshal.ReadInt32(data),owner=0;for(int i=0;i<count;i++){int at=4+i*24;uint raw=(uint)Marshal.ReadInt32(data,at+8);int number=(int)(((raw&255)<<8)|((raw>>8)&255));if(number!=port||Marshal.ReadInt32(data,at)!=2)continue;if((uint)Marshal.ReadInt32(data,at+4)!=0x0100007f)return 0;int pid=Marshal.ReadInt32(data,at+20);if(owner!=0&&owner!=pid)return 0;owner=pid;}return owner;}finally{Marshal.FreeHGlobal(data);}}
 internal static bool Matches(Process p,string started,string executable){try{return Official(p)&&String.Equals(p.MainModule.FileName,executable,StringComparison.OrdinalIgnoreCase)&&p.StartTime.ToUniversalTime().Ticks==DateTime.Parse(started,null,System.Globalization.DateTimeStyles.RoundtripKind).ToUniversalTime().Ticks;}catch{return false;}}
 static string Read(Store s,uint n){Key k=new Key(n);Value v;Marshal.ThrowExceptionForHR(s.GetValue(ref k,out v));try{return v.vt==31?Marshal.PtrToStringUni(v.ptr):"";}finally{PropVariantClear(ref v);}}
 static void Set(Store s,uint n,string text){Key k=new Key(n);Value v=new Value{vt=31,ptr=Marshal.StringToCoTaskMemUni(text)};try{Marshal.ThrowExceptionForHR(s.SetValue(ref k,ref v));}finally{PropVariantClear(ref v);}}
 internal static string Apply(IntPtr h,string root){Guid iid=typeof(Store).GUID;Store store;Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(h,ref iid,out store));try{
  string command="\""+Path.Combine(root,"CodexEntry.exe")+"\"",icon=Path.Combine(root,"Codex.ico")+",0";
  // Relaunch command and display name must be supplied together, before the ID.
  Set(store,2,command);Set(store,4,"Codex");Set(store,3,icon);Set(store,5,AppId);
  if(Read(store,5)!=AppId||Read(store,2)!=command||Read(store,4)!="Codex")throw new IOException("Taskbar property readback mismatch");
  return Read(store,5)+" relaunch="+Read(store,2);
 }finally{Marshal.ReleaseComObject(store);}}
}
