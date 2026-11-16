"""
OpenVoice V2 Standalone CLI Runner for Jarvis
Synthesizes speech using base neural TTS and transforms tone color to J.A.R.V.I.S.
"""
import os
import sys
import argparse
import time
import subprocess
import tempfile
import torch
import soundfile

def main():
    parser = argparse.ArgumentParser(description="Jarvis OpenVoice Synthesis Runner")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--output", required=True, help="Path for output WAV file")
    parser.add_argument("--se", default=None, help="Target speaker embedding path (.pth)")
    parser.add_argument("--ref", default=None, help="Reference audio path if SE not pre-computed")
    parser.add_argument("--base-voice", default="en-GB-RyanNeural", help="Base TTS voice")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed")
    parser.add_argument("--tau", type=float, default=0.3, help="Tone conversion tau")

    args = parser.parse_args()

    # Determine paths and repo root
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    
    # Handle output path: if relative path looks like repo path (e.g. docs/...), resolve against repo root
    output_path = args.output
    if not os.path.isabs(output_path):
        if output_path.startswith("docs") or output_path.startswith("packages"):
            output_path = os.path.join(repo_root, output_path)
        else:
            output_path = os.path.abspath(output_path)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    ckpt_dir = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "checkpoints_v2", "converter")
    default_se_path = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "jarvis_target_se.pth")
    target_se_path = args.se or default_se_path

    config_path = os.path.join(ckpt_dir, "config.json")
    checkpoint_path = os.path.join(ckpt_dir, "checkpoint.pth")

    if not os.path.exists(checkpoint_path):
        from openvoice_cli.downloader import download_checkpoint
        os.makedirs(ckpt_dir, exist_ok=True)
        download_checkpoint(ckpt_dir)

    from openvoice_cli.api import ToneColorConverter

    # Initialize converter on CPU
    converter = ToneColorConverter(config_path, device="cpu")
    converter.watermark_model = None
    converter.load_ckpt(checkpoint_path)

    # Load or extract target speaker embedding
    if os.path.exists(target_se_path):
        target_se = torch.load(target_se_path, map_location="cpu")
    elif args.ref and os.path.exists(args.ref):
        target_se = converter.extract_se([args.ref], se_save_path=target_se_path)
    else:
        # Fallback to reference audio in docs
        ref_default = os.path.join(repo_root, "docs", "jarvis-reference-audio", "jarvis-sample-1-24k.wav")
        if os.path.exists(ref_default):
            target_se = converter.extract_se([ref_default], se_save_path=target_se_path)
        else:
            raise FileNotFoundError(f"Neither target SE ({target_se_path}) nor reference audio found.")

    # 1. Generate base audio using edge-tts into temp files
    import edge_tts
    import asyncio

    with tempfile.TemporaryDirectory() as tmpdir:
        base_wav = os.path.join(tmpdir, "base.wav")
        mp3_tmp = os.path.join(tmpdir, "base.mp3")

        async def gen_base():
            rate_str = f"{int((args.speed - 1.0) * 100):+d}%" if args.speed != 1.0 else "+0%"
            comm = edge_tts.Communicate(args.text, args.base_voice, rate=rate_str)
            await comm.save(mp3_tmp)

        asyncio.run(gen_base())

        # Convert mp3 to 24k mono wav
        subprocess.run(
            ["ffmpeg", "-y", "-i", mp3_tmp, "-ar", "24000", "-ac", "1", base_wav],
            capture_output=True,
            check=True
        )

        # 2. Extract source SE
        source_se = converter.extract_se([base_wav])

        # 3. Convert tone color to J.A.R.V.I.S.
        converter.convert(
            audio_src_path=base_wav,
            src_se=source_se,
            tgt_se=target_se,
            output_path=output_path,
            tau=args.tau
        )

    print(f"[OpenVoice Runner] Output successfully saved: {output_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
