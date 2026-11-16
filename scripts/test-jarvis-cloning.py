"""
Test and Benchmark J.A.R.V.I.S. Voice Cloning using Pocket TTS and Reference Audio
"""
import os
import sys
import time

def main():
    print("[Jarvis Voice Clone] Checking pocket-tts import...")
    try:
        import pocket_tts
        print(f"[Jarvis Voice Clone] pocket_tts version: {getattr(pocket_tts, '__version__', 'unknown')}")
        print(f"[Jarvis Voice Clone] pocket_tts exports: {dir(pocket_tts)}")
    except ImportError as e:
        print(f"[Jarvis Voice Clone] Error importing pocket_tts: {e}")
        return 1

    ref_audio_1 = os.path.abspath("docs/jarvis-reference-audio/jarvis-sample-1-24k.wav")
    ref_audio_2 = os.path.abspath("docs/jarvis-reference-audio/jarvis-sample-2-24k.wav")
    out_dir = os.path.abspath("docs/voice-samples")
    os.makedirs(out_dir, exist_ok=True)

    print(f"[Jarvis Voice Clone] Reference sample 1: {ref_audio_1} (exists: {os.path.exists(ref_audio_1)})")
    print(f"[Jarvis Voice Clone] Reference sample 2: {ref_audio_2} (exists: {os.path.exists(ref_audio_2)})")

    # Inspect TTSModel or TTS interface
    if hasattr(pocket_tts, "TTSModel"):
        print("[Jarvis Voice Clone] Loading TTSModel...")
        t0 = time.time()
        model = pocket_tts.TTSModel.load_model()
        print(f"[Jarvis Voice Clone] Model loaded in {time.time() - t0:.2f}s")
        
        # Test voice state extraction
        print(f"[Jarvis Voice Clone] Extracting voice state from {ref_audio_1}...")
        voice_state = model.get_state_for_audio_prompt(ref_audio_1)
        print(f"[Jarvis Voice Clone] Voice state extracted successfully: {type(voice_state)}")

        test_sentences = [
            ("sample-1-evening.wav", "Good evening, sir. All automated systems and workspace tasks are operating at optimal efficiency."),
            ("sample-2-flight.wav", "I have detected three potential optimizations in the flight path, Mr. Stark. Would you like me to engage them?"),
            ("sample-3-service.wav", "At your service, sir. How may I assist you today?")
        ]

        import scipy.io.wavfile

        for fname, text in test_sentences:
            out_path = os.path.join(out_dir, fname)
            print(f"[Jarvis Voice Clone] Synthesizing: '{text}'...")
            t_gen = time.time()
            audio = model.generate_audio(voice_state, text)
            gen_time = time.time() - t_gen
            
            # audio tensor to numpy
            if hasattr(audio, "numpy"):
                audio_np = audio.numpy()
            elif hasattr(audio, "cpu"):
                audio_np = audio.cpu().numpy()
            else:
                audio_np = audio

            sample_rate = getattr(model, "sample_rate", 24000)
            scipy.io.wavfile.write(out_path, sample_rate, audio_np)
            dur = len(audio_np) / sample_rate
            rtf = gen_time / dur if dur > 0 else 0
            print(f"[Jarvis Voice Clone] Saved: {out_path} ({dur:.2f}s audio in {gen_time:.2f}s, RTF: {rtf:.2f}x)")

    elif hasattr(pocket_tts, "PocketTTS"):
        print("[Jarvis Voice Clone] Found PocketTTS class, inspecting...")
    else:
        print(f"[Jarvis Voice Clone] Investigating pocket_tts members: {[m for m in dir(pocket_tts) if not m.startswith('_')]}")

    return 0

if __name__ == "__main__":
    sys.exit(main())
