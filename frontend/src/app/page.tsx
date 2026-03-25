"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { api, type Session } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SessionCard from "@/components/SessionCard";

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { t, lang, switchLang } = useI18n();
  const { data: authSession } = useSession();
  const searchParams = useSearchParams();
  const newId = searchParams.get("new") ? Number(searchParams.get("new")) : null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBanner, setShowBanner] = useState(!!newId);
  const newCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Scroll to new card and auto-dismiss banner
  useEffect(() => {
    if (!newId || loading) return;
    setTimeout(() => {
      newCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    const timer = setTimeout(() => setShowBanner(false), 5000);
    return () => clearTimeout(timer);
  }, [newId, loading]);

  return (
    <div>
      {/* Success banner */}
      {showBanner && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-4 shadow-sm">
          <span className="text-xl">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Sesión guardada exitosamente</p>
            <p className="text-xs text-green-600">El audio fue transcrito y el informe generado.</p>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-green-500 hover:text-green-700 text-lg leading-none shrink-0"
          >
            ✕
          </button>
        </div>
      )}

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
          {sessions.map((session) => {
            const isNew = session.id === newId;
            return (
              <div key={session.id} ref={isNew ? newCardRef : undefined}>
                <SessionCard session={session} isNew={isNew} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
