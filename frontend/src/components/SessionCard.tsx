"use client";

import Link from "next/link";
import type { Session } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const statusColors: Record<string, string> = {
  recorded: "bg-yellow-100 text-yellow-800",
  transcribed: "bg-blue-100 text-blue-800",
  reported: "bg-green-100 text-green-800",
  shared: "bg-purple-100 text-purple-800",
};

const typeIcons: Record<string, string> = {
  parent_session: "👨‍👩‍👧",
  team_meeting: "👥",
};

export default function SessionCard({ session }: { session: Session }) {
  const { t } = useI18n();
  const date = new Date(session.created_at).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/session/${session.id}`}>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{typeIcons[session.session_type] || "📋"}</span>
              <h3 className="font-semibold text-gray-900 truncate">{session.title}</h3>
            </div>
            {session.patient_name && (
              <p className="text-sm text-gray-500 mb-1">
                {session.patient_name}
              </p>
            )}
            <p className="text-xs text-gray-400">
              {date}
              {session.created_by_name && (
                <span className="ml-2 text-gray-400">· {session.created_by_name.split(" ")[0]}</span>
              )}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[session.status]}`}>
            {t(`status_${session.status}`)}
          </span>
        </div>
        {session.audio_duration_seconds && (
          <p className="text-xs text-gray-400 mt-2">
            {Math.round(session.audio_duration_seconds / 60)} min
          </p>
        )}
      </div>
    </Link>
  );
}
