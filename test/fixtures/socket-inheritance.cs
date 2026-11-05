using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal class SocketInheritanceFixture {
 [StructLayout(LayoutKind.Sequential)] struct Startup { public int cb; public IntPtr reserved,desktop,title; public int x,y,w,h,cx,cy,fill,flags; public short show,reserved2; public IntPtr reserved3,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct Child { public IntPtr process,thread; public int pid,tid; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,int mask,int value);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool CreateProcess(string file,StringBuilder args,IntPtr a,IntPtr b,bool inherit,int flags,IntPtr environment,string cwd,ref Startup startup,out Child child);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("ws2_32.dll")] static extern int WSAStartup(ushort version,byte[] data);
 [DllImport("ws2_32.dll")] static extern int getsockname(IntPtr s,byte[] address,ref int size);
 static void Save(string path,object value){File.WriteAllText(path,new JavaScriptSerializer().Serialize(value));}
 static int Main(string[] args) {
  if(args[0]=="quickexit")return 23;
  if(args[0]=="child"){
   WSAStartup(0x202,new byte[512]);byte[] name=new byte[128];int size=name.Length;
   bool inherited=getsockname(new IntPtr(long.Parse(args[3])),name,ref size)==0;
   Save(args[1],new {pid=Process.GetCurrentProcess().Id,inherited=inherited,args=args,cwd=Environment.CurrentDirectory,environment=Environment.GetEnvironmentVariable("CWB_CLEAN_FIXTURE")});
   Console.WriteLine("fixture stdout");Console.Error.WriteLine("fixture stderr");
   var until=DateTime.UtcNow.AddSeconds(25);while(!File.Exists(args[2])&&DateTime.UtcNow<until)Thread.Sleep(25);return 0;
  }
  using(var socket=new Socket(AddressFamily.InterNetwork,SocketType.Stream,ProtocolType.Tcp)){
   socket.Bind(new IPEndPoint(IPAddress.Loopback,0));socket.Listen(1);
   if(!SetHandleInformation(socket.Handle,1,1))throw new Exception("Fixture could not make socket inheritable");
   string exe=Process.GetCurrentProcess().MainModule.FileName;
   string[] childArgs={"child",args[2],args[3],socket.Handle.ToInt64().ToString(),"argument with spaces","quote\"and\\trailing\\"};
   int pid;
   if(args[0]=="legacy"){
    var startup=new Startup();startup.cb=Marshal.SizeOf(startup);Child child;
    if(!CreateProcess(exe,new StringBuilder(WallpaperCleanProcess.Quote(exe)+" "+WallpaperCleanProcess.Arguments(childArgs)),IntPtr.Zero,IntPtr.Zero,true,0x8000000,IntPtr.Zero,null,ref startup,out child))throw new Exception("Legacy fixture spawn failed");
    pid=child.pid;CloseHandle(child.process);CloseHandle(child.thread);
   } else {
    var info=new ProcessStartInfo(exe,WallpaperCleanProcess.Arguments(childArgs));info.UseShellExecute=false;info.CreateNoWindow=true;info.WorkingDirectory=Path.GetDirectoryName(args[1]);info.EnvironmentVariables["CWB_CLEAN_FIXTURE"]="explicit child environment";
    using(var child=args[0]=="logs"?WallpaperCleanProcess.Start(info,args[1]+".stdout",args[1]+".stderr"):WallpaperCleanProcess.Start(info)){pid=child.Id;}
   }
   Save(args[1],new {port=((IPEndPoint)socket.LocalEndPoint).Port,child=pid});
   // Parent closes its only descriptor and exits; the test leaves child alive.
  }
  return 0;
 }
}
