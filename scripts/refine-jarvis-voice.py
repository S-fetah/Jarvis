"""
Refine J.A.R.V.I.S. Voice Cloning to match uploaded master template
"""
import os
import sys
import time
import subprocess
import tempfile
import torch
import soundfile
import numpy as np
import librosa
from scipy.spatial.distance import cosine

ref_master = os.path.abspath(r"C:\Users\abdelfetah safiddine\.gemini\antigravity\brain\7528fe2f-d45c-4851-b2ce-b126ab577fe2\.user_uploaded\uploaded_media_1794835742549.mp3")

text_test = (
    "Good morning, sir. The project we were working on yesterday is almost complete, "
    "but we've encountered a small issue. I've come up with a few possible solutions, "
    "and I'd like to verify them with you before proceeding. Would you like to go through them?"
)

def evaluate_audio(gen_path, ref_path):
    y_ref, sr = librosa.load(ref_path, sr=24000)
    y_gen, _ = librosa.load(gen_path, sr=24000)
    
    # MFCC similarity
    mfcc_ref = np.mean(librosa.feature.mfcc(y=y_ref, sr=sr, n_mfcc=20), axis=1)
    mfcc_gen = np.mean(librosa.feature.mfcc(y=y_gen, sr=sr, n_mfcc=20), axis=1)
    sim = (1.0 - cosine(mfcc_ref, mfcc_gen)) * 100.0
    
    # Pitch
    f0_ref, _, _ = librosa.pyin(y_ref, fmin=60, fmax=400, sr=sr)
    f0_gen, _, _ = librosa.pyin(y_gen, fmin=60, fmax=400, sr=sr)
    f0_ref_c = f0_ref[~np.isnan(f0_ref)]
    f0_gen_c = f0_gen[~np.isnan(f0_gen)]
    
    pitch_ref = np.mean(f0_ref_c) if len(f0_ref_c) > 0 else 0
    pitch_gen = np.mean(f0_gen_c) if len(f0_gen_c) > 0 else 0
    
    # Energy in bands
    spec_gen = np.abs(librosa.stft(y_gen))
    freqs = librosa.fft_frequencies(sr=24000)
    low_idx = (freqs >= 60) & (freqs < 300)
    high_idx = (freqs >= 3000) & (freqs < 12000)
    total = np.sum(spec_gen) + 1e-6
    low_pct = np.sum(spec_gen[low_idx, :]) / total * 100
    high_pct = np.sum(spec_gen[high_idx, :]) / total * 100
    
    return {
        "similarity": sim,
        "pitch_gen": pitch_gen,
        "pitch_delta": abs(pitch_gen - pitch_ref),
        "low_pct": low_pct,
        "high_pct": high_pct,
        "duration": len(y_gen) / sr
    }

def main():
    print(f"[Refine Jarvis] Master template: {ref_master} (exists: {os.path.exists(ref_master)})")
    
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ckpt_dir = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "checkpoints_v2", "converter")
    config_path = os.path.join(ckpt_dir, "config.json")
    checkpoint_path = os.path.join(ckpt_dir, "checkpoint.pth")
    
    from openvoice_cli.api import ToneColorConverter
    converter = ToneColorConverter(config_path, device="cpu")
    converter.watermark_model = None
    converter.load_ckpt(checkpoint_path)
    
    # Convert master mp3 to clean 24k wav for extraction
    ref_wav_24k = os.path.join(tempfile.gettempdir(), "jarvis_master_24k.wav")
    subprocess.run(["ffmpeg", "-y", "-i", ref_master, "-ar", "24000", "-ac", "1", ref_wav_24k], capture_output=True, check=True)
    
    # Extract target SE directly from master template
    print("[Refine Jarvis] Extracting high-resolution SE directly from user uploaded master clip...")
    target_se = converter.extract_se([ref_wav_24k])
    
    # Save the refined target SE to model directory
    refined_se_path = os.path.join(repo_root, "packages", "voice", "models", "openvoice", "jarvis_target_se.pth")
    torch.save(target_se, refined_se_path)
    print(f"[Refine Jarvis] Saved refined target SE to {refined_se_path}")
    
    import edge_tts
    import asyncio
    
    test_configs = [
        # (name, base_voice, rate, pitch, tau, eq_apply)
        ("ryan_tau0.0_rate-5", "en-GB-RyanNeural", "-5%", "+0Hz", 0.0, False),
        ("ryan_tau0.0_rate-8_warm", "en-GB-RyanNeural", "-8%", "+0Hz", 0.0, True),
        ("ryan_tau0.05_rate-5", "en-GB-RyanNeural", "-5%", "+0Hz", 0.05, False),
        ("thomas_tau0.0_rate-5", "en-GB-ThomasNeural", "-5%", "+0Hz", 0.0, False),
        ("thomas_tau0.0_rate-8_warm", "en-GB-ThomasNeural", "-8%", "+0Hz", 0.0, True),
        ("alfie_tau0.0_rate-5", "en-GB-AlfieNeural", "-5%", "+0Hz", 0.0, False),
    ]
    
    out_dir = os.path.join(repo_root, "docs", "voice-samples", "refinements")
    os.makedirs(out_dir, exist_ok=True)
    
    results = []
    
    for name, base_voice, rate, pitch_adj, tau, eq_apply in test_configs:
        print(f"\n--- Testing configuration: {name} (voice={base_voice}, rate={rate}, tau={tau}, warmEQ={eq_apply}) ---")
        with tempfile.TemporaryDirectory() as tmpdir:
            base_mp3 = os.path.join(tmpdir, "base.mp3")
            base_wav = os.path.join(tmpdir, "base.wav")
            conv_wav = os.path.join(tmpdir, "conv.wav")
            final_wav = os.path.join(out_dir, f"{name}.wav")
            
            async def gen():
                comm = edge_tts.Communicate(text_test, base_voice, rate=rate, pitch=pitch_adj)
                await comm.save(base_mp3)
            asyncio.run(gen())
            
            subprocess.run(["ffmpeg", "-y", "-i", base_mp3, "-ar", "24000", "-ac", "1", base_wav], capture_output=True, check=True)
            source_se = converter.extract_se([base_wav])
            
            # Tone convert with specified tau
            converter.convert(
                audio_src_path=base_wav,
                src_se=source_se,
                tgt_se=target_se,
                output_path=conv_wav,
                tau=tau
            )
            
            if eq_apply:
                # Apply subtle J.A.R.V.I.S. vocal acoustic curve:
                # 1. Low-shelf boost at 180Hz +2.5dB for chest resonance
                # 2. Gentle dip at 3500Hz -1.5dB to eliminate metallic sibilance
                # 3. High-shelf at 8000Hz -2.0dB for warm broadcast timbre
                # 4. Soft-knee compression for even butler composure
                eq_filter = (
                    "bass=g=2.5:f=180,"
                    "equalizer=f=3500:width_type=q:w=1.2:g=-1.5,"
                    "treble=g=-2.0:f=8000,"
                    "acompressor=threshold=-18dB:ratio=2.5:attack=20:release=150"
                )
                subprocess.run(
                    ["ffmpeg", "-y", "-i", conv_wav, "-af", eq_filter, final_wav],
                    capture_output=True,
                    check=True
                )
            else:
                subprocess.run(["ffmpeg", "-y", "-i", conv_wav, final_wav], capture_output=True, check=True)
                
            stats = evaluate_audio(final_wav, ref_wav_24k)
            print(f"  Similarity: {stats['similarity']:.2f}%")
            print(f"  Pitch: {stats['pitch_gen']:.1f} Hz (Delta: {stats['pitch_delta']:.1f} Hz)")
            print(f"  Low energy: {stats['low_pct']:.1f}% (Ref: 22.1%), High energy: {stats['high_pct']:.1f}% (Ref: 17.8%)")
            print(f"  Duration: {stats['duration']:.2f}s (Ref: 15.31s)")
            results.append((name, stats, final_wav))

    print("\n=== REFINEMENT RANKINGS ===")
    results.sort(key=lambda x: x[1]['similarity'], reverse=True)
    for rank, (name, stats, path) in enumerate(results, 1):
        print(f"#{rank} {name}: Similarity={stats['similarity']:.2f}%, PitchDelta={stats['pitch_delta']:.1f}Hz, LowBand={stats['low_pct']:.1f}%, Output={path}")

    # Copy winning audio to docs/voice-samples/jarvis-master-refined.wav
    winner_name, winner_stats, winner_path = results[0]
    master_refined = os.path.join(repo_root, "docs", "voice-samples", "jarvis-master-refined.wav")
    master_refined_mp3 = os.path.join(repo_root, "docs", "voice-samples", "jarvis-master-refined.mp3")
    subprocess.run(["ffmpeg", "-y", "-i", winner_path, master_refined], capture_output=True, check=True)
    subprocess.run(["ffmpeg", "-y", "-i", winner_path, "-b:a", "192k", master_refined_mp3], capture_output=True, check=True)
    print(f"\n[Refine Jarvis] Best refined configuration '{winner_name}' saved to {master_refined}!")

if __name__ == "__main__":
    main()
