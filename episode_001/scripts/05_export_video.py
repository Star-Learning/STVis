"""
Step 5: Build the frontend, export deterministic frames, and assemble a video.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import yaml

def load_config(config_path: Path) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def resolve_npm() -> str:
    for candidate in ("npm.cmd", "npm"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise SystemExit("npm was not found in PATH.")


def resolve_ffmpeg() -> str:
    resolved = shutil.which("ffmpeg")
    if resolved:
        return resolved
    raise SystemExit("ffmpeg was not found in PATH.")


def wait_for_http(url: str, timeout_s: float) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if 200 <= response.status < 500:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.5)
    raise SystemExit(f"Preview server did not become ready in time: {url}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the GDP visualization to an MP4 video")
    parser.add_argument("--config", default="configs/default.yaml")
    parser.add_argument("--frames-dir", default="outputs/frames")
    parser.add_argument("--output", default="outputs/video/episode_001_world_gdp_shift.mp4")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--fps", type=int, default=None)
    parser.add_argument("--mode", default=None, help="Optional visualization mode override")
    parser.add_argument("--hold-ms", type=int, default=1500, help="Hold the last frame for this many milliseconds")
    parser.add_argument("--skip-build", action="store_true")
    args = parser.parse_args()

    root = Path(args.config).resolve().parent.parent
    viz_dir = root / "viz"
    frames_dir = (root / args.frames_dir).resolve()
    output_path = (root / args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frames_dir.mkdir(parents=True, exist_ok=True)

    config = load_config(Path(args.config).resolve())
    output_cfg = config.get("output", {})
    render_cfg = output_cfg.get("landscape", {})
    fps = int(args.fps or output_cfg.get("fps", 30))
    width = int(render_cfg.get("width", 1920))
    height = int(render_cfg.get("height", 1080))

    npm_cmd = resolve_npm()
    ffmpeg_cmd = resolve_ffmpeg()

    if not args.skip_build:
        subprocess.run([npm_cmd, "run", "build"], cwd=viz_dir, check=True)

    preview_url = f"http://{args.host}:{args.port}"
    preview_process = subprocess.Popen(
        [npm_cmd, "run", "preview", "--", "--host", args.host, "--port", str(args.port)],
        cwd=viz_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        wait_for_http(preview_url, timeout_s=30)

        export_command = [
            npm_cmd,
            "run",
            "export",
            "--",
            "--url",
            preview_url,
            "--output-dir",
            str(frames_dir),
            "--fps",
            str(fps),
            "--width",
            str(width),
            "--height",
            str(height),
            "--hold-ms",
            str(args.hold_ms),
        ]
        if args.mode:
            export_command.extend(["--mode", args.mode])

        subprocess.run(export_command, cwd=viz_dir, check=True)

    finally:
        preview_process.terminate()
        try:
            preview_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            preview_process.kill()
            preview_process.wait(timeout=5)

    frame_pattern = frames_dir / "frame_%05d.png"
    ffmpeg_command = [
        ffmpeg_cmd,
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(frame_pattern),
        "-c:v",
        output_cfg.get("codec", "libx264"),
        "-pix_fmt",
        "yuv420p",
        str(output_path),
    ]
    subprocess.run(ffmpeg_command, check=True)

    print(f"Wrote video to {output_path}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode) from error
    except KeyboardInterrupt:
        raise SystemExit(130)
