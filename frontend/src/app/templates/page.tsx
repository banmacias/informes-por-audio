"use client";

import { useEffect, useState } from "react";
import { api, type Template } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const SESSION_TYPE_OPTIONS = [
  { value: "any", labelKey: "templates_type_any" },
  { value: "parent_session", labelKey: "templates_type_parent" },
  { value: "team_meeting", labelKey: "templates_type_team" },
] as const;

interface FormState {
  name: string;
  description: string;
  session_type: string;
  content: string;
}

const EMPTY_FORM: FormState = { name: "", description: "", session_type: "any", content: "" };

export default function TemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .listTemplates()
      .then(setTemplates)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setForm(EMPTY_FORM);
    setEditingId("new");
    setError("");
  };

  const startEdit = (t: Template) => {
    setForm({
      name: t.name,
      description: t.description || "",
      session_type: t.session_type,
      content: t.content,
    });
    setEditingId(t.id);
    setError("");
  };

  const cancel = () => {
    setEditingId(null);
    setError("");
  };

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      setError("El nombre y las instrucciones son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId === "new") {
        await api.createTemplate({
          name: form.name,
          content: form.content,
          session_type: form.session_type,
          description: form.description || undefined,
        });
      } else if (editingId !== null) {
        await api.updateTemplate(editingId, {
          name: form.name,
          content: form.content,
          session_type: form.session_type,
          description: form.description || undefined,
        });
      }
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t("templates_confirm_delete"))) return;
    try {
      await api.deleteTemplate(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("templates_title")}</h1>
        {editingId === null && (
          <button
            onClick={startNew}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + {t("templates_new")}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      {/* Form: create or edit */}
      {editingId !== null && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editingId === "new" ? t("templates_new") : t("templates_edit")}
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("templates_name")}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("templates_description")}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("templates_type")}</label>
              <select
                value={form.session_type}
                onChange={(e) => setForm({ ...form, session_type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SESSION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("templates_content")}</label>
              <p className="text-xs text-gray-400 mb-1">
                Usa <code className="bg-gray-100 px-1 rounded">{"{patient_name}"}</code> y{" "}
                <code className="bg-gray-100 px-1 rounded">{"{date}"}</code> como variables.
              </p>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg text-sm"
            >
              {saving ? "Guardando..." : t("templates_save")}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t("templates_empty")}</p>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{tmpl.name}</span>
                    {tmpl.is_default === 1 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {t("templates_default_badge")}
                      </span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {SESSION_TYPE_OPTIONS.find((o) => o.value === tmpl.session_type)
                        ? t(SESSION_TYPE_OPTIONS.find((o) => o.value === tmpl.session_type)!.labelKey)
                        : tmpl.session_type}
                    </span>
                  </div>
                  {tmpl.description && (
                    <p className="text-sm text-gray-500 mt-1">{tmpl.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2 font-mono truncate">{tmpl.content.slice(0, 80)}…</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(tmpl)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {t("templates_edit")}
                  </button>
                  {tmpl.is_default === 0 && (
                    <button
                      onClick={() => remove(tmpl.id)}
                      className="text-sm text-red-400 hover:text-red-600"
                    >
                      {t("templates_delete")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
