"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api, type Report } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ReportEditorProps {
  report: Report;
  onUpdate: (report: Report) => void;
}

export default function ReportEditor({ report, onUpdate }: ReportEditorProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(report.content_markdown);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setContent(report.content_markdown);
  }, [report]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await api.updateReport(report.id, content);
      onUpdate(updated);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [content, report.id, onUpdate]);

  const handleChange = (value: string) => {
    setContent(value);
    // Auto-save after 2 seconds of inactivity
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => save(), 2000);
  };

  // Simple markdown to display (headers, bold, lists)
  const renderMarkdown = (md: string) => {
    return md
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2 text-blue-900">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2 text-gray-900">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n\n/g, '<br class="mb-2">')
      .replace(/\n/g, "<br>");
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full min-h-[400px] p-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-mono resize-y"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              save();
              setIsEditing(false);
            }}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {saving ? "Guardando..." : t("session_save")}
          </button>
          <button
            onClick={() => {
              setContent(report.content_markdown);
              setIsEditing(false);
            }}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{t("session_report")}</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {t("session_edit_report")}
        </button>
      </div>
      <div
        className="bg-white rounded-xl p-4 border border-gray-100 text-sm leading-relaxed prose-sm"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}
