using System;
using System.Collections;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Child processes receive only their explicitly configured standard streams.
// In particular, a Codex CDP socket inherited by this launcher never escapes
// into a detached application or a wallpaper helper.
public static class WallpaperCleanProcess {
 [StructLayout(LayoutKind.Sequential)] struct StartupInfo {
  public int cb; public IntPtr reserved,desktop,title;
  public int x,y,width,height,charsX,charsY,fill,flags;
  public short show,reservedBytes; public IntPtr reservedData,input,output,error;
 }
 [StructLayout(LayoutKind.Sequential)] struct StartupInfoEx { public StartupInfo info; public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public int pid,tid; }
 [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes { public int size; public IntPtr descriptor; [MarshalAs(UnmanagedType.Bool)] public bool inherit; }
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]
 static extern bool CreateProcess(string file,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,int flags,IntPtr environment,string cwd,ref StartupInfoEx startup,out ProcessInfo process);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]
 static extern IntPtr CreateFile(string file,uint access,int share,ref SecurityAttributes security,int disposition,int flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,int flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);

 public static string Quote(string value) {
  if(value==null||value.IndexOf('\0')>=0)throw new ArgumentException("Invalid process argument");
  var b=new StringBuilder("\"");int slashes=0;
  foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='\"'){b.Append('\\',slashes*2+1);b.Append(c);}else{b.Append('\\',slashes);b.Append(c);}slashes=0;}
  b.Append('\\',slashes*2);b.Append('"');return b.ToString();
 }
 public static string Arguments(string[] values) {
  var b=new StringBuilder();foreach(string value in values){if(b.Length>0)b.Append(' ');b.Append(Quote(value));}return b.ToString();
 }
 static IntPtr OpenStream(string path,bool input) {
  var security=new SecurityAttributes();security.size=Marshal.SizeOf(security);security.inherit=true;
  IntPtr h=CreateFile(path,input?0x80000000u:0x40000000u,3,ref security,input?3:2,0x80,IntPtr.Zero);
  if(h==new IntPtr(-1))throw new Win32Exception(Marshal.GetLastWin32Error(),"Cannot open child standard stream");return h;
 }
 public static Process Start(ProcessStartInfo info) { return Start(info,null,null); }
 public static Process Start(ProcessStartInfo info,string stdout,string stderr) {
  if(info.UseShellExecute||info.RedirectStandardInput||info.RedirectStandardOutput||info.RedirectStandardError)throw new ArgumentException("Use explicit standard-stream files, not shell execution or implicit pipes");
  if(!Path.IsPathRooted(info.FileName)||!File.Exists(info.FileName))throw new FileNotFoundException("An absolute existing executable is required",info.FileName);
  if(info.Arguments.IndexOf('\0')>=0)throw new ArgumentException("Invalid process argument line");
  bool streams=!String.IsNullOrEmpty(stdout)||!String.IsNullOrEmpty(stderr);
  if(streams&&(String.IsNullOrEmpty(stdout)||String.IsNullOrEmpty(stderr)||!Path.IsPathRooted(stdout)||!Path.IsPathRooted(stderr)||String.Equals(Path.GetFullPath(stdout),Path.GetFullPath(stderr),StringComparison.OrdinalIgnoreCase)))throw new ArgumentException("Distinct absolute stdout and stderr files are required");
  var startup=new StartupInfoEx();startup.info.cb=Marshal.SizeOf(typeof(StartupInfo));
  var child=new ProcessInfo();IntPtr environment=IntPtr.Zero,list=IntPtr.Zero,handles=IntPtr.Zero;
  IntPtr input=IntPtr.Zero,output=IntPtr.Zero,error=IntPtr.Zero;bool initialized=false;
  try {
   var entries=new System.Collections.Generic.List<string>();
   foreach(DictionaryEntry pair in info.EnvironmentVariables){string key=(string)pair.Key,value=(string)pair.Value;if(key.IndexOf('\0')>=0||(value!=null&&value.IndexOf('\0')>=0))throw new ArgumentException("Invalid child environment");entries.Add(key+"="+value);}
   entries.Sort(StringComparer.OrdinalIgnoreCase);environment=Marshal.StringToHGlobalUni(String.Join("\0",entries.ToArray())+"\0\0");
   int flags=0x400|(info.CreateNoWindow?0x8000000:0);
   if(streams){
    input=OpenStream("NUL",true);output=OpenStream(stdout,false);error=OpenStream(stderr,false);
    startup.info.flags=0x100;startup.info.input=input;startup.info.output=output;startup.info.error=error;
    IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);list=Marshal.AllocHGlobal(size);
    if(!InitializeProcThreadAttributeList(list,1,0,ref size))throw new Win32Exception(Marshal.GetLastWin32Error());initialized=true;
    handles=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.WriteIntPtr(handles,0,input);Marshal.WriteIntPtr(handles,IntPtr.Size,output);Marshal.WriteIntPtr(handles,IntPtr.Size*2,error);
    if(!UpdateProcThreadAttribute(list,0,new IntPtr(0x20002),handles,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero))throw new Win32Exception(Marshal.GetLastWin32Error());
    startup.info.cb=Marshal.SizeOf(typeof(StartupInfoEx));startup.attributes=list;flags|=0x80000;
   }
   var command=new StringBuilder(Quote(info.FileName)+(info.Arguments.Length>0?" "+info.Arguments:""));
   string cwd=String.IsNullOrEmpty(info.WorkingDirectory)?null:info.WorkingDirectory;
   // Associate the managed handle before the new process can exit, otherwise
   // GetProcessById can lose very short-lived children and their exit status.
   if(!CreateProcess(info.FileName,command,IntPtr.Zero,IntPtr.Zero,streams,flags|4,environment,cwd,ref startup,out child))throw new Win32Exception(Marshal.GetLastWin32Error(),"Clean child launch failed");
   Process result=null;
   try{
    result=Process.GetProcessById(child.pid);IntPtr keep=result.Handle;
    if(ResumeThread(child.thread)==UInt32.MaxValue)throw new Win32Exception(Marshal.GetLastWin32Error(),"Cannot resume newly created child");
    return result;
   }catch{
    // This is only the suspended child created immediately above. Never look
    // up or terminate an existing client, an endpoint owner or its children.
    TerminateProcess(child.process,1);if(result!=null)result.Dispose();throw;
   }
  } finally {
   if(child.thread!=IntPtr.Zero)CloseHandle(child.thread);if(child.process!=IntPtr.Zero)CloseHandle(child.process);
   if(initialized)DeleteProcThreadAttributeList(list);if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(handles!=IntPtr.Zero)Marshal.FreeHGlobal(handles);if(environment!=IntPtr.Zero)Marshal.FreeHGlobal(environment);
   if(input!=IntPtr.Zero)CloseHandle(input);if(output!=IntPtr.Zero)CloseHandle(output);if(error!=IntPtr.Zero)CloseHandle(error);
  }
 }
}
