"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Template } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Source = "write" | "pdf" | "drive";

interface EditorState {
  id: number | "new";
  name: string;
  content: string;
  source: Source;
  driveUrl: string;
  extracting: boolean;
  extractError: string;
}

const EMPTY_EDITOR: EditorState = {
  id: "new",
  name: "",
  content: "",
  source: "write",
  driveUrl: "",
  extracting: false,
  extractError: "",
};

export default function TemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.listTemplates().then(setTemplates).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => setEditor({ ...EMPTY_EDITOR });
  const openEdit = (tmpl: Template) =>
    setEditor({ ...EMPTY_EDITOR, id: tmpl.id, name: tmpl.name, content: tmpl.content });
  const closeEditor = () => { setEditor(null); setSaveError(""); };

  const set = (patch: Partial<EditorState>) =>
    setEditor((prev) => prev ? { ...prev, ...patch } : prev);

  // --- PDF extraction ---
  const handlePdfFile = async (file: File) => {
    set({ extracting: true, extractError: "" });
    try {
      const { text } = await api.extractPdf(file);
      set({ content: text, extracting: false });
    } catch (e) {
      set({ extractError: e instanceof Error ? e.message : "Error", extracting: false });
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePdfFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") handlePdfFile(file);
  };

  // --- Drive extraction ---
  const handleDriveExtract = async () => {
    if (!editor?.driveUrl.trim()) return;
    set({ extracting: true, extractError: "" });
    try {
      const { text } = await api.extractFromDrive(editor.driveUrl.trim());
      set({ content: text, extracting: false });
    } catch (e) {
      set({ extractError: e instanceof Error ? e.message : "Error", extracting: false });
    }
  };

  // --- Save ---
  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim() || !editor.content.trim()) {
      setSaveError("El nombre y el contenido son obligatorios.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (editor.id === "new") {
        await api.createTemplate({ name: editor.name, content: editor.content });
      } else {
        await api.updateTemplate(editor.id, { name: editor.name, content: editor.content });
      }
      closeEditor();
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t("templates_confirm_delete"))) return;
    await api.deleteTemplate(id).catch(() => {});
    load();
  };

  return (
    <>
      {/* List */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("templates_title")}</h1>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + {t("templates_new")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t("templates_empty")}</p>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{tmpl.name}</span>
                    {tmpl.is_default === 1 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {t("templates_default_badge")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                    {tmpl.content.slice(0, 80)}…
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => openEdit(tmpl)} className="text-sm text-blue-600 hover:text-blue-800">
                    {t("templates_edit")}
                  </button>
                  {tmpl.is_default === 0 && (
                    <button onClick={() => remove(tmpl.id)} className="text-sm text-red-400 hover:text-red-600">
                      {t("templates_delete")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gmail-like compose overlay */}
      {editor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end lg:items-center justify-center">
          <div className="bg-white w-full lg:max-w-4xl lg:mx-4 lg:rounded-xl shadow-2xl flex flex-col max-h-[95dvh] lg:max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white lg:rounded-t-xl shrink-0">
              <span className="text-sm font-medium">
                {editor.id === "new" ? t("templates_new") : t("templates_edit")}
              </span>
              <button onClick={closeEditor} className="text-gray-300 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Name field — like email Subject */}
            <div className="flex items-center border-b border-gray-200 px-4 shrink-0">
              <span className="text-sm text-gray-500 w-20 shrink-0">{t("templates_name")}</span>
              <input
                type="text"
                value={editor.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="ej. Informe Ayook"
                className="flex-1 py-3 text-sm outline-none"
              />
            </div>

            {/* Source selector — like email toolbar */}
            <div className="flex border-b border-gray-200 px-4 gap-0 shrink-0">
              {(["write", "pdf", "drive"] as Source[]).map((src) => {
                const labels: Record<Source, string> = {
                  write: "✏️  Escribir",
                  pdf: "📄  Subir PDF",
                  drive: "📁  Google Drive",
                };
                return (
                  <button
                    key={src}
                    onClick={() => set({ source: src, extractError: "" })}
                    className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
                      editor.source === src
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {labels[src]}
                  </button>
                );
              })}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

              {/* PDF source */}
              {editor.source === "pdf" && !editor.content && (
                <div
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="m-4 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-3 py-12 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {editor.extracting ? (
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-4xl">📄</span>
                      <p className="text-sm text-gray-600 text-center">
                        Arrastra un PDF aquí o <span className="text-blue-600 font-medium">haz clic para seleccionar</span>
                      </p>
                      <p className="text-xs text-gray-400">Solo archivos PDF</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={onFileInput} />
                </div>
              )}

              {/* Drive source */}
              {editor.source === "drive" && !editor.content && (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Abre el archivo en Google Drive, copia el enlace y pégalo aquí.
                    Funciona con Google Docs y PDFs compartidos contigo.
                  </p>
                  <input
                    type="url"
                    value={editor.driveUrl}
                    onChange={(e) => set({ driveUrl: e.target.value })}
                    placeholder="https://docs.google.com/document/d/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleDriveExtract}
                    disabled={!editor.driveUrl.trim() || editor.extracting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg flex items-center gap-2"
                  >
                    {editor.extracting && (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    {editor.extracting ? "Extrayendo..." : "Extraer contenido"}
                  </button>
                  <p className="text-xs text-gray-400">
                    El archivo debe estar compartido como &ldquo;Cualquiera con el enlace puede ver&rdquo;.
                  </p>
                </div>
              )}

              {/* Error */}
              {editor.extractError && (
                <p className="mx-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {editor.extractError}
                </p>
              )}

              {/* Textarea — shown for Write tab or after extraction */}
              {(editor.source === "write" || editor.content) && (
                <textarea
                  value={editor.content}
                  onChange={(e) => set({ content: e.target.value })}
                  placeholder="Escribe aquí las instrucciones de la plantilla...&#10;&#10;Puedes usar {patient_name} y {date} como variables."
                  className="flex-1 w-full px-4 py-3 text-sm resize-none outline-none min-h-[260px] lg:min-h-[380px] font-mono leading-relaxed"
                />
              )}
            </div>

            {/* Footer — like Gmail send bar */}
            <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
              <button
                onClick={save}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-6 py-2.5 rounded-full flex items-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? "Guardando..." : t("templates_save")}
              </button>
              <button onClick={closeEditor} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2">
                {t("cancel")}
              </button>
              {saveError && <p className="text-sm text-red-600 ml-2">{saveError}</p>}

              {/* Clear extracted content */}
              {editor.content && editor.source !== "write" && (
                <button
                  onClick={() => set({ content: "", driveUrl: "" })}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  Cambiar fuente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
