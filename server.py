#!/usr/bin/env python3
"""
Music UI Render – Local server
Serves the web app and handles .MOV export via FFmpeg QuickTime Animation with alpha.

Usage:  python3 server.py
        → opens http://localhost:8000
"""

import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import webbrowser

PORT = int(os.environ.get("PORT", 8000))
DIR = Path(__file__).parent

# Store in-progress render sessions
sessions = {}  # session_id → temp_dir path


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def do_POST(self):
        if self.path == '/render':
            self._handle_render()
        elif self.path == '/spotify-info':
            self._handle_spotify_info()
        else:
            self.send_error(404)

    def _handle_spotify_info(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len)
        data = json.loads(body)
        url = data.get('url')

        if not url or 'open.spotify.com/track/' not in url:
            self.send_error(400, "Missing or invalid Spotify URL")
            return

        try:
            oembed_url = f"https://open.spotify.com/oembed?url={urllib.parse.quote(url)}"
            req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode())
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
        except urllib.error.URLError as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"Error fetching Spotify info: {str(e)}".encode())

    def _handle_render(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len)
        data = json.loads(body)

        session_id = data['session']
        start_idx  = data['startIndex']
        frames     = data['frames']
        fps        = data['fps']
        total      = data['totalFrames']
        is_final   = data['final']

        # Create or retrieve temp dir for this session
        if session_id not in sessions:
            tmp = tempfile.mkdtemp(prefix='musicui_')
            sessions[session_id] = tmp
        tmp = sessions[session_id]

        # Save WebP frames
        for i, data_url in enumerate(frames):
            idx = start_idx + i
            # Strip data:image/webp;base64, prefix
            header, b64 = data_url.split(',', 1)
            frame_bytes = base64.b64decode(b64)
            frame_path = os.path.join(tmp, f'frame_{idx:04d}.webp')
            with open(frame_path, 'wb') as f:
                f.write(frame_bytes)

        if not is_final:
            # Acknowledge batch, wait for more
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'ok')
            return

        # ── Final batch: encode .MOV with FFmpeg qtrle (Animation) + alpha ──
        out_path = os.path.join(tmp, 'output.mov')
        
        # Check if local ffmpeg exists, otherwise rely on system ffmpeg
        local_ffmpeg = os.path.join(DIR, 'ffmpeg')
        ffmpeg_cmd = local_ffmpeg if os.path.exists(local_ffmpeg) else 'ffmpeg'
        
        # qtrle encodes almost instantly and compresses flat UI graphics beautifully
        cmd =[
            ffmpeg_cmd, '-y',
            '-framerate', str(fps),
            '-i', os.path.join(tmp, 'frame_%04d.webp'),
            '-c:v', 'qtrle',
            '-pix_fmt', 'argb',
            out_path,
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=120
            )
            if result.returncode != 0:
                self.send_response(500)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(f'FFmpeg error:\n{result.stderr}'.encode())
                return
        except FileNotFoundError:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'FFmpeg binary not found. Please ensure it is bundled or installed on the system.')
            return
        except subprocess.TimeoutExpired:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'FFmpeg timed out')
            return

        # Send .mov back
        mov_size = os.path.getsize(out_path)
        self.send_response(200)
        self.send_header('Content-Type', 'video/quicktime')
        self.send_header('Content-Length', str(mov_size))
        self.send_header('Content-Disposition', 'attachment; filename="music-ui.mov"')
        self.end_headers()

        with open(out_path, 'rb') as f:
            shutil.copyfileobj(f, self.wfile)

        # Cleanup
        shutil.rmtree(tmp, ignore_errors=True)
        del sessions[session_id]


if __name__ == '__main__':
    print(f'\n  Music UI Render')
    print(f'  ───────────────────────')
    print(f'  Server running at http://localhost:{PORT}')
    print(f'  Press Ctrl+C to stop\n')

    # Avoid opening a browser in cloud environments like Render or Heroku
    if not os.environ.get('RENDER') and not os.environ.get('DYNO'):
        try:
            webbrowser.open(f'http://localhost:{PORT}')
        except:
            pass

    try:
        HTTPServer(('', PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped.')
        # Cleanup any remaining temp dirs
        for tmp in sessions.values():
            shutil.rmtree(tmp, ignore_errors=True)