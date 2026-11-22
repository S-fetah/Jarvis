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
    parser.add_argument("--text", default=None, help="Text to synthesize")
    parser.add_argument("--text-file", default=None, help="Path to UTF-8 file containing text to synthesize")
    parser.add_argument("--output", required=True, help="Path for output WAV file")
    parser.add_argument("--se", default=None, help="Target speaker embedding path (.pth)")
    parser.add_argument("--ref", default=None, help="Reference audio path if SE not pre-computed")
    parser.add_argument("--base-voice", default="en-GB-RyanNeural", help="Base TTS voice")
    parser.add_argument("--speed", type=float, default=0.95, help="Speech speed (0.95 matches Paul Bettany cadence)")
    parser.add_argument("--tau", type=float, default=0.05, help="Tone conversion tau (0.05 = natural human fluidity)")
    parser.add_argument("--warm-eq", action="store_true", default=True, help="Apply broadcast warmth EQ")

    args = parser.parse_args()

    # Read input text from file or CLI argument
    input_text = ""
    if args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, "r", encoding="utf-8") as f:
            input_text = f.read().strip()
    elif args.text:
        input_text = args.text.strip()
    else:
        if not sys.stdin.isatty():
            input_text = sys.stdin.read().strip()

    if not input_text:
        print("[OpenVoice Runner] Error: No input text provided.", file=sys.stderr)
        return 1

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
    default_source_se_path = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "ryan_source_se.pth")
    target_se_path = args.se or default_se_path

    # Maximize CPU parallelism
    torch.set_num_threads(min(8, os.cpu_count() or 4))

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
        conv_wav = os.path.join(tmpdir, "conv.wav")
        mp3_tmp = os.path.join(tmpdir, "base.mp3")

        async def gen_base():
            rate_delta = int((args.speed - 1.0) * 100)
            rate_str = f"{rate_delta:+d}%" if rate_delta != 0 else "+0%"
            comm = edge_tts.Communicate(input_text, args.base_voice, rate=rate_str, pitch="+0Hz")
            await comm.save(mp3_tmp)

        asyncio.run(gen_base())

        # Convert mp3 to 24k mono wav
        subprocess.run(
            ["ffmpeg", "-y", "-i", mp3_tmp, "-ar", "24000", "-ac", "1", base_wav],
            capture_output=True,
            check=True
        )

        # 2. Extract or load source SE
        if args.base_voice == "en-GB-RyanNeural" and os.path.exists(default_source_se_path):
            source_se = torch.load(default_source_se_path, map_location="cpu")
        else:
            source_se = converter.extract_se([base_wav])

        # 3. Convert tone color to J.A.R.V.I.S.
        with torch.inference_mode():
            converter.convert(
                audio_src_path=base_wav,
                src_se=source_se,
                tgt_se=target_se,
                output_path=conv_wav,
                tau=args.tau
            )

        # 4. Optional cinematic acoustic mastering
        if args.warm_eq:
            eq_filter = (
                "bass=g=1.5:f=180,"
                "equalizer=f=3200:width_type=q:w=1.0:g=-1.0,"
                "treble=g=1.0:f=6500,"
                "acompressor=threshold=-16dB:ratio=2.2:attack=15:release=120"
            )
            subprocess.run(
                ["ffmpeg", "-y", "-i", conv_wav, "-af", eq_filter, output_path],
                capture_output=True,
                check=True
            )
        else:
            import shutil
            shutil.copyfile(conv_wav, output_path)

    print(f"[OpenVoice Runner] Output successfully saved: {output_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
