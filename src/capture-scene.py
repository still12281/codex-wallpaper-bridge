# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["windows-capture==2.0.1", "numpy==2.2.6", "opencv-python==4.12.0.88"]
# ///
"""Capture only the uniquely named Wallpaper Engine window; binary JPEG stdout."""
import argparse
import ctypes
from ctypes import wintypes
import json
import os
import struct
import sys
import threading
import time
import traceback

if sys.argv[1:] == ["--runtime-path"]:
    print(sys.executable)
    sys.exit(0)

import cv2
from windows_capture import Frame, InternalCaptureControl, WindowsCapture


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--window", required=True)
    parser.add_argument("--fps", type=int, required=True)
    parser.add_argument("--parent", type=int, required=True)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--quality", type=int, default=78)
    parser.add_argument("--telemetry", action="store_true")
    args = parser.parse_args()
    if not args.window.startswith("CodexWallpaperBridge-") or args.fps not in (12, 24, 30, 60) or not 60 <= args.quality <= 96:
        raise ValueError("Invalid capture arguments")
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
    user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetWindowLongW.restype = wintypes.LONG
    user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.LONG]
    user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.GetWindowRect.restype = wintypes.BOOL
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    parent = kernel32.OpenProcess(0x00100000, False, args.parent)
    if not parent:
        raise RuntimeError("Capture parent is unavailable")
    stopped = threading.Event()
    paused = threading.Event()
    changed = threading.Event()
    frame_lock = threading.Lock()
    latest = None
    hwnd = None
    control = None

    def commands():
        try:
            for line in sys.stdin:
                command = line.strip()
                if command == "STOP":
                    break
                if command == "PAUSE":
                    paused.set()
                elif command == "RESUME":
                    paused.clear()
        finally:
            stopped.set()
            changed.set()

    threading.Thread(target=commands, daemon=True).start()
    try:
        print(json.dumps({"event": "waiting"}), file=sys.stderr, flush=True)
        deadline = time.monotonic() + 25
        while not stopped.is_set() and time.monotonic() < deadline:
            matches = []

            @callback_type
            def enum(window, _):
                length = user32.GetWindowTextLengthW(window)
                if length:
                    title = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(window, title, length + 1)
                    if args.window in title.value:
                        matches.append(window)
                return True

            user32.EnumWindows(enum, 0)
            if matches:
                hwnd = matches[0]
                break
            if kernel32.WaitForSingleObject(parent, 0) != 0x102:
                stopped.set()
                break
            stopped.wait(0.005)
        if not hwnd:
            raise RuntimeError("没有找到 Wallpaper Engine 专用渲染窗口，请检查 Wallpaper Engine 是否正常运行")
        # Keep it renderable, behind other windows. Do not hide or minimize it.
        style = user32.GetWindowLongW(hwnd, -16)
        user32.SetWindowLongW(hwnd, -16, style & ~0x00CF0000)
        extended_style = user32.GetWindowLongW(hwnd, -20)
        user32.SetWindowLongW(hwnd, -20, (extended_style & ~0x00040000) | 0x08000080)
        if not user32.SetWindowPos(hwnd, wintypes.HWND(1), -32000, -32000, args.width, args.height, 0x0030):
            raise ctypes.WinError(ctypes.get_last_error())
        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)) or rect.left != -32000 or rect.top != -32000:
            raise RuntimeError("专用壁纸窗口隔离失败")
        print(json.dumps({"event": "window", "hwnd": int(hwnd), "rect": [rect.left, rect.top, rect.right, rect.bottom]}), file=sys.stderr, flush=True)
        capture = WindowsCapture(cursor_capture=False, draw_border=None, window_hwnd=int(hwnd))
        next_encoded = 0.0

        @capture.event
        def on_frame_arrived(frame: Frame, capture_control: InternalCaptureControl):
            nonlocal latest, next_encoded
            now = time.monotonic()
            if stopped.is_set():
                capture_control.stop()
                return
            if paused.is_set() or now < next_encoded:
                return
            next_encoded = max(next_encoded + 1 / args.fps, now - 1 / args.fps)
            try:
                callback_at = time.time() * 1000
                encode_start = time.perf_counter()
                # The three-channel NumPy view has a four-byte pixel stride.
                # OpenCV can encode contiguous BGRA directly; avoid its slow
                # generic copy of that strided view. JPEG output is identical.
                ok, encoded = cv2.imencode(".jpg", frame.frame_buffer, [int(cv2.IMWRITE_JPEG_QUALITY), args.quality])
                encode_ms = (time.perf_counter() - encode_start) * 1000
            except Exception as error:
                print(json.dumps({"event": "error", "message": str(error), "traceback": traceback.format_exc()}), file=sys.stderr, flush=True)
                stopped.set()
                changed.set()
                return
            if ok:
                data = encoded.tobytes()
                if args.telemetry:
                    data = struct.pack('<4sdfI', b'CWB1', callback_at, encode_ms, int(now * args.fps) % (2**32)) + data
                if len(data) > 4 * 1024 * 1024:
                    raise RuntimeError("实时画面超过单帧大小限制，请降低分辨率")
                with frame_lock:
                    latest = data
                changed.set()

        @capture.event
        def on_closed():
            stopped.set()
            changed.set()

        def writer():
            nonlocal latest
            try:
                while not stopped.is_set():
                    changed.wait(0.5)
                    changed.clear()
                    with frame_lock:
                        data, latest = latest, None
                    if data is not None:
                        sys.stdout.buffer.write(struct.pack("<I", len(data)))
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
            except (BrokenPipeError, OSError):
                stopped.set()

        threading.Thread(target=writer, daemon=True).start()
        control = capture.start_free_threaded()
        while not stopped.wait(0.5):
            if kernel32.WaitForSingleObject(parent, 0) != 0x102 or control.is_finished():
                break
        if control.is_finished():
            control.wait()
    finally:
        stopped.set()
        changed.set()
        try:
            if control is not None:
                control.stop()
        finally:
            if hwnd:
                user32.PostMessageW(hwnd, 0x0010, 0, 0)
            kernel32.CloseHandle(parent)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"event": "error", "message": str(error)}, ensure_ascii=False), file=sys.stderr, flush=True)
        os._exit(1)
