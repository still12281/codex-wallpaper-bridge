using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

internal static class WallpaperHostRecovery {
    const int MaxAttempts = 2;
    static readonly TimeSpan StableLifetime = TimeSpan.FromMinutes(1);

    static EventWaitHandle ExitSignal(Process process) {
        var signal = new EventWaitHandle(false, EventResetMode.ManualReset);
        signal.SafeWaitHandle = new SafeWaitHandle(process.Handle, false);
        return signal;
    }

    static string ErrorTail(string root) {
        try {
            using (var file = new FileStream(Path.Combine(root, "video-error.log"), FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                file.Seek(-Math.Min(file.Length, 4096), SeekOrigin.End);
                using (var reader = new StreamReader(file)) return reader.ReadToEnd();
            }
        } catch (IOException) { return ""; }
    }

    static void Record(string root, object entry) {
        try {
            using (var gate = new Mutex(false, @"Local\CodexWallpaperBridge.HostRecoveryLog")) {
                bool acquired;
                try { acquired = gate.WaitOne(1000); } catch (AbandonedMutexException) { acquired = true; }
                if (!acquired) return;
                try {
                    string log = Path.Combine(root, "host-recovery.jsonl");
                    var previous = File.Exists(log) ? File.ReadLines(log).Reverse().Take(31).Reverse() : new string[0];
                    var lines = previous.Concat(new[] {new JavaScriptSerializer().Serialize(entry)}).ToArray();
                    string next = log + ".next";
                    File.WriteAllLines(next, lines);
                    if (File.Exists(log)) File.Replace(next, log, null);
                    else File.Move(next, log);
                } finally { gate.ReleaseMutex(); }
            }
        } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }

    static int Main(string[] args) {
        int clientPid, hostPid, priorAttempts;
        long clientTicks, hostTicks;
        Guid browserId;
        if (args.Length != 8 || !Int32.TryParse(args[2], out clientPid) || !Int64.TryParse(args[3], out clientTicks) ||
            !Int32.TryParse(args[4], out hostPid) || !Int64.TryParse(args[5], out hostTicks) ||
            !Guid.TryParseExact(args[6], "D", out browserId) || !Int32.TryParse(args[7], out priorAttempts) ||
            priorAttempts < 0 || priorAttempts > MaxAttempts) return 2;
        string root = args[0], pwsh = args[1];
        try {
            using (var client = Process.GetProcessById(clientPid))
            using (var host = Process.GetProcessById(hostPid))
            using (var gate = new Mutex(false, @"Local\CodexWallpaperBridge.HostWait." + hostPid + "." + hostTicks)) {
                using (var clientExit = ExitSignal(client))
                using (var hostExit = ExitSignal(host)) {
                    if (client.StartTime.ToUniversalTime().Ticks != clientTicks || host.StartTime.ToUniversalTime().Ticks != hostTicks ||
                        client.SessionId != host.SessionId || !String.Equals(host.ProcessName, "node", StringComparison.OrdinalIgnoreCase)) return 2;
                    try { if (!gate.WaitOne(0)) return 0; } catch (AbandonedMutexException) { }
                    try {
                        if (WaitHandle.WaitAny(new WaitHandle[] {clientExit, hostExit}) == 0) return 0;
                        string expectedClient = clientPid + ":" + clientTicks + ":" + browserId.ToString("D");
                        var exitedAt = DateTimeOffset.UtcNow;
                        int attempts = exitedAt.UtcDateTime - new DateTime(hostTicks, DateTimeKind.Utc) >= StableLifetime ? 0 : priorAttempts;
                        Record(root, new {at = exitedAt.ToString("o"), state = "host-exited", clientPid, hostPid, exitCode = host.ExitCode, attempts, stderr = ErrorTail(root)});
                        while (attempts < MaxAttempts) {
                            if (clientExit.WaitOne(attempts == 0 ? 750 : 3000)) return 0;
                            attempts++;
                            try {
                                string script = File.ReadAllText(Path.Combine(root, "launch-script.txt")).Trim();
                                var info = new ProcessStartInfo {
                                    FileName = pwsh, Arguments = WallpaperCleanProcess.Arguments(new[] {
                                        "-NoProfile", "-NonInteractive", "-File", script, "-AttachOnly",
                                        "-ExpectedRecoveryClient", expectedClient, "-RecoveryAttempt", attempts.ToString()
                                    }),
                                    WorkingDirectory = Path.GetDirectoryName(script), UseShellExecute = false, CreateNoWindow = true
                                };
                                info.EnvironmentVariables["CODEX_WALLPAPER_DATA_DIR"] = root;
                                using (var repair = WallpaperCleanProcess.Start(info))
                                using (var repairExit = ExitSignal(repair)) {
                                    if (WaitHandle.WaitAny(new WaitHandle[] {clientExit, repairExit}, 65000) == 0) return 0;
                                    int? code = repair.HasExited ? (int?)repair.ExitCode : null;
                                    Record(root, new {at = DateTimeOffset.UtcNow.ToString("o"), state = "attach", clientPid, hostPid, attempt = attempts, exitCode = code});
                                    if (code == 0) return 0;
                                    if (code == null) break; // An in-flight bootstrap still owns the launch.
                                }
                            } catch (Exception error) {
                                Record(root, new {at = DateTimeOffset.UtcNow.ToString("o"), state = "attach-failed", clientPid, hostPid, attempt = attempts, error = error.Message});
                            }
                        }
                        Record(root, new {at = DateTimeOffset.UtcNow.ToString("o"), state = "manual-repair-required", clientPid, hostPid, attempts});
                    } finally { gate.ReleaseMutex(); }
                }
            }
            return 0;
        } catch (Exception error) {
            Record(root, new {at = DateTimeOffset.UtcNow.ToString("o"), state = "watch-failed", clientPid, hostPid, error = error.Message});
            return 1;
        }
    }
}
