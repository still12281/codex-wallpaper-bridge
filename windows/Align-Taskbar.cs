using System;
using System.Diagnostics;
internal static class AlignTaskbar {
 static int Main(string[] args){try{
  int port=9335;for(int i=0;i+1<args.Length;i++)if(args[i]=="--port")port=int.Parse(args[i+1]);
  int pid=WallpaperIdentity.PortOwner(port);if(pid==0)throw new Exception("No loopback-owned Codex endpoint");
  using(var p=Process.GetProcessById(pid)){if(!WallpaperIdentity.Official(p))throw new Exception("Endpoint owner is not Codex");var windows=WallpaperIdentity.VisibleClients();IntPtr h;if(!windows.TryGetValue(pid,out h)){Console.WriteLine("owned-client-background-only pid="+pid);return 0;}if(Array.IndexOf(args,"--apply")>=0)Console.WriteLine("pid="+pid+" "+WallpaperIdentity.Apply(h,AppDomain.CurrentDomain.BaseDirectory));else Console.WriteLine("owned-client-visible pid="+pid);}
  return 0;
 }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
