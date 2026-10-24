using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Net.Sockets;
using System.Web.Script.Serialization;
using System.Collections.Generic;

internal static class WallpaperSupervisor {
 static readonly string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
 static string LaunchScript(){string sidecar=Path.Combine(Root,"launch-script.txt");return File.Exists(sidecar)?File.ReadAllText(sidecar).Trim():Path.Combine(Root,"Start-CodexWallpaper.ps1");}
 static string hostScript=Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(LaunchScript())),"src","video-cdp-host.mjs"),node=Environment.GetEnvironmentVariable("CODEX_WALLPAPER_NODE")??"node.exe",pwsh=Environment.GetEnvironmentVariable("CODEX_WALLPAPER_PWSH")??"pwsh.exe";
 static int port=9335,rootPid=0;static string fixtureUrl=null;static bool fixture=false,resume=false;static Process watchedRoot,host;
 static Dictionary<string,object> Read(string file){try{return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(Root,file)))??new Dictionary<string,object>();}catch{return new Dictionary<string,object>();}}
 static int Number(Dictionary<string,object> d,string key){try{return Convert.ToInt32(d[key]);}catch{return 0;}}
 static void Log(string text){try{string f=Path.Combine(Root,"supervisor.log");if(File.Exists(f)&&new FileInfo(f).Length>32768)File.WriteAllText(f,"");File.AppendAllText(f,DateTimeOffset.UtcNow.ToString("o")+" "+text+Environment.NewLine);}catch{}}
 static void Status(string phase){try{File.WriteAllText(Path.Combine(Root,"supervisor-status.json"),"{\"pid\":"+Process.GetCurrentProcess().Id+",\"hostPid\":"+(host==null?0:host.Id)+",\"debugRootPid\":"+rootPid+",\"phase\":\""+phase+"\",\"updatedAt\":\""+DateTimeOffset.UtcNow.ToString("o")+"\"}");}catch{}}
 static bool Alive(Process p){try{return p!=null&&!p.HasExited;}catch{return false;}}
 static Process Attach(int pid){try{Process p=Process.GetProcessById(pid);IntPtr handle=p.Handle;return p;}catch{return null;}}
 static bool PortOpen(){try{using(var client=new TcpClient()){var t=client.ConnectAsync("127.0.0.1",port);return t.Wait(400)&&client.Connected;}}catch{return false;}}
 static Process Spawn(string file,string args){return Process.Start(new ProcessStartInfo {FileName=file,Arguments=args,WorkingDirectory=Root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});}
 static bool Bootstrap(){
  Status("bootstrapping");using(var p=Spawn(pwsh,"-NoProfile -NonInteractive -File \""+LaunchScript()+"\"")){if(!p.WaitForExit(150000)){p.Kill();Log("Owned bootstrap timed out");return false;}}
  var launch=Read("launch-status.json");rootPid=Number(launch,"debugRootPid");watchedRoot=Attach(rootPid);host=Attach(Number(Read("runtime-status.json"),"pid"));return Alive(watchedRoot)&&PortOpen();
 }
 [STAThread] static void Main(string[] args){
  if(args.Length==2&&args[0]=="--inspect-state"){Console.WriteLine(new JavaScriptSerializer().Serialize(Read(args[1])));return;}
  for(int i=0;i+1<args.Length;i+=2){if(args[i]=="--root-pid"){rootPid=int.Parse(args[i+1]);fixture=true;}else if(args[i]=="--resume-root-pid"){rootPid=int.Parse(args[i+1]);resume=true;}else if(args[i]=="--adopt-host-pid")host=Attach(int.Parse(args[i+1]));else if(args[i]=="--port")port=int.Parse(args[i+1]);else if(args[i]=="--host-script")hostScript=args[i+1];else if(args[i]=="--node")node=args[i+1];else if(args[i]=="--fixture-url")fixtureUrl=args[i+1];}
  bool acquired=false;using(var mutex=new Mutex(false,"Local\\CodexWallpaperSupervisor-"+port)){
   try{try{acquired=mutex.WaitOne(0);}catch(AbandonedMutexException){acquired=true;}if(!acquired)return;
    if(fixture||resume){watchedRoot=Attach(rootPid);}else if(!Bootstrap()){Status("bootstrap-failed");return;}
    int failures=0;DateTime nextRestart=DateTime.MinValue,lastHealthy=DateTime.UtcNow;
    while(true){
     if(!Alive(watchedRoot)){int code=0;try{code=watchedRoot.ExitCode;}catch{}if(!fixture&&code!=0&&failures<3){if(Alive(host)){try{host.Kill();host.WaitForExit(3000);}catch{}}host=null;Log("Client exited abnormally; bounded bootstrap retry");Thread.Sleep(3000);failures++;if(Bootstrap())continue;}break;}
     if(PortOpen()){
      var state=Read("runtime-status.json");DateTimeOffset updated;bool fresh=state.ContainsKey("updatedAt")&&DateTimeOffset.TryParse(Convert.ToString(state["updatedAt"]),out updated)&&(DateTimeOffset.UtcNow-updated).TotalSeconds<240;
      if(Alive(host)&&!fresh&&(DateTime.UtcNow-lastHealthy).TotalSeconds>240){Log("Owned host heartbeat stale; restarting");try{host.Kill();host.WaitForExit(3000);}catch{}host=null;}
      if(Alive(host)&&fresh){lastHealthy=DateTime.UtcNow;failures=0;}
      if(!Alive(host)&&DateTime.UtcNow>=nextRestart){
       host=Spawn(node,"--expose-gc --max-old-space-size=64 --max-semi-space-size=4 \""+hostScript+"\" --cdp-port "+port+(fixture&&fixtureUrl!=null?" --test-url \""+fixtureUrl+"\"":""));lastHealthy=DateTime.UtcNow;failures++;nextRestart=DateTime.UtcNow.AddSeconds(Math.Min(30,Math.Pow(2,Math.Min(failures,5))));Log("Host started "+host.Id);Status("watching");
      }
     }
     Status(PortOpen()?"watching":"waiting-for-client-endpoint");Thread.Sleep(5000);
    }
   }catch(Exception e){Log(e.GetType().Name+": "+e.Message);Status("supervisor-failed");Environment.ExitCode=1;}
   finally{if(Alive(host)){try{host.Kill();host.WaitForExit(3000);}catch{}}Status("stopped");if(acquired)mutex.ReleaseMutex();}
  }
 }
}
