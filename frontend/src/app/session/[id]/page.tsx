"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type Session, type Report } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import ReportEditor from "@/components/ReportEditor";
import ShareModal from "@/components/ShareModal";

export default function SessionDetail() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.id);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "report">("report");

  useEffect(() => {
    api
      .getSession(sessionId)
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      await api.generateReport(sessionId);
      const updated = await api.getSession(sessionId);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating report");
    } finally {
      setGenerating(false);
    }
  };

  const handleReportUpdate = useCallback(
    (updatedReport: Report) => {
      if (session) {
        setSession({ ...session, report: updatedReport });
      }
    },
    [session]
  );

  const handleDelete = async () => {
    if (!confirm(t("confirm_delete"))) return;
    await api.deleteSession(sessionId);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">
        {error || "Session not found"}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <button onClick={() => router.push("/")} className="text-blue-600 text-sm mb-1 hover:underline">
            &larr; {t("nav_sessions")}
          </button>
          <h1 className="text-xl font-bold">{session.title}</h1>
          {session.patient_name && (
            <p className="text-gray-500 text-sm">{session.patient_name}</p>
          )}
          <p className="text-gray-400 text-xs mt-1">
            {new Date(session.created_at).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {session.audio_duration_seconds && ` · ${Math.round(session.audio_duration_seconds / 60)} min`}
          </p>
        </div>
        <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-sm">
          {t("delete")}
        </button>
      </div>

      {/* Tabs */}
      {session.transcript && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab("report")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "report"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {t("session_report")}
          </button>
          <button
            onClick={() => setActiveTab("transcript")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "transcript"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {t("session_transcript")}
          </button>
        </div>
      )}

      {/* Transcript Tab */}
      {activeTab === "transcript" && session.transcript && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h2 className="text-lg font-bold mb-3">{t("session_transcript")}</h2>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {session.transcript.full_text}
          </div>
        </div>
      )}

      {/* Report Tab */}
      {activeTab === "report" && (
        <>
          {session.report ? (
            <ReportEditor report={session.report} onUpdate={handleReportUpdate} />
          ) : session.transcript ? (
            <div className="text-center py-8">
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-8 rounded-xl transition-colors"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generando...
                  </span>
                ) : (
                  t("session_generate_report")
                )}
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">
              No hay transcripción disponible.
            </p>
          )}
        </>
      )}

      {/* Share Button (sticky bottom) */}
      {session.report && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowShare(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-colors"
            >
              {t("session_share")}
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && session.report && (
        <ShareModal
          sessionId={session.id}
          reportText={session.report.content_markdown}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
