"""
FastAPI Microservice for Jarvis Voice Cloning using OpenVoice V2
Exposes /health and /synthesize on http://127.0.0.1:8020
"""
import os
import sys
import tempfile
import time
import subprocess
import asyncio
import torch
import soundfile
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="Jarvis OpenVoice Synthesis Service", version="1.0.0")

# Global state
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ckpt_dir = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "checkpoints_v2", "converter")
default_se_path = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "jarvis_target_se.pth")

converter = None
cached_target_se = None

def init_converter():
    global converter, cached_target_se
    if converter is not None:
        return

    from openvoice_cli.api import ToneColorConverter
    from openvoice_cli.downloader import download_checkpoint

    if not os.path.exists(os.path.join(ckpt_dir, "checkpoint.pth")):
        os.makedirs(ckpt_dir, exist_ok=True)
        download_checkpoint(ckpt_dir)

    config_path = os.path.join(ckpt_dir, "config.json")
    checkpoint_path = os.path.join(ckpt_dir, "checkpoint.pth")

    print("[OpenVoice Service] Initializing ToneColorConverter on CPU...")
    t0 = time.time()
    converter = ToneColorConverter(config_path, device="cpu")
    converter.watermark_model = None
    converter.load_ckpt(checkpoint_path)
    print(f"[OpenVoice Service] Converter initialized in {time.time() - t0:.2f}s")

    if os.path.exists(default_se_path):
        cached_target_se = torch.load(default_se_path, map_location="cpu")
        print(f"[OpenVoice Service] Preloaded J.A.R.V.I.S. target SE from {default_se_path}")

class SynthesizeRequest(BaseModel):
    text: str
    base_voice: str = "en-GB-RyanNeural"
    speed: float = 0.95
    speaker_se_path: str | None = None
    speaker_wav_path: str | None = None
    tau: float = 0.0
    warm_eq: bool = True

@app.on_event("startup")
def on_startup():
    init_converter()

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "openvoice-v2",
        "persona": "J.A.R.V.I.S.",
        "sample_rate": 24000,
        "model_loaded": converter is not None
    }

@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    global converter, cached_target_se
    init_converter()

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    import edge_tts

    with tempfile.TemporaryDirectory() as tmpdir:
        base_mp3 = os.path.join(tmpdir, "base.mp3")
        base_wav = os.path.join(tmpdir, "base.wav")
        out_wav = os.path.join(tmpdir, "out.wav")

        rate_str = f"{int((req.speed - 1.0) * 100):+d}%" if req.speed != 1.0 else "+0%"
        comm = edge_tts.Communicate(req.text, req.base_voice, rate=rate_str)
        await comm.save(base_mp3)

        subprocess.run(
            ["ffmpeg", "-y", "-i", base_mp3, "-ar", "24000", "-ac", "1", base_wav],
            capture_output=True,
            check=True
        )

        # Determine target SE
        if req.speaker_se_path and os.path.exists(req.speaker_se_path):
            target_se = torch.load(req.speaker_se_path, map_location="cpu")
        elif req.speaker_wav_path and os.path.exists(req.speaker_wav_path):
            target_se = converter.extract_se([req.speaker_wav_path])
        elif cached_target_se is not None:
            target_se = cached_target_se
        else:
            ref_default = os.path.join(repo_root, "docs", "jarvis-reference-audio", "jarvis-sample-1-24k.wav")
            target_se = converter.extract_se([ref_default])

        # Extract source SE
        source_se = converter.extract_se([base_wav])

        # Convert
        converter.convert(
            audio_src_path=base_wav,
            src_se=source_se,
            tgt_se=target_se,
            output_path=out_wav,
            tau=req.tau
        )

        final_path = out_wav
        if req.warm_eq:
            eq_wav = os.path.join(tmpdir, "eq.wav")
            eq_filter = (
                "bass=g=2.5:f=180,"
                "equalizer=f=3500:width_type=q:w=1.2:g=-1.5,"
                "treble=g=-2.0:f=8000,"
                "acompressor=threshold=-18dB:ratio=2.5:attack=20:release=150"
            )
            subprocess.run(
                ["ffmpeg", "-y", "-i", out_wav, "-af", eq_filter, eq_wav],
                capture_output=True,
                check=True
            )
            final_path = eq_wav

        with open(final_path, "rb") as f:
            audio_bytes = f.read()

        return Response(content=audio_bytes, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8020)
