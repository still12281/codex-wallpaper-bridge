using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Net;
using System.Runtime.InteropServices;

namespace CodexWallpaperBridge {
 public sealed class TcpListenerInfo {
  public string LocalAddress { get; set; }
  public int LocalPort { get; set; }
  public int OwningProcess { get; set; }
 }
 public static class TcpListeners {
  // OWNER_PID_LISTENER=3. Table/row layout is documented by the IP Helper API.
  [DllImport("iphlpapi.dll")] private static extern uint GetExtendedTcpTable(
   IntPtr table, ref int size, bool order, int family, int tableClass, uint reserved);
  public static TcpListenerInfo[] Read(int port) {
   if(port<1||port>65535)throw new ArgumentOutOfRangeException("port");
   var result=new List<TcpListenerInfo>();
   ReadFamily(2,port,result);ReadFamily(23,port,result);
   return result.ToArray();
  }
  private static void ReadFamily(int family,int port,List<TcpListenerInfo> result) {
   int size=0;
   uint code=GetExtendedTcpTable(IntPtr.Zero,ref size,false,family,3,0);
   if(code!=0&&code!=122)throw new Win32Exception((int)code);
   for(int attempt=0;attempt<4;attempt++) {
    int capacity=size;
    IntPtr table=Marshal.AllocHGlobal(capacity);
    try {
     code=GetExtendedTcpTable(table,ref size,false,family,3,0);
     if(code==122)continue;
     if(code!=0)throw new Win32Exception((int)code);
     int count=Marshal.ReadInt32(table),stride=family==2?24:56;
     if(count<0||capacity<4||(long)count*stride>capacity-4)throw new InvalidOperationException("Invalid TCP table length");
     for(int index=0;index<count;index++) {
      IntPtr row=IntPtr.Add(table,4+index*stride);
      int portOffset=family==2?8:20;
      int localPort=(Marshal.ReadByte(row,portOffset)<<8)|Marshal.ReadByte(row,portOffset+1);
      if(localPort!=port)continue;
      byte[] address=new byte[family==2?4:16];
      Marshal.Copy(IntPtr.Add(row,family==2?4:0),address,0,address.Length);
      // dwLocalScopeId, like dwLocalPort, is stored in network byte order.
      long scope=family==2?0:((long)Marshal.ReadByte(row,16)<<24)|((long)Marshal.ReadByte(row,17)<<16)|((long)Marshal.ReadByte(row,18)<<8)|Marshal.ReadByte(row,19);
      var ip=family==2?new IPAddress(address):new IPAddress(address,scope);
      result.Add(new TcpListenerInfo {LocalAddress=ip.ToString(),LocalPort=localPort,OwningProcess=Marshal.ReadInt32(row,family==2?20:52)});
     }
     return;
    }finally{Marshal.FreeHGlobal(table);}
   }
   throw new InvalidOperationException("TCP listener table changed repeatedly; ownership was not verified");
  }
 }
}
