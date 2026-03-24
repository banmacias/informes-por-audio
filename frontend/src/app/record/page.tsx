"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import Recorder from "@/components/Recorder";

export default function RecordPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [sessionType, setSessionType] = useState<"parent_session" | "team_meeting">("parent_session");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [step, setStep] = useState<"setup" | "record" | "processing">("setup");
  const [status, setStatus] = useState("");

  const handleRecordingComplete = useCallback((blob: Blob) => {
    setAudioBlob(blob);
  }, []);

  const handleStartRecording = () => {
    setStep("record");
  };

  const handleUploadAndTranscribe = async () => {
    if (!audioBlob) return;
    setStep("processing");

    // Generate a placeholder title with today's date
    const today = new Date().toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const placeholderTitle =
      sessionType === "team_meeting"
        ? `Reunión de equipo ${today}`
        : `Sesión ${today}`;

    try {
      // 1. Create session
      setStatus("Creando sesión...");
      const session = await api.createSession({
        title: placeholderTitle,
        session_type: sessionType,
      });

      // 2. Upload audio
      setStatus("Subiendo audio...");
      const ext = audioBlob.type.includes("mp4") ? ".mp4" : ".webm";
      await api.uploadAudio(session.id, audioBlob, `recording${ext}`);

      // 3. Transcribe
      setStatus("Transcribiendo... (esto puede tardar unos minutos)");
      await api.transcribe(session.id, "es");

      // 4. Generate report
      setStatus("Generando informe...");
      await api.generateReport(session.id);

      // 5. Navigate to session
      router.push(`/session/${session.id}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("record");
    }
  };

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-600 text-center">{status}</p>
      </div>
    );
  }

  if (step === "record") {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">
          {sessionType === "team_meeting" ? t("record_type_team") : t("record_type_parent")}
        </h1>

        <Recorder onRecordingComplete={handleRecordingComplete} />

        {audioBlob && (
          <div className="mt-8">
            <button
              onClick={handleUploadAndTranscribe}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-lg"
            >
              {t("record_upload")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Setup step
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("record_title")}</h1>

      <div className="flex flex-col gap-4">
        {/* Session Type Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setSessionType("parent_session")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
              sessionType === "parent_session"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t("record_type_parent")}
          </button>
          <button
            onClick={() => setSessionType("team_meeting")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
              sessionType === "team_meeting"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t("record_type_team")}
          </button>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartRecording}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-lg mt-4"
        >
          {t("record_start")}
        </button>
      </div>
    </div>
  );
}
