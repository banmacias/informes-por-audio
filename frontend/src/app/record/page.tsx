"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import Recorder from "@/components/Recorder";

export default function RecordPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [patientName, setPatientName] = useState("");
  const [sessionType, setSessionType] = useState<"parent_session" | "team_meeting">("parent_session");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [step, setStep] = useState<"setup" | "record" | "processing">("setup");
  const [status, setStatus] = useState("");

  const handleRecordingComplete = useCallback((blob: Blob) => {
    setAudioBlob(blob);
  }, []);

  const handleStartRecording = () => {
    if (!title.trim()) return;
    setStep("record");
  };

  const handleUploadAndTranscribe = async () => {
    if (!audioBlob) return;
    setStep("processing");

    try {
      // 1. Create session
      setStatus("Creando sesión...");
      const session = await api.createSession({
        title: title.trim(),
        session_type: sessionType,
        patient_name: patientName.trim() || undefined,
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
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        {patientName && <p className="text-gray-500 mb-6">{patientName}</p>}

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

        {/* Title */}
        <input
          type="text"
          placeholder={t("record_session_title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
        />

        {/* Patient Name (only for parent sessions) */}
        {sessionType === "parent_session" && (
          <input
            type="text"
            placeholder={t("record_patient_name")}
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        )}

        {/* Start Button */}
        <button
          onClick={handleStartRecording}
          disabled={!title.trim()}
          className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-lg mt-4"
        >
          {t("record_start")}
        </button>
      </div>
    </div>
  );
}
