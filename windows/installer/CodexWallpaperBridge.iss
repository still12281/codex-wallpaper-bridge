; Build only from a manifest-checked source snapshot using tools/build-installer.ps1.
#ifndef PayloadRoot
  #error PayloadRoot is required
#endif
#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef BuildOutput
  #error BuildOutput is required
#endif

[Setup]
AppId={{8580ECE7-67CD-4F38-8970-FF511885F115}
AppName=Codex Wallpaper Bridge
AppVersion={#AppVersion}
AppPublisher=Codex Wallpaper Bridge contributors
AppPublisherURL=https://github.com/still12281/codex-wallpaper-bridge
DefaultDirName={localappdata}\Programs\CodexWallpaperBridge
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
LicenseFile={#PayloadRoot}\LICENSE
OutputDir={#BuildOutput}
OutputBaseFilename=CodexWallpaperBridge-{#AppVersion}-Setup
Compression=lzma2/normal
SolidCompression=yes
CloseApplications=no
RestartApplications=no
SetupLogging=yes
SetupMutex=CodexWallpaperBridge.Setup
UninstallDisplayName=Codex Wallpaper Bridge
UninstallFilesDir={app}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Types]
Name: "basic"; Description: "{cm:BasicSetup}"
Name: "full"; Description: "{cm:FullSetup}"
Name: "custom"; Description: "{cm:CustomSetup}"; Flags: iscustom

[Components]
Name: "bridge"; Description: "{cm:CoreComponent}"; Types: basic full custom; Flags: fixed
Name: "video"; Description: "{cm:VideoComponent}"; Types: full
Name: "capture"; Description: "{cm:CaptureComponent}"; Types: full

[CustomMessages]
english.BasicSetup=Standard installation
english.FullSetup=All features
english.CustomSetup=Custom installation
english.CoreComponent=Wallpaper Bridge and music response
english.VideoComponent=Image and video import (FFmpeg)
english.CaptureComponent=Native Wallpaper Engine capture (uv and Python)
chinesesimp.BasicSetup=标准安装
chinesesimp.FullSetup=完整安装
chinesesimp.CustomSetup=自定义安装
chinesesimp.CoreComponent=壁纸 Bridge 和音乐联动
chinesesimp.VideoComponent=图片与视频导入（FFmpeg）
chinesesimp.CaptureComponent=Wallpaper Engine 原版采集（uv 和 Python）
english.DataTitle=Wallpaper data
english.DataSubtitle=Choose the folder containing your wallpaper library and settings.
english.DataNote=For a ZIP installation, select its existing data folder. Upgrades reuse this folder; uninstall keeps personal data.
english.OptionsTitle=Shortcuts and startup
english.OptionsSubtitle=Choose how Codex Wallpaper Bridge integrates with Windows.
english.Shortcuts=Shortcuts:
english.ShortcutKeep=Keep existing choice (new installation: separate wallpaper entry)
english.ShortcutSeparate=Create a separate Codex Wallpaper entry
english.ShortcutReplace=Replace identified Codex shortcuts and back up originals
english.ShortcutNone=Do not create shortcuts
english.Recovery=Recovery after Codex updates:
english.Keep=Keep current setting
english.Enable=Enable
english.Disable=Disable
english.Login=Start with Windows:
english.Preparing=Preparing dependencies and installing the wallpaper bridge. First installation requires internet access.
english.Failed=Installation did not complete. Details:
english.BadDirectory=Choose separate absolute program and data folders, outside drive roots and system folders.
english.LockedData=This installation already uses another data folder. Keep the saved folder; use library backup/restore to migrate data.
english.Finished=Installation completed. Save your work, exit Codex normally, then open the wallpaper entry. Your library and settings are preserved.
english.UninstallFailed=Integration cleanup did not complete. Program and data files were kept. Details:
chinesesimp.DataTitle=壁纸数据
chinesesimp.DataSubtitle=选择保存壁纸库和设置的目录。
chinesesimp.DataNote=从 ZIP 安装升级时，请选择原数据目录。升级沿用该目录；卸载时保留个人数据。
chinesesimp.OptionsTitle=快捷方式与启动
chinesesimp.OptionsSubtitle=设置 Codex Wallpaper Bridge 与 Windows 的集成方式。
chinesesimp.Shortcuts=快捷方式：
chinesesimp.ShortcutKeep=沿用现有选择（首次安装创建独立壁纸入口）
chinesesimp.ShortcutSeparate=创建独立的 Codex Wallpaper 入口
chinesesimp.ShortcutReplace=备份并替换已识别的原 Codex 快捷方式
chinesesimp.ShortcutNone=不创建快捷方式
chinesesimp.Recovery=Codex 更新后恢复壁纸：
chinesesimp.Keep=沿用现有设置
chinesesimp.Enable=启用
chinesesimp.Disable=关闭
chinesesimp.Login=随 Windows 登录启动：
chinesesimp.Preparing=正在准备依赖并安装壁纸程序。首次安装需要联网，请等待完成。
chinesesimp.Failed=安装未完成，详细信息见：
chinesesimp.BadDirectory=请选择独立的绝对程序目录和数据目录，不能使用盘符根目录或系统目录。
chinesesimp.LockedData=本次安装已有固定数据目录，请沿用原目录；迁移数据请使用壁纸库备份恢复工具。
chinesesimp.Finished=安装完成。请保存工作、正常退出 Codex，再从壁纸入口打开。壁纸库和设置已保留。
chinesesimp.UninstallFailed=系统集成清理未完成，程序和数据已保留。详细信息见：

[Files]
Source: "{#PayloadRoot}\*"; DestDir: "{app}\payload"; Flags: ignoreversion recursesubdirs createallsubdirs

[INI]
Filename: "{app}\installation.ini"; Section: "Install"; Key: "DataDirectory"; String: "{code:DataRoot}"; Flags: uninsdeleteentry
Filename: "{app}\installation.ini"; Section: "Install"; Key: "PowerShell"; String: "{code:InstalledPowerShell}"; Flags: uninsdeleteentry

[UninstallDelete]
Type: files; Name: "{app}\installation.ini"

[Code]
const
  MoveFileReplaceExisting = 1;
  MoveFileWriteThrough = 8;

var
  DataPage: TInputDirWizardPage;
  OptionsPage: TWizardPage;
  ShortcutBox, RecoveryBox, LoginBox: TNewComboBox;
  PreviousRoot, ResultIni, BackendLog, PanelUpdateId, PanelUpdateDirectory: String;

function MoveFileEx(const ExistingFileName, NewFileName: String; Flags: DWORD): Boolean;
  external 'MoveFileExW@kernel32 stdcall';

function Q(const Value: String): String;
begin
  Result := '"' + Value + '"';
end;

function CleanPath(const Value: String): String;
begin
  Result := RemoveBackslashUnlessRoot(ExpandFileName(Value));
end;

function InFolder(const Parent, Child: String): Boolean;
begin
  Result := (CompareText(Parent, Child) = 0) or (CompareText(AddBackslash(Parent), Copy(AddBackslash(Child), 1, Length(AddBackslash(Parent)))) = 0);
end;

function DataRoot(Param: String): String;
begin
  Result := CleanPath(DataPage.Values[0]);
end;

function InstalledPowerShell(Param: String): String;
begin
  Result := GetIniString('Install', 'PowerShell', '', ResultIni);
end;

procedure AddLabel(const Page: TWizardPage; const Text: String; Top: Integer);
var LabelControl: TNewStaticText;
begin
  LabelControl := TNewStaticText.Create(Page);
  LabelControl.Parent := Page.Surface;
  LabelControl.Caption := Text;
  LabelControl.SetBounds(0, ScaleY(Top), Page.SurfaceWidth, ScaleY(20));
end;

function AddChoice(const Page: TWizardPage; Top: Integer): TNewComboBox;
begin
  Result := TNewComboBox.Create(Page);
  Result.Parent := Page.Surface;
  Result.SetBounds(0, ScaleY(Top), Page.SurfaceWidth, ScaleY(24));
  Result.Style := csDropDownList;
end;

procedure AddToggleChoices(const Box: TNewComboBox);
begin
  Box.Items.Add(CustomMessage('Keep'));
  Box.Items.Add(CustomMessage('Enable'));
  Box.Items.Add(CustomMessage('Disable'));
  Box.ItemIndex := 0;
end;

function ToggleValue(const Box: TNewComboBox): String;
begin
  case Box.ItemIndex of
    1: Result := 'enable';
    2: Result := 'disable';
  else Result := 'keep';
  end;
end;

function ShortcutValue: String;
begin
  case ShortcutBox.ItemIndex of
    1: Result := 'separate';
    2: Result := 'replace';
    3: Result := 'none';
  else Result := 'ask';
  end;
end;

function ExistingDataFromShortcuts: String;
var Shell, Link: Variant; Paths: TArrayOfString; I: Integer; Target, Candidate: String;
begin
  Result := '';
  SetArrayLength(Paths, 3);
  Paths[0] := ExpandConstant('{userdesktop}\Codex Wallpaper.lnk');
  Paths[1] := ExpandConstant('{userdesktop}\Codex.lnk');
  Paths[2] := ExpandConstant('{userprograms}\Codex Wallpaper Bridge\Codex Wallpaper.lnk');
  try
    Shell := CreateOleObject('WScript.Shell');
    for I := 0 to GetArrayLength(Paths) - 1 do
      if FileExists(Paths[I]) then begin
        Link := Shell.CreateShortcut(Paths[I]); Target := Link.TargetPath;
        Candidate := ExtractFileDir(Target);
        if (CompareText(ExtractFileName(Target), 'CodexEntry.exe') = 0) and FileExists(Candidate + '\launcher-runtime.json') then begin
          if (Result <> '') and (CompareText(Result, Candidate) <> 0) then begin Result := ''; exit; end;
          Result := Candidate;
        end;
      end;
  except
    Log('Could not identify one existing data directory from shortcuts.');
    Result := '';
  end;
end;

function IsUpdateId(const Value: String): Boolean;
var I: Integer;
begin
  Result := False;
  if Length(Value) <> 36 then exit;
  for I := 1 to 36 do
    if (I = 9) or (I = 14) or (I = 19) or (I = 24) then begin
      if Value[I] <> '-' then exit;
    end else if Pos(Value[I], '0123456789abcdef') = 0 then exit;
  Result := True;
end;

procedure InitializeWizard;
var InitialRoot, Choice: String;
begin
  PreviousRoot := GetPreviousData('DataDirectory', '');
  InitialRoot := PreviousRoot;
  if InitialRoot = '' then InitialRoot := GetEnv('CODEX_WALLPAPER_DATA_DIR');
  if InitialRoot = '' then InitialRoot := ExistingDataFromShortcuts;
  if InitialRoot = '' then InitialRoot := ExpandConstant('{localappdata}\CodexWallpaperBridge');
  DataPage := CreateInputDirPage(wpSelectDir, CustomMessage('DataTitle'), CustomMessage('DataSubtitle'), CustomMessage('DataNote'), False, '');
  DataPage.Add('');
  DataPage.Values[0] := ExpandConstant('{param:DATADIR|' + InitialRoot + '}');
  PanelUpdateId := ExpandConstant('{param:BRIDGEUPDATE|}');
  if PanelUpdateId <> '' then begin
    if not IsUpdateId(PanelUpdateId) then Abort;
    PanelUpdateDirectory := DataRoot('') + '\updates\' + PanelUpdateId;
    if not FileExists(PanelUpdateDirectory + '\request.json') then Abort;
  end;
  OptionsPage := CreateCustomPage(DataPage.ID, CustomMessage('OptionsTitle'), CustomMessage('OptionsSubtitle'));
  AddLabel(OptionsPage, CustomMessage('Shortcuts'), 0);
  ShortcutBox := AddChoice(OptionsPage, 24);
  ShortcutBox.Items.Add(CustomMessage('ShortcutKeep'));
  ShortcutBox.Items.Add(CustomMessage('ShortcutSeparate'));
  ShortcutBox.Items.Add(CustomMessage('ShortcutReplace'));
  ShortcutBox.Items.Add(CustomMessage('ShortcutNone'));
  ShortcutBox.ItemIndex := 0;
  Choice := ExpandConstant('{param:SHORTCUTMODE|ask}');
  if Choice = 'separate' then ShortcutBox.ItemIndex := 1;
  if Choice = 'replace' then ShortcutBox.ItemIndex := 2;
  if Choice = 'none' then ShortcutBox.ItemIndex := 3;
  AddLabel(OptionsPage, CustomMessage('Recovery'), 66);
  RecoveryBox := AddChoice(OptionsPage, 90); AddToggleChoices(RecoveryBox);
  Choice := ExpandConstant('{param:UPDATE|keep}');
  if Choice = 'enable' then RecoveryBox.ItemIndex := 1;
  if Choice = 'disable' then RecoveryBox.ItemIndex := 2;
  AddLabel(OptionsPage, CustomMessage('Login'), 132);
  LoginBox := AddChoice(OptionsPage, 156); AddToggleChoices(LoginBox);
  Choice := ExpandConstant('{param:LOGIN|keep}');
  if Choice = 'enable' then LoginBox.ItemIndex := 1;
  if Choice = 'disable' then LoginBox.ItemIndex := 2;
  WizardForm.FinishedLabel.Caption := CustomMessage('Finished');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var ProgramRoot, PersonalRoot: String;
begin
  Result := True;
  if CurPageID <> DataPage.ID then exit;
  ProgramRoot := CleanPath(WizardDirValue); PersonalRoot := DataRoot('');
  if (Pos('"', PersonalRoot) > 0) or (Length(ExtractFileDrive(DataPage.Values[0])) = 0) or
     (CompareText(ExtractFileDrive(PersonalRoot) + '\', PersonalRoot) = 0) or
     (CompareText(ExtractFileDrive(ProgramRoot) + '\', ProgramRoot) = 0) or
     InFolder(ExpandConstant('{win}'), ProgramRoot) or InFolder(ExpandConstant('{pf}'), ProgramRoot) or
     InFolder(ProgramRoot, PersonalRoot) or InFolder(PersonalRoot, ProgramRoot) or
     InFolder(ExpandConstant('{win}'), PersonalRoot) or InFolder(ExpandConstant('{pf}'), PersonalRoot) then begin
    SuppressibleMsgBox(CustomMessage('BadDirectory'), mbError, MB_OK, IDOK); Result := False;
  end;
  if Result and (PreviousRoot <> '') and (CompareText(CleanPath(PreviousRoot), PersonalRoot) <> 0) then begin
    SuppressibleMsgBox(CustomMessage('LockedData'), mbError, MB_OK, IDOK); Result := False;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Params, Payload: String; ExitCode: Integer;
begin
  Result := '';
  WizardForm.PreparingLabel.Caption := CustomMessage('Preparing');
  ExtractTemporaryFiles('{app}\payload\*');
  Payload := ExpandConstant('{tmp}\') + '{app}\payload';
  ResultIni := ExpandConstant('{tmp}\setup-result.ini');
  BackendLog := ExpandConstant('{localappdata}\CodexWallpaperBridge-setup.log');
  if PanelUpdateDirectory <> '' then BackendLog := PanelUpdateDirectory + '\setup-backend.log';
  Params := '-NoProfile -ExecutionPolicy Bypass -File ' + Q(Payload + '\windows\Setup-Bridge.ps1') +
    ' -DataDirectory ' + Q(DataRoot('')) + ' -ResultPath ' + Q(ResultIni) + ' -LogPath ' + Q(BackendLog) +
    ' -ShortcutMode ' + ShortcutValue + ' -UpdateReconnect ' + ToggleValue(RecoveryBox) + ' -LoginStartup ' + ToggleValue(LoginBox);
  if PanelUpdateDirectory <> '' then Params := Params + ' -PanelUpdateId ' + PanelUpdateId;
  if WizardIsComponentSelected('video') then Params := Params + ' -InstallVideoTools';
  if WizardIsComponentSelected('capture') then Params := Params + ' -InstallNativeCapture';
  if ExpandConstant('{param:SKIPPREPARATION|0}') = '1' then Params := Params + ' -SkipPreparation';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := CustomMessage('Failed') + #13#10 + BackendLog
  else if (ExitCode <> 0) or not FileExists(ResultIni) then
    Result := CustomMessage('Failed') + #13#10 + BackendLog;
  Log('Backend exit code: ' + IntToStr(ExitCode));
end;

procedure CurStepChanged(CurStep: TSetupStep);
var Marker: String;
begin
  if (CurStep = ssDone) and (PanelUpdateDirectory <> '') then begin
    Marker := PanelUpdateDirectory + '\setup-complete';
    if not SaveStringToFile(Marker + '.next', PanelUpdateId, False) then begin
      Log('Could not stage update completion receipt.');
      exit;
    end;
    if not MoveFileEx(PanelUpdateDirectory + '\launch-script.pending', DataRoot('') + '\launch-script.txt',
      MoveFileReplaceExisting or MoveFileWriteThrough) then begin
      Log('Could not activate the staged Bridge launcher. The previous entry is retained.');
      exit;
    end;
    if not RenameFile(Marker + '.next', Marker) then
      Log('New Bridge activated. Could not publish update completion receipt.');
  end;
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'DataDirectory', DataRoot(''));
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + NewLine + CustomMessage('DataTitle') + ':' + NewLine + Space + DataRoot('') + NewLine +
    NewLine + CustomMessage('Shortcuts') + NewLine + Space + ShortcutBox.Text + NewLine +
    CustomMessage('Recovery') + ' ' + RecoveryBox.Text + NewLine + CustomMessage('Login') + ' ' + LoginBox.Text;
end;

function CleanupIntegration(InspectOnly: Boolean): Boolean;
var Ini, Root, PowerShell, Params, UninstallLog: String; ExitCode: Integer;
begin
  Result := False;
  Ini := ExpandConstant('{app}\installation.ini');
  Root := GetIniString('Install', 'DataDirectory', '', Ini);
  PowerShell := GetIniString('Install', 'PowerShell', '', Ini);
  UninstallLog := ExpandConstant('{localappdata}\CodexWallpaperBridge-uninstall.log');
  if (Root <> '') and (ExtractFileName(PowerShell) = 'pwsh.exe') and FileExists(PowerShell) then begin
    Params := '-NoProfile -ExecutionPolicy Bypass -File ' + Q(ExpandConstant('{app}\payload\windows\Uninstall-Wallpaper.ps1')) + ' -Root ' + Q(Root) + ' -LogPath ' + Q(UninstallLog);
    if InspectOnly then Params := Params + ' -InspectOnly';
    if Exec(PowerShell, Params, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then Result := ExitCode = 0;
  end;
  if not Result then SuppressibleMsgBox(CustomMessage('UninstallFailed') + #13#10 + UninstallLog, mbError, MB_OK, IDOK);
end;

function InitializeUninstall: Boolean;
begin
  Result := CleanupIntegration(True);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    if not CleanupIntegration(False) then Abort;
end;
