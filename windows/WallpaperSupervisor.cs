using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Net.Sockets;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Windows.Forms;

internal static class WallpaperSupervisor {
 static readonly string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
 static string LaunchScript(){string sidecar=Path.Combine(Root,"launch-script.txt");return File.Exists(sidecar)?File.ReadAllText(sidecar).Trim():Path.Combine(Root,"Start-CodexWallpaper.ps1");}
 static string hostScript=Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(LaunchScript())),"src","video-cdp-host.mjs"),node=Environment.GetEnvironmentVariable("CODEX_WALLPAPER_NODE")??"node.exe",pwsh=Environment.GetEnvironmentVariable("CODEX_WALLPAPER_PWSH")??"pwsh.exe";
 static int port=9335,rootPid=0;static string fixtureUrl=null;static bool fixture=false,resume=false,reconnect=false;static Process watchedRoot,host;
 static string rootStarted="",rootExecutable="",lastPhase="";static bool repairFailed=false;static readonly string supervisorStarted=Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("o");
 static Dictionary<string,object> Read(string file){try{return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(Root,file)))??new Dictionary<string,object>();}catch{return new Dictionary<string,object>();}}
 static int Number(Dictionary<string,object> d,string key){try{return Convert.ToInt32(d[key]);}catch{return 0;}}
 static void Log(string text){try{string f=Path.Combine(Root,"supervisor.log");if(File.Exists(f)&&new FileInfo(f).Length>32768)File.WriteAllText(f,"");File.AppendAllText(f,DateTimeOffset.UtcNow.ToString("o")+" "+text+Environment.NewLine);}catch{}}
 static void Status(string phase){try{var data=new Dictionary<string,object>{{"pid",Process.GetCurrentProcess().Id},{"supervisorStartedAtUtc",supervisorStarted},{"hostPid",host==null?0:host.Id},{"debugRootPid",rootPid},{"rootStartedAtUtc",rootStarted},{"rootExecutable",rootExecutable},{"phase",phase},{"updatedAt",DateTimeOffset.UtcNow.ToString("o")}};string file=Path.Combine(Root,"supervisor-status.json"),temp=file+".next";File.WriteAllText(temp,new JavaScriptSerializer().Serialize(data));if(File.Exists(file))File.Replace(temp,file,null);else File.Move(temp,file);if(phase!=lastPhase){Log("State "+phase);lastPhase=phase;}}catch{}}
 static bool Alive(Process p){try{return p!=null&&!p.HasExited;}catch{return false;}}
 static Process Attach(int pid){try{Process p=Process.GetProcessById(pid);IntPtr handle=p.Handle;return p;}catch{return null;}}
 static bool PortOpen(){try{using(var client=new TcpClient()){var t=client.ConnectAsync("127.0.0.1",port);return t.Wait(400)&&client.Connected;}}catch{return false;}}
 static Process Spawn(string file,string args){return Process.Start(new ProcessStartInfo {FileName=file,Arguments=args,WorkingDirectory=Root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});}
 static void RememberRoot(){if(!Alive(watchedRoot))return;rootStarted=watchedRoot.StartTime.ToUniversalTime().ToString("o");rootExecutable=watchedRoot.MainModule.FileName;}
 static bool Bootstrap(bool requested){
  var previous=Read("launch-status.json");string previousId=previous.ContainsKey("launchId")?Convert.ToString(previous["launchId"]):"";
  Status("bootstrapping");using(var p=Spawn(pwsh,"-NoProfile -NonInteractive -File \""+LaunchScript()+"\""+(requested?" -RestartCurrent":""))){if(!p.WaitForExit(150000)){p.Kill();Log("Owned bootstrap timed out");return false;}}
  var launch=Read("launch-status.json");if(!launch.ContainsKey("launchId")||Convert.ToString(launch["launchId"])==previousId||!launch.ContainsKey("phase")||Convert.ToString(launch["phase"])=="failed")return false;
  rootPid=Number(launch,"debugRootPid");watchedRoot=Attach(rootPid);if(!Alive(watchedRoot)||!WallpaperIdentity.Matches(watchedRoot,Convert.ToString(launch["rootStartedAtUtc"]),Convert.ToString(launch["rootExecutable"]))||WallpaperIdentity.PortOwner(port)!=rootPid)return false;
  RememberRoot();host=Attach(Number(Read("runtime-status.json"),"pid"));return PortOpen();
 }
 static bool CloseOwnedClient(){
  if(!Alive(watchedRoot))return true;
  if(!WallpaperIdentity.Matches(watchedRoot,rootStarted,rootExecutable)||WallpaperIdentity.PortOwner(port)!=rootPid)return false;
  var state=Read("runtime-status.json");if(!state.ContainsKey("browserId"))return false;
  var request=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:"+port+"/json/version");request.Timeout=3000;request.Proxy=null;
  Dictionary<string,object> version;using(var response=request.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))version=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(reader.ReadToEnd());
  string url=Convert.ToString(version["webSocketDebuggerUrl"]),expected="ws://127.0.0.1:"+port+"/devtools/browser/"+Convert.ToString(state["browserId"]);
  if(url!=expected)return false;
  using(var socket=new ClientWebSocket())using(var cancel=new CancellationTokenSource(5000)){
   socket.ConnectAsync(new Uri(url),cancel.Token).GetAwaiter().GetResult();var command=Encoding.UTF8.GetBytes("{\"id\":1,\"method\":\"Browser.close\"}");socket.SendAsync(new ArraySegment<byte>(command),WebSocketMessageType.Text,true,cancel.Token).GetAwaiter().GetResult();
  }
  return watchedRoot.WaitForExit(15000);
 }
 static void StopOwnedHost(){if(Alive(host)){try{host.Kill();host.WaitForExit(3000);}catch{}}host=null;}
 static void ReportRepairFailure(string reason){repairFailed=true;Log(reason);Status("reconnect-failed");MessageBox.Show(reason+"\n当前窗口未被强制结束；可退出 Codex 后再点壁纸入口。","Codex 壁纸需要重新连接",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
 [STAThread] static void Main(string[] args){
  if(args.Length==2&&args[0]=="--inspect-state"){Console.WriteLine(new JavaScriptSerializer().Serialize(Read(args[1])));return;}
  for(int i=0;i+1<args.Length;i+=2){if(args[i]=="--reconnect")reconnect=args[i+1]=="true";else if(args[i]=="--root-pid"){rootPid=int.Parse(args[i+1]);fixture=true;}else if(args[i]=="--resume-root-pid"){rootPid=int.Parse(args[i+1]);resume=true;}else if(args[i]=="--adopt-host-pid")host=Attach(int.Parse(args[i+1]));else if(args[i]=="--port")port=int.Parse(args[i+1]);else if(args[i]=="--host-script")hostScript=args[i+1];else if(args[i]=="--node")node=args[i+1];else if(args[i]=="--fixture-url")fixtureUrl=args[i+1];}
  bool acquired=false;using(var signal=new EventWaitHandle(false,EventResetMode.AutoReset,WallpaperIdentity.RequestEvent))using(var mutex=new Mutex(false,"Local\\CodexWallpaperSupervisor-"+port)){
   try{try{acquired=mutex.WaitOne(0);}catch(AbandonedMutexException){acquired=true;}if(!acquired){if(reconnect&&!fixture)signal.Set();return;}
    if(fixture||resume){watchedRoot=Attach(rootPid);RememberRoot();}else if(!Bootstrap(reconnect)){if(reconnect)ReportRepairFailure("Codex 未完成壁纸接入，请查看 launch-status.json。");else Status("bootstrap-failed");return;}
    int failures=0;DateTime nextRestart=DateTime.MinValue,lastHealthy=DateTime.UtcNow;
    while(true){
     if(!fixture&&signal.WaitOne(0)){
      Status("reconnecting");try{if(!CloseOwnedClient()){ReportRepairFailure("无法确认旧后台会话已正常退出，已停止重新启动。");continue;}StopOwnedHost();if(!Bootstrap(true)){ReportRepairFailure("新版 Codex 尚未完成壁纸接入，请查看启动状态。");break;}repairFailed=false;failures=0;lastHealthy=DateTime.UtcNow;while(signal.WaitOne(0)){};}catch(Exception e){ReportRepairFailure("重新连接失败："+e.Message);}continue;
     }
     if(!Alive(watchedRoot)){int code=0;try{code=watchedRoot.ExitCode;}catch{}if(!fixture&&code!=0&&failures<3){StopOwnedHost();Log("Client exited abnormally; bounded bootstrap retry");Thread.Sleep(3000);failures++;if(Bootstrap(false))continue;}break;}
     if(PortOpen()){
      var state=Read("runtime-status.json");DateTimeOffset updated;bool fresh=state.ContainsKey("updatedAt")&&DateTimeOffset.TryParse(Convert.ToString(state["updatedAt"]),out updated)&&(DateTimeOffset.UtcNow-updated).TotalSeconds<240;
      if(Alive(host)&&!fresh&&(DateTime.UtcNow-lastHealthy).TotalSeconds>240){Log("Owned host heartbeat stale; restarting");try{host.Kill();host.WaitForExit(3000);}catch{}host=null;}
      if(Alive(host)&&fresh){lastHealthy=DateTime.UtcNow;failures=0;}
      if(!Alive(host)&&DateTime.UtcNow>=nextRestart){
       host=Spawn(node,"--expose-gc --max-old-space-size=64 --max-semi-space-size=4 \""+hostScript+"\" --cdp-port "+port+(fixture&&fixtureUrl!=null?" --test-url \""+fixtureUrl+"\"":""));lastHealthy=DateTime.UtcNow;failures++;nextRestart=DateTime.UtcNow.AddSeconds(Math.Min(30,Math.Pow(2,Math.Min(failures,5))));Log("Host started "+host.Id);Status("watching");
      }
     }
     string phase=PortOpen()?"watching":"waiting-for-client-endpoint";
     if(!fixture){var clients=WallpaperIdentity.VisibleClients();if(!clients.ContainsKey(rootPid))phase=clients.Count>0?"unattached-visible-client":"client-background-only";else{foreach(var pair in clients)if(pair.Key!=rootPid)phase="multiple-client-sessions";try{WallpaperIdentity.Apply(clients[rootPid],Root);}catch(Exception e){Log("Taskbar identity: "+e.Message);}}}
     Status(repairFailed?"reconnect-failed":phase);Thread.Sleep(5000);
    }
   }catch(Exception e){Log(e.GetType().Name+": "+e.Message);Status("supervisor-failed");Environment.ExitCode=1;}
   finally{if(acquired){StopOwnedHost();if(!repairFailed)Status("stopped");mutex.ReleaseMutex();}}
  }
 }
}
