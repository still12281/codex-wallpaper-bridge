using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class CodexEntry {
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
 private static extern int SetCurrentProcessExplicitAppUserModelID(string id);
 private static string FindPowerShell() {
  string configured=Environment.GetEnvironmentVariable("CODEX_WALLPAPER_PWSH");
  if(!String.IsNullOrEmpty(configured) && File.Exists(configured)) return configured;
  foreach(string directory in (Environment.GetEnvironmentVariable("PATH")??"").Split(Path.PathSeparator)) {
   try { string candidate=Path.Combine(directory.Trim('"'),"pwsh.exe");if(File.Exists(candidate))return candidate; } catch { }
  }
  string standard=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"PowerShell","7","pwsh.exe");
  if(File.Exists(standard))return standard;
  throw new FileNotFoundException("PowerShell 7 not found. Set CODEX_WALLPAPER_PWSH or add pwsh.exe to PATH.");
 }

 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr handle);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr handle,int command);
 static bool Starting(string root){try{var s=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"supervisor-status.json")));string phase=Convert.ToString(s["phase"]);if(phase!="reconnecting"&&phase!="bootstrapping")return false;if((DateTimeOffset.UtcNow-DateTimeOffset.Parse((string)s["updatedAt"])).TotalSeconds>150)return false;using(var p=Process.GetProcessById(Convert.ToInt32(s["pid"])))return !p.HasExited&&String.Equals(p.MainModule.FileName,Path.Combine(root,"WallpaperSupervisor.exe"),StringComparison.OrdinalIgnoreCase)&&p.StartTime.ToUniversalTime().ToString("o")==(string)s["supervisorStartedAtUtc"];}catch{return false;}}
 static bool ActivateWallpaper(string root){
  try{
   var state=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"supervisor-status.json")));
   if((DateTimeOffset.UtcNow-DateTimeOffset.Parse((string)state["updatedAt"])).TotalSeconds>20)return false;
   using(var supervisor=Process.GetProcessById(Convert.ToInt32(state["pid"])))using(var client=Process.GetProcessById(Convert.ToInt32(state["debugRootPid"]))){
    if(supervisor.HasExited||!String.Equals(supervisor.MainModule.FileName,Path.Combine(root,"WallpaperSupervisor.exe"),StringComparison.OrdinalIgnoreCase)||supervisor.StartTime.ToUniversalTime().ToString("o")!=(string)state["supervisorStartedAtUtc"])return false;
    if(!WallpaperIdentity.Matches(client,(string)state["rootStartedAtUtc"],(string)state["rootExecutable"])||WallpaperIdentity.PortOwner(9335)!=client.Id)return false;
    var windows=WallpaperIdentity.VisibleClients();IntPtr h;if(!windows.TryGetValue(client.Id,out h)||windows.Count!=1)return false;
    WallpaperIdentity.Apply(h,root);if(IsIconic(h))ShowWindow(h,9);if(!SetForegroundWindow(h))ShowWindow(h,5);return true;
   }
  }catch{return false;}
 }
 [STAThread] private static void Main(string[] args) {
  string dataRoot=AppDomain.CurrentDomain.BaseDirectory;
  try {
   SetCurrentProcessExplicitAppUserModelID(WallpaperIdentity.AppId);
   if(Starting(dataRoot))return;
   if(ActivateWallpaper(dataRoot))return;
   if(Array.IndexOf(args,"--repair")<0&&WallpaperIdentity.VisibleClients().Count>0&&MessageBox.Show("当前 Codex 窗口尚未连接壁纸，或存在需要切换的旧会话。是否正常退出后，通过壁纸入口重新打开？未能正常退出时会停止，不会强制结束。","Codex 壁纸",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
   string script=File.ReadAllText(Path.Combine(dataRoot,"launch-script.txt")).Trim();
   if(!File.Exists(script))throw new FileNotFoundException("Launcher source moved; rebuild the launcher.");
   var info=new ProcessStartInfo {
    FileName=Path.Combine(dataRoot,"WallpaperSupervisor.exe"),
    Arguments="--reconnect true",
    WorkingDirectory=Path.GetDirectoryName(script),UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden
   };
   info.EnvironmentVariables["CODEX_WALLPAPER_DATA_DIR"]=dataRoot;
   info.EnvironmentVariables["CODEX_WALLPAPER_PWSH"]=FindPowerShell();
   string node=Environment.GetEnvironmentVariable("CODEX_WALLPAPER_NODE")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs","node.exe");
   if(File.Exists(node))info.EnvironmentVariables["CODEX_WALLPAPER_NODE"]=node;
   using(var process=Process.Start(info)) { }
  } catch(Exception error) {
   File.WriteAllText(Path.Combine(dataRoot,"entry-error.log"),DateTimeOffset.Now.ToString("o")+" "+error.ToString());
   MessageBox.Show(error.Message,"Codex 壁纸启动失败",MessageBoxButtons.OK,MessageBoxIcon.Error);
  }
 }
}
