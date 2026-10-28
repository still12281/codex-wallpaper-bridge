using System;using System.Diagnostics;using System.Runtime.InteropServices;using System.Text;using System.Collections.Generic;
public static class WallpaperClientWindow {
 [StructLayout(LayoutKind.Sequential)]struct Rect{public int left,top,right,bottom;}
 delegate bool Callback(IntPtr h,IntPtr l);
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback cb,IntPtr l);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")]static extern IntPtr GetWindow(IntPtr h,uint cmd);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]static extern bool ShowWindowAsync(IntPtr h,int cmd);
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 static bool Candidate(IntPtr h,int owner){uint pid;GetWindowThreadProcessId(h,out pid);var name=new StringBuilder(128);GetClassName(h,name,128);return pid==(uint)owner&&GetWindow(h,4)==IntPtr.Zero&&name.ToString()=="Chrome_WidgetWin_1";}
 public static bool Matches(double left,double top,double width,double height,double x,double y,double w,double h,double dpr){foreach(double scale in new[]{1.0,dpr})if(scale>0&&Math.Abs(left-x*scale)<=4&&Math.Abs(top-y*scale)<=4&&Math.Abs(width-w*scale)<=4&&Math.Abs(height-h*scale)<=4)return true;return false;}
 public static long Find(int owner,long hint,double x,double y,double width,double height,double dpr){
  var preferred=new IntPtr(hint);if(hint!=0&&Candidate(preferred,owner)&&(IsIconic(preferred)||!IsWindowVisible(preferred)))return hint;
  var found=new List<IntPtr>();EnumWindows((h,l)=>{if(!Candidate(h,owner))return true;Rect r;if(GetWindowRect(h,out r)&&Matches(r.left,r.top,r.right-r.left,r.bottom-r.top,x,y,width,height,dpr))found.Add(h);return true;},IntPtr.Zero);
  if(found.Count!=1)throw new InvalidOperationException("Cannot uniquely match the verified Codex main page to a native window");return found[0].ToInt64();
 }
 public static bool Visible(long h){return IsWindowVisible(new IntPtr(h));}
 public static bool Minimized(long h){return IsIconic(new IntPtr(h));}
 public static bool Foreground(long h){return GetForegroundWindow()==new IntPtr(h);}
 public static void Activate(long handle,int owner,string executable,long startedTicks){
  using(var p=Process.GetProcessById(owner)){if(p.StartTime.ToUniversalTime().Ticks!=startedTicks||!String.Equals(p.MainModule.FileName,executable,StringComparison.OrdinalIgnoreCase)||!Candidate(new IntPtr(handle),owner))throw new InvalidOperationException("Client window identity changed before activation");}
  var h=new IntPtr(handle);if(IsIconic(h))ShowWindowAsync(h,9);else if(!IsWindowVisible(h))ShowWindowAsync(h,5);SetForegroundWindow(h);
 }
}
