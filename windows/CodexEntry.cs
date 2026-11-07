using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class CodexEntry {
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
 private static extern int SetCurrentProcessExplicitAppUserModelID(string id);
 [DllImport("user32.dll")]private static extern bool AllowSetForegroundWindow(int processId);
 private static string FindRuntime(string environmentName,string setting,string executable,string standard) {
  string configured=Environment.GetEnvironmentVariable(environmentName);
  if(!String.IsNullOrEmpty(configured)&&Path.IsPathRooted(configured)&&File.Exists(configured))return configured;
  try{var runtime=Read(AppDomain.CurrentDomain.BaseDirectory,"launcher-runtime.json");configured=Convert.ToString(runtime[setting]);if(Path.IsPathRooted(configured)&&File.Exists(configured)&&String.Equals(Path.GetFileName(configured),executable,StringComparison.OrdinalIgnoreCase))return configured;}catch{}
  foreach(string directory in (Environment.GetEnvironmentVariable("PATH")??"").Split(Path.PathSeparator)) {
   try { string candidate=Path.Combine(directory.Trim('"'),executable);if(Path.IsPathRooted(candidate)&&File.Exists(candidate))return candidate; } catch { }
  }
  if(File.Exists(standard))return standard;
  throw new FileNotFoundException("无法找到 "+executable+"。请重新运行 Build-Launcher.ps1 更新 launcher-runtime.json 中的运行路径。");
 }
 private static string FindPowerShell(){return FindRuntime("CODEX_WALLPAPER_PWSH","powerShell","pwsh.exe",Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"PowerShell","7","pwsh.exe"));}
 private static string FindNode(){return FindRuntime("CODEX_WALLPAPER_NODE","node","node.exe",Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs","node.exe"));}

 static System.Collections.Generic.Dictionary<string,object> Read(string root,string file){return new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,file)));}
 static bool Starting(string root){try{var s=Read(root,"launch-status.json");string phase=Convert.ToString(s["phase"]);if(phase=="failed"||phase=="inspect-only"||phase=="background-rendered"||phase=="cdp-ready-background-not-yet-rendered")return false;double age=(DateTimeOffset.UtcNow-DateTimeOffset.Parse((string)s["updatedAt"])).TotalSeconds;if(age<0||age>150)return false;using(var p=Process.GetProcessById(Convert.ToInt32(s["helperPid"])))return !p.HasExited&&String.Equals(p.MainModule.FileName,FindPowerShell(),StringComparison.OrdinalIgnoreCase)&&p.StartTime.ToUniversalTime().ToString("o")==(string)s["helperStartedAtUtc"];}catch{return false;}}
 static bool TryWarm(string root,bool inspect,out bool repair){
  repair=true;bool attempted=false;var clock=Stopwatch.StartNew();
  try{
   var hint=Read(root,"main-window.json");var endpoint=Read(root,"cdp-endpoint.json");
   if(Convert.ToInt32(hint["schemaVersion"])!=2||Convert.ToInt32(endpoint["schemaVersion"])!=1||Convert.ToString(endpoint["address"])!="127.0.0.1")return false;
   int pid=Convert.ToInt32(hint["clientId"]),port=Convert.ToInt32(endpoint["port"]);long cookie=Int64.Parse((string)hint["cookie"],System.Globalization.CultureInfo.InvariantCulture),handle=Convert.ToInt64(hint["handle"]);
   string browser=(string)hint["browserId"],executable=(string)hint["executable"];Guid browserGuid;if(!Guid.TryParse(browser,out browserGuid)||port<9335||port>9354||Convert.ToInt32(endpoint["processId"])!=pid||Convert.ToString(endpoint["browserId"])!=browser||!String.Equals(Convert.ToString(endpoint["executable"]),executable,StringComparison.OrdinalIgnoreCase))return false;
   long ticks=DateTimeOffset.Parse((string)hint["startedAt"]).UtcDateTime.Ticks;if(DateTimeOffset.Parse((string)endpoint["createdAtUtc"]).UtcDateTime.Ticks!=ticks)return false;
   using(var p=Process.GetProcessById(pid)){
    var pinned=p.Handle;if(p.HasExited||!WallpaperIdentity.Official(p)||p.SessionId!=Process.GetCurrentProcess().SessionId||p.SessionId!=Convert.ToInt32(hint["sessionId"])||p.StartTime.ToUniversalTime().Ticks!=ticks||!String.Equals(p.MainModule.FileName,executable,StringComparison.OrdinalIgnoreCase)||!WallpaperClientWindow.Bound(handle,pid,cookie))return false;
    var listeners=CodexWallpaperBridge.TcpListeners.Read(port);if(listeners.Length==0)return false;foreach(var listener in listeners)if(listener.OwningProcess!=pid||(listener.LocalAddress!="127.0.0.1"&&listener.LocalAddress!="::1"))return false;
    if(!inspect){attempted=true;AllowSetForegroundWindow(pid);ShowCurrentMain(root,port,browser);if(WallpaperClientWindow.Visible(handle)&&!WallpaperClientWindow.Minimized(handle)&&!WallpaperClientWindow.Foreground(handle))WallpaperClientWindow.Activate(handle,pid,executable,ticks,cookie);var wait=Stopwatch.StartNew();while(wait.ElapsedMilliseconds<600&&(!WallpaperClientWindow.Visible(handle)||WallpaperClientWindow.Minimized(handle)||!WallpaperClientWindow.Foreground(handle)))System.Threading.Thread.Sleep(10);
     if(!WallpaperClientWindow.Visible(handle)||WallpaperClientWindow.Minimized(handle)||!WallpaperClientWindow.Foreground(handle))throw new IOException("已向原 Codex 主窗口发送唤回请求，但尚未取得前台；现有客户端已保留。");
    }
    p.Refresh();if(p.HasExited||!WallpaperClientWindow.Bound(handle,pid,cookie))throw new IOException("唤回期间主窗口身份发生变化，现有客户端已保留。");
    try{var state=Read(root,"runtime-status.json");double age=(DateTimeOffset.UtcNow-DateTimeOffset.Parse((string)state["updatedAt"])).TotalSeconds;string phase=Convert.ToString(state["phase"]);repair=age<0||age>12||Convert.ToString(state["browserId"])!=browser||Convert.ToInt32(state["cdpPort"])!=port||Array.IndexOf(new[]{"background-rendered","background-disabled","realtime-capture-active","realtime-capture-paused"},phase)<0;}catch{repair=true;}
    var report=new System.Collections.Generic.Dictionary<string,object>{{"kind","native-existing-main-window"},{"activationMode",inspect?"inspection":"codex-native-show-bridge"},{"sameClient",true},{"rootPid",pid},{"handle",handle},{"inspectOnly",inspect},{"visible",WallpaperClientWindow.Visible(handle)},{"minimized",WallpaperClientWindow.Minimized(handle)},{"foreground",WallpaperClientWindow.Foreground(handle)},{"repairNeeded",repair},{"elapsedMs",clock.Elapsed.TotalMilliseconds},{"checkedAt",DateTimeOffset.UtcNow.ToString("o")}};
    try{File.WriteAllText(Path.Combine(root,inspect?"entry-warm-check.json":"activation-status.json"),new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(report));}catch{}
    return true;
   }
  }catch{if(attempted)throw;return false;}
 }
 static void ShowCurrentMain(string root,int port,string browser){
  string bootstrap=File.ReadAllText(Path.Combine(root,"launch-script.txt")).Trim(),helper=Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(bootstrap)),"src","activate-client.mjs");
  if(!File.Exists(helper))throw new IOException("Codex 主窗口恢复模块缺失，现有客户端已保留。");
  string token=Guid.NewGuid().ToString("N"),output=Path.Combine(root,"activation-"+token+".out"),error=Path.Combine(root,"activation-"+token+".err");
  var info=new ProcessStartInfo{FileName=FindNode(),Arguments="\""+helper+"\" --cdp-port "+port+" --browser-id "+browser+" --no-wait --show-current",UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=Path.GetDirectoryName(helper)};
  try{using(var child=WallpaperCleanProcess.Start(info,output,error)){
   AllowSetForegroundWindow(child.Id);if(!child.WaitForExit(6000))throw new IOException("Codex 内部显示状态未及时恢复，现有客户端已保留。");
   if(child.ExitCode!=0)throw new IOException("Codex 内部显示状态恢复失败，现有客户端已保留。详情："+File.ReadAllText(error));
   var result=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(output));
   var restored=result.ContainsKey("nativeRestore")?result["nativeRestore"] as System.Collections.Generic.Dictionary<string,object>:null;
   if(restored==null||!Convert.ToBoolean(restored["bridgeUsed"])||Convert.ToBoolean(restored["hidden"]))throw new IOException("Codex 主页面未完成内部显示恢复。");
  }}finally{try{if(File.Exists(output))File.Delete(output);if(File.Exists(error))File.Delete(error);}catch{}}
 }
 static void WarmRepair(string root){
  try{if(Starting(root))return;string script=File.ReadAllText(Path.Combine(root,"launch-script.txt")).Trim();if(!File.Exists(script))return;
   var info=new ProcessStartInfo{FileName=FindPowerShell(),Arguments="-NoProfile -NonInteractive -File \""+script+"\" -AttachOnly",UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=Path.GetDirectoryName(script)};
   info.EnvironmentVariables["CODEX_WALLPAPER_DATA_DIR"]=root;info.EnvironmentVariables["CODEX_WALLPAPER_PWSH"]=FindPowerShell();info.EnvironmentVariables["CODEX_WALLPAPER_NODE"]=FindNode();using(var child=WallpaperCleanProcess.Start(info)){}
  }catch{}
 }
 [STAThread] private static void Main(string[] args) {
  using(var entryLock=new System.Threading.Mutex(false,"Local\\CodexWallpaperBridge.Entry.9335")){
   bool acquired=false;
   try{try{acquired=entryLock.WaitOne(0);}catch(System.Threading.AbandonedMutexException){acquired=true;}if(!acquired)return;Run(args);}
   finally{if(acquired)entryLock.ReleaseMutex();}
  }
 }
 private static void Run(string[] args) {
  string dataRoot=AppDomain.CurrentDomain.BaseDirectory;
  bool inspect=Array.IndexOf(args,"--check-runtime")>=0;
  bool inspectWarm=Array.IndexOf(args,"--inspect-warm")>=0;
  bool afterUpdate=args.Length>0&&args[0]=="--after-update-event";
  try {
   if(afterUpdate){
    long record;if(args.Length!=2||!Int64.TryParse(args[1],out record)||record<=0){Environment.ExitCode=1;return;}
    string bootstrap=File.ReadAllText(Path.Combine(dataRoot,"launch-script.txt")).Trim();
    string runner=Path.Combine(Path.GetDirectoryName(bootstrap),"AfterUpdateReconnect.ps1");
    if(!File.Exists(runner))throw new FileNotFoundException("Update reconnect runner unavailable");
    var updateInfo=new ProcessStartInfo{FileName=FindPowerShell(),Arguments="-NoProfile -NonInteractive -File \""+runner+"\" -Root \""+dataRoot.TrimEnd(Path.DirectorySeparatorChar)+"\" -EventRecordId "+record,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=Path.GetDirectoryName(runner)};
    using(var update=WallpaperCleanProcess.Start(updateInfo)){if(!update.WaitForExit(180000)){Environment.ExitCode=1;return;}Environment.ExitCode=update.ExitCode;}return;
   }
   if(inspectWarm){bool repair;bool eligible=TryWarm(dataRoot,true,out repair);if(!eligible){File.WriteAllText(Path.Combine(dataRoot,"entry-warm-check.json"),"{\"eligible\":false,\"inspectOnly\":true}");Environment.ExitCode=2;}return;}
   if(!inspect){
   SetCurrentProcessExplicitAppUserModelID(WallpaperIdentity.AppId);
   bool repair;if(TryWarm(dataRoot,false,out repair)){if(repair)WarmRepair(dataRoot);return;}
   if(Starting(dataRoot))return;
   // Every entry checks the currently registered package. The bootstrap reuses
   // a healthy client/host without loading the wallpaper a second time.
   }
   string script=File.ReadAllText(Path.Combine(dataRoot,"launch-script.txt")).Trim();
   if(!File.Exists(script))throw new FileNotFoundException("Launcher source moved; rebuild the launcher.");
   var info=new ProcessStartInfo {
    FileName=FindPowerShell(),
    Arguments="-NoProfile -NonInteractive -File \""+script+"\""+(inspect?" -InspectOnly":""),
    WorkingDirectory=Path.GetDirectoryName(script),UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden
   };
   info.EnvironmentVariables["CODEX_WALLPAPER_DATA_DIR"]=dataRoot;
   info.EnvironmentVariables["CODEX_WALLPAPER_PWSH"]=FindPowerShell();
   string node=FindNode();info.EnvironmentVariables["CODEX_WALLPAPER_NODE"]=node;
   string inspectOut=Path.Combine(dataRoot,"entry-runtime-stdout.log"),inspectError=Path.Combine(dataRoot,"entry-runtime-stderr.log");
   using(var process=inspect?WallpaperCleanProcess.Start(info,inspectOut,inspectError):WallpaperCleanProcess.Start(info)) {
    if(!inspect)AllowSetForegroundWindow(process.Id);
    if(!inspect){
     if(!process.WaitForExit(180000))throw new IOException("壁纸启动尚未完成，请查看 launch-status.json；现有 Codex 已保留。");
     var launch=Read(dataRoot,"launch-status.json");
     if(Convert.ToInt32(launch["helperPid"])!=process.Id)throw new IOException("壁纸启动结果身份不匹配，请查看 launch-status.json。");
     string phase=Convert.ToString(launch["phase"]);
     if(process.ExitCode!=0||phase=="failed")throw new IOException(launch.ContainsKey("error")?Convert.ToString(launch["error"]):"壁纸启动失败，请查看 launch-status.json。");
     if(phase!="background-rendered")throw new IOException("Codex 已打开，但壁纸首帧尚未确认。请查看 launch-status.json 和 video-error.log。");
    }
    if(inspect){
     if(!process.WaitForExit(45000)){process.Kill();throw new IOException("运行环境自检超时，已停止本次自检进程。");}
     string output=File.ReadAllText(inspectOut),error=File.ReadAllText(inspectError);
     File.WriteAllText(Path.Combine(dataRoot,"entry-runtime-check.log"),output+error);
     var result=new System.Collections.Generic.Dictionary<string,object>{{"powerShell",info.FileName},{"node",node},{"exitCode",process.ExitCode},{"inspectOnly",true},{"checkedAt",DateTimeOffset.UtcNow.ToString("o")}};
     File.WriteAllText(Path.Combine(dataRoot,"entry-runtime-check.json"),new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(result));
     if(process.ExitCode!=0)throw new IOException("运行环境自检失败，请查看 entry-runtime-check.log。");
    }
   }
  } catch(Exception error) {
   Environment.ExitCode=1;
   File.WriteAllText(Path.Combine(dataRoot,"entry-error.log"),DateTimeOffset.Now.ToString("o")+" "+error.ToString());
   if(!inspect&&!inspectWarm&&!afterUpdate)MessageBox.Show(error.Message,"Codex 壁纸启动失败",MessageBoxButtons.OK,MessageBoxIcon.Error);
  }
 }
}
