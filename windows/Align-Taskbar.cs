using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;
internal static class AlignTaskbar {
 static int Main(string[] args){try{
  int port=9335;for(int i=0;i+1<args.Length;i++)if(args[i]=="--port")port=int.Parse(args[i+1]);
  int pid=WallpaperIdentity.PortOwner(port);if(pid==0)throw new Exception("No loopback-owned Codex endpoint");
  using(var p=Process.GetProcessById(pid)){if(!WallpaperIdentity.Official(p))throw new Exception("Endpoint owner is not Codex");
   int targetAt=Array.IndexOf(args,"--main-target"),geometryAt=Array.IndexOf(args,"--geometry"),browserAt=Array.IndexOf(args,"--browser-id");
   if(targetAt>=0&&geometryAt>=0&&browserAt>=0){
    string root=AppDomain.CurrentDomain.BaseDirectory;var json=new System.Web.Script.Serialization.JavaScriptSerializer();
    var endpoint=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"cdp-endpoint.json")));
    string browser=args[browserAt+1];if(Convert.ToInt32(endpoint["processId"])!=pid||Convert.ToString(endpoint["browserId"])!=browser||DateTimeOffset.Parse((string)endpoint["createdAtUtc"]).UtcDateTime.Ticks!=p.StartTime.ToUniversalTime().Ticks||!String.Equals((string)endpoint["executable"],p.MainModule.FileName,StringComparison.OrdinalIgnoreCase))throw new Exception("Main binding endpoint changed");
    var g=json.Deserialize<Dictionary<string,object>>(args[geometryAt+1]);
    long handle=WallpaperClientWindow.Find(pid,0,Convert.ToDouble(g["x"]),Convert.ToDouble(g["y"]),Convert.ToDouble(g["width"]),Convert.ToDouble(g["height"]),Convert.ToDouble(g["dpr"]));
    if(!WallpaperClientWindow.Visible(handle))throw new Exception("Main binding waits for a visible window");WallpaperIdentity.SaveMainWindow(root,p,browser,args[targetAt+1],handle);
   }
   var windows=WallpaperIdentity.ClientWindows(pid);if(windows.Count==0){Console.WriteLine("owned-client-background-only pid="+pid);return 0;}foreach(var h in windows)if(Array.IndexOf(args,"--apply")>=0)Console.WriteLine("pid="+pid+" "+WallpaperIdentity.Apply(h,AppDomain.CurrentDomain.BaseDirectory));else Console.WriteLine("owned-client-visible pid="+pid);}
  return 0;
 }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
