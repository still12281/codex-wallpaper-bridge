$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot '../windows/ClientWindow.cs')
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class CwbHiddenWindowFixture{
 delegate IntPtr WndProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct WindowClass{public uint style;public WndProc proc;public int cls,win;public IntPtr instance,icon,cursor,background;public string menu,name;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern ushort RegisterClass(ref WindowClass c);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr GetModuleHandle(string s);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string name,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr data);
 [DllImport("user32.dll")]static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]public static extern bool DestroyWindow(IntPtr h);
 static readonly WndProc proc=DefWindowProc;
 public static IntPtr Create(int width){var c=new WindowClass();c.proc=proc;c.instance=GetModuleHandle(null);c.name="Chrome_WidgetWin_1";RegisterClass(ref c);var h=CreateWindowEx(0,c.name,"",0x00CF0000,-24000,-24000,width,600,IntPtr.Zero,IntPtr.Zero,c.instance,IntPtr.Zero);if(h==IntPtr.Zero)throw new Exception("Hidden fixture window creation failed");return h;}
}
'@
$main=[CwbHiddenWindowFixture]::Create(800);$other=[CwbHiddenWindowFixture]::Create(356);$duplicate=[IntPtr]::Zero
try{
 $handle=$main.ToInt64();$cookie=[WallpaperClientWindow]::Bind($handle,$PID)
 if([WallpaperClientWindow]::Visible($handle)){throw 'Fixture unexpectedly visible'}
 if(-not [WallpaperClientWindow]::Bound($handle,$PID,$cookie)){throw 'Verified binding rejected'}
 if([WallpaperClientWindow]::Bound($other.ToInt64(),$PID,$cookie) -or [WallpaperClientWindow]::Bound($handle,-1,$cookie) -or [WallpaperClientWindow]::Bound($handle,$PID,($cookie -bxor 1))){throw 'Wrong window/owner/cookie was accepted'}
 if([WallpaperClientWindow]::Bind($handle,$PID) -ne $cookie){throw 'Same window cookie rotated'}
 $json=@{cookie=$cookie.ToString([Globalization.CultureInfo]::InvariantCulture)}|ConvertTo-Json|ConvertFrom-Json
 if($json.cookie -isnot [string] -or [long]::Parse($json.cookie) -ne $cookie){throw 'Cookie lost JSON precision'}
 if([WallpaperClientWindow]::Find($PID,0,-24000,-24000,800,600,1) -ne $handle){throw 'Exact native geometry did not select main'}
 $duplicate=[CwbHiddenWindowFixture]::Create(800);$blocked=$false
 try{[WallpaperClientWindow]::Find($PID,0,-24000,-24000,800,600,1)|Out-Null}catch{$blocked=$true}
 if(-not $blocked){throw 'Ambiguous native windows were accepted'}
 [void][CwbHiddenWindowFixture]::DestroyWindow($main);$main=[IntPtr]::Zero
 if([WallpaperClientWindow]::Bound($handle,$PID,$cookie)){throw 'Destroyed window retained binding'}
 if([WallpaperClientWindow]::Bound($duplicate.ToInt64(),$PID,$cookie)){throw 'New window inherited old main binding'}
 Write-Output 'PASS: hidden-only native fixtures, exact main selection, ambiguous rejection, cookie reuse/string precision, foreign window/owner rejection and destroyed-window invalidation. No real app window shown or activated.'
}finally{foreach($h in @($main,$other,$duplicate)){if($h -ne [IntPtr]::Zero){[void][CwbHiddenWindowFixture]::DestroyWindow($h)}}}
