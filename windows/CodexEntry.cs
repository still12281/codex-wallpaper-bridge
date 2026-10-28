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
  bool afterUpdate=args.Length>0&&args[0]=="--after-update-event";
  try {
   if(afterUpdate){
    long record;if(args.Length!=2||!Int64.TryParse(args[1],out record)||record<=0){Environment.ExitCode=1;return;}
    string bootstrap=File.ReadAllText(Path.Combine(dataRoot,"launch-script.txt")).Trim();
    string runner=Path.Combine(Path.GetDirectoryName(bootstrap),"AfterUpdateReconnect.ps1");
    if(!File.Exists(runner))throw new FileNotFoundException("Update reconnect runner unavailable");
    var updateInfo=new ProcessStartInfo{FileName=FindPowerShell(),Arguments="-NoProfile -NonInteractive -File \""+runner+"\" -Root \""+dataRoot.TrimEnd(Path.DirectorySeparatorChar)+"\" -EventRecordId "+record,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=Path.GetDirectoryName(runner)};
    using(var update=Process.Start(updateInfo)){if(!update.WaitForExit(180000)){Environment.ExitCode=1;return;}Environment.ExitCode=update.ExitCode;}return;
   }
   if(!inspect){
   SetCurrentProcessExplicitAppUserModelID(WallpaperIdentity.AppId);
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
   if(inspect){info.RedirectStandardOutput=true;info.RedirectStandardError=true;}
   using(var process=Process.Start(info)) {
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
     string output=process.StandardOutput.ReadToEnd(),error=process.StandardError.ReadToEnd();
     File.WriteAllText(Path.Combine(dataRoot,"entry-runtime-check.log"),output+error);
     var result=new System.Collections.Generic.Dictionary<string,object>{{"powerShell",info.FileName},{"node",node},{"exitCode",process.ExitCode},{"inspectOnly",true},{"checkedAt",DateTimeOffset.UtcNow.ToString("o")}};
     File.WriteAllText(Path.Combine(dataRoot,"entry-runtime-check.json"),new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(result));
     if(process.ExitCode!=0)throw new IOException("运行环境自检失败，请查看 entry-runtime-check.log。");
    }
   }
  } catch(Exception error) {
   Environment.ExitCode=1;
   File.WriteAllText(Path.Combine(dataRoot,"entry-error.log"),DateTimeOffset.Now.ToString("o")+" "+error.ToString());
   if(!inspect&&!afterUpdate)MessageBox.Show(error.Message,"Codex 壁纸启动失败",MessageBoxButtons.OK,MessageBoxIcon.Error);
  }
 }
}
