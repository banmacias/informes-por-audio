"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

interface RecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export default function Recorder({ onRecordingComplete }: RecorderProps) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "recording" | "stopped">("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onRecordingComplete(blob);
        setState("stopped");
      };

      // Collect data every 10 seconds (avoids memory issues on long recordings)
      recorder.start(10000);
      setState("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("No se pudo acceder al micrófono. Por favor, permite el acceso.");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Timer */}
      <div className="text-5xl font-mono font-light text-gray-700 tabular-nums">
        {formatTime(duration)}
      </div>

      {/* Record/Stop Button */}
      {state === "idle" && (
        <button
          onClick={startRecording}
          className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors shadow-lg flex items-center justify-center"
        >
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </button>
      )}

      {state === "recording" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-red-500 animate-pulse">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium">{t("record_recording")}</span>
          </div>
          <button
            onClick={stopRecording}
            className="w-24 h-24 rounded-full bg-gray-700 hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center"
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      )}

      {/* Playback preview */}
      {state === "stopped" && audioUrl && (
        <div className="w-full">
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
