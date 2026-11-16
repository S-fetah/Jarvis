"""
J.A.R.V.I.S. High-Fidelity Voice Synthesis via OpenVoice Tone Color Converter
Combines base neural British RP TTS with OpenVoice V2 Tone Color Transformation
using uploaded reference audio samples:
  - docs/jarvis-reference-audio/jarvis-sample-1-24k.wav
  - docs/jarvis-reference-audio/jarvis-sample-2-24k.wav
"""
import os
import sys
import time
import torch
import soundfile
import numpy as np

def main():
    print("[OpenVoice Jarvis] Initializing OpenVoice tone color conversion...")
    
    ref_1 = os.path.abspath("docs/jarvis-reference-audio/jarvis-sample-1-24k.wav")
    ref_2 = os.path.abspath("docs/jarvis-reference-audio/jarvis-sample-2-24k.wav")
    out_dir = os.path.abspath("docs/voice-samples")
    os.makedirs(out_dir, exist_ok=True)
    
    from openvoice_cli.downloader import download_checkpoint
    from openvoice_cli.api import ToneColorConverter
    
    ckpt_dir = os.path.abspath("packages/voice/models/openvoice/checkpoints_v2/converter")
    os.makedirs(ckpt_dir, exist_ok=True)
    download_checkpoint(ckpt_dir)
    
    config_path = os.path.join(ckpt_dir, "config.json")
    checkpoint_path = os.path.join(ckpt_dir, "checkpoint.pth")
    
    print("[OpenVoice Jarvis] Loading ToneColorConverter on CPU...")
    t0 = time.time()
    converter = ToneColorConverter(config_path, device="cpu")
    converter.watermark_model = None  # disable watermark
    converter.load_ckpt(checkpoint_path)
    print(f"[OpenVoice Jarvis] Converter loaded in {time.time() - t0:.2f}s")
    
    # Extract combined target speaker embedding from both reference samples
    target_se_path = os.path.abspath("packages/voice/models/openvoice/jarvis_target_se.pth")
    print(f"[OpenVoice Jarvis] Extracting J.A.R.V.I.S. speaker embedding from reference audio...")
    t_se = time.time()
    target_se = converter.extract_se([ref_1, ref_2], se_save_path=target_se_path)
    print(f"[OpenVoice Jarvis] Target SE extracted and saved to {target_se_path} in {time.time() - t_se:.2f}s (shape: {target_se.shape})")
    
    # Test sentences
    test_phrases = [
        ("jarvis-cloned-1.wav", "Good evening, sir. All automated systems and workspace tasks are operating at optimal efficiency."),
        ("jarvis-cloned-2.wav", "I have detected three potential optimizations in the flight path, Mr. Stark. Would you like me to engage them?"),
        ("jarvis-cloned-3.wav", "At your service, sir. The core diagnostic protocol is complete and all nodes are functioning within normal parameters.")
    ]
    
    import edge_tts
    import asyncio
    import subprocess
    
    async def gen_edge(text, path, voice="en-GB-RyanNeural"):
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(path)

    for fname, text in test_phrases:
        base_wav = os.path.join(out_dir, f"base-{fname}")
        final_wav = os.path.join(out_dir, fname)
        final_mp3 = os.path.join(out_dir, fname.replace(".wav", ".mp3"))
        
        # 1. Synthesize base British RP voice
        print(f"\n[OpenVoice Jarvis] --- Generating: {fname} ---")
        print(f"[OpenVoice Jarvis] Text: '{text}'")
        mp3_tmp = base_wav.replace(".wav", ".mp3")
        asyncio.run(gen_edge(text, mp3_tmp, "en-GB-RyanNeural"))
        subprocess.run(["ffmpeg", "-y", "-i", mp3_tmp, "-ar", "24000", "-ac", "1", base_wav], capture_output=True)
        if os.path.exists(mp3_tmp):
            try: os.remove(mp3_tmp)
            except: pass
            
        # 2. Extract source speaker embedding from base audio
        t_src = time.time()
        source_se = converter.extract_se([base_wav])
        print(f"[OpenVoice Jarvis] Source SE extracted in {time.time() - t_src:.2f}s")
        
        # 3. Tone color conversion to J.A.R.V.I.S.
        print(f"[OpenVoice Jarvis] Converting timbre/tone color to J.A.R.V.I.S....")
        t_conv = time.time()
        converter.convert(
            audio_src_path=base_wav,
            src_se=source_se,
            tgt_se=target_se,
            output_path=final_wav,
            tau=0.3
        )
        conv_time = time.time() - t_conv
        
        # Also generate an MP3 copy for web playback
        subprocess.run(["ffmpeg", "-y", "-i", final_wav, "-b:a", "192k", final_mp3], capture_output=True)
        
        data, sr = soundfile.read(final_wav)
        dur = len(data) / sr
        rtf = conv_time / dur if dur > 0 else 0
        print(f"[OpenVoice Jarvis] [SUCCESS] Output generated:")
        print(f"  WAV: {final_wav} ({dur:.2f}s audio, converted in {conv_time:.2f}s, RTF: {rtf:.2f}x)")
        print(f"  MP3: {final_mp3}")

    print("\n[OpenVoice Jarvis] ALL 3 J.A.R.V.I.S. SAMPLES SUCCESSFULLY GENERATED!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
