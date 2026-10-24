using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

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
 static bool ActivateWallpaper(string root){
  try{
   var state=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"supervisor-status.json")));
   var client=Process.GetProcessById(Convert.ToInt32(state["debugRootPid"]));
   if(!client.MainModule.FileName.Contains("\\WindowsApps\\OpenAI.Codex_")||client.MainWindowHandle==IntPtr.Zero)return false;
   if(IsIconic(client.MainWindowHandle))ShowWindow(client.MainWindowHandle,9);SetForegroundWindow(client.MainWindowHandle);
   var supervisor=Process.GetProcessById(Convert.ToInt32(state["pid"]));return !supervisor.HasExited&&supervisor.ProcessName=="WallpaperSupervisor";
  }catch{return false;}
 }
 [STAThread] private static void Main() {
  string dataRoot=AppDomain.CurrentDomain.BaseDirectory;
  try {
   if(ActivateWallpaper(dataRoot))return;
   SetCurrentProcessExplicitAppUserModelID("OpenAI.Codex_2p2nqsd0c76g0!App");
   string script=File.ReadAllText(Path.Combine(dataRoot,"launch-script.txt")).Trim();
   if(!File.Exists(script))throw new FileNotFoundException("Launcher source moved; rebuild the launcher.");
   var info=new ProcessStartInfo {
    FileName=FindPowerShell(),
    Arguments="-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File \""+script+"\"",
    WorkingDirectory=Path.GetDirectoryName(script),UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden
   };
   info.EnvironmentVariables["CODEX_WALLPAPER_DATA_DIR"]=dataRoot;
   using(var process=Process.Start(info)) { }
  } catch(Exception error) {
   File.WriteAllText(Path.Combine(dataRoot,"entry-error.log"),DateTimeOffset.Now.ToString("o")+" "+error.ToString());
  }
 }
}
