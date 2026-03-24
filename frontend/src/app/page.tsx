"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { api, type Session } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SessionCard from "@/components/SessionCard";

export default function Dashboard() {
  const { t, lang, switchLang } = useI18n();
  const { data: authSession } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard_title")}</h1>
          {authSession?.user?.name && (
            <p className="text-sm text-gray-400">{authSession.user.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchLang(lang === "es" ? "en" : "es")}
            className="text-sm px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            {lang === "es" ? "EN" : "ES"}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm px-3 py-1 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100"
            title="Cerrar sesión"
          >
            ↩
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-12 text-gray-400">{t("loading")}</div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">
          {t("error")}: {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🎙️</div>
          <p className="text-gray-500">{t("dashboard_empty")}</p>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
