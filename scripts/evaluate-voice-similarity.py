"""
Evaluate acoustic similarity between reference J.A.R.V.I.S. audio and cloned output
"""
import os
import sys
import numpy as np
import librosa
from scipy.spatial.distance import cosine

def analyze_audio(path):
    y, sr = librosa.load(path, sr=24000)
    # Pitch (f0)
    f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C6'), sr=sr)
    f0_clean = f0[~np.isnan(f0)]
    mean_f0 = float(np.mean(f0_clean)) if len(f0_clean) > 0 else 0.0
    std_f0 = float(np.std(f0_clean)) if len(f0_clean) > 0 else 0.0
    
    # MFCC timbre representation
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    
    # Spectral centroid (brightness / vocal warmth)
    spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)
    mean_cent = float(np.mean(spec_cent))
    
    return {
        "path": os.path.basename(path),
        "duration": len(y) / sr,
        "mean_f0": mean_f0,
        "std_f0": std_f0,
        "mfcc_mean": mfcc_mean,
        "mean_centroid": mean_cent,
        "rms": float(np.mean(librosa.feature.rms(y=y)))
    }

def main():
    ref_path = "docs/jarvis-reference-audio/jarvis-sample-1-24k.wav"
    cloned_paths = [
        "docs/voice-samples/jarvis-cloned-1.wav",
        "docs/voice-samples/jarvis-cloned-2.wav",
        "docs/voice-samples/jarvis-cloned-3.wav",
        "docs/voice-samples/base-jarvis-cloned-1.wav"
    ]
    
    ref_stats = analyze_audio(ref_path)
    print(f"=== Reference J.A.R.V.I.S. Audio Profile ({ref_stats['path']}) ===")
    print(f"  Duration: {ref_stats['duration']:.2f}s")
    print(f"  Fundamental Pitch (F0): {ref_stats['mean_f0']:.1f} Hz (std: {ref_stats['std_f0']:.1f} Hz)")
    print(f"  Spectral Centroid (Timbre Brightness): {ref_stats['mean_centroid']:.1f} Hz")
    print(f"  RMS Energy: {ref_stats['rms']:.4f}\n")
    
    print("=== Comparison Against Generated Samples ===")
    for path in cloned_paths:
        if not os.path.exists(path):
            continue
        stats = analyze_audio(path)
        # Cosine similarity on 20-dim MFCC acoustic timbre vector
        cos_dist = cosine(ref_stats["mfcc_mean"], stats["mfcc_mean"])
        timbre_similarity = (1.0 - cos_dist) * 100.0
        pitch_delta = abs(stats["mean_f0"] - ref_stats["mean_f0"])
        
        print(f"Sample: {stats['path']}")
        print(f"  Duration: {stats['duration']:.2f}s")
        print(f"  Pitch: {stats['mean_f0']:.1f} Hz (delta: {pitch_delta:.1f} Hz)")
        print(f"  Spectral Centroid: {stats['mean_centroid']:.1f} Hz")
        print(f"  Timbre Cosine Similarity to Reference: {timbre_similarity:.2f}%")
        print("-" * 50)

if __name__ == "__main__":
    main()
