import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || "";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const headers: Record<string, string> = {
    "X-API-Key": API_SECRET,
  };
  if (session?.user?.email) {
    headers["X-User-Email"] = session.user.email;
    headers["X-User-Name"] = session.user.name || session.user.email;
  }
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Sessions
export interface Session {
  id: number;
  title: string;
  session_type: "parent_session" | "team_meeting";
  patient_name: string | null;
  created_at: string;
  audio_filename: string | null;
  audio_duration_seconds: number | null;
  status: "recorded" | "transcribed" | "reported" | "shared";
  created_by_email: string | null;
  created_by_name: string | null;
  transcript?: Transcript | null;
  report?: Report | null;
}

export interface Transcript {
  id: number;
  session_id: number;
  full_text: string;
  language: string;
  service_used: string;
  created_at: string;
}

export interface Report {
  id: number;
  session_id: number;
  content_markdown: string;
  content_html: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: number;
  name: string;
  description: string | null;
  session_type: "parent_session" | "team_meeting" | "any";
  content: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export const api = {
  // Sessions
  listSessions: () => request<Session[]>("/api/sessions"),

  getSession: (id: number) => request<Session>(`/api/sessions/${id}`),

  createSession: (data: {
    title: string;
    session_type: string;
    patient_name?: string;
  }) => request<Session>("/api/sessions", { method: "POST", body: JSON.stringify(data) }),

  deleteSession: (id: number) =>
    request<{ ok: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),

  // Audio
  uploadAudio: async (sessionId: number, audioBlob: Blob, filename: string) => {
    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    const res = await fetch(`${API_URL}/api/audio/upload/${sessionId}`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  transcribe: async (sessionId: number, language = "es") => {
    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    formData.append("language", language);
    const res = await fetch(`${API_URL}/api/audio/transcribe/${sessionId}`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) throw new Error("Transcription failed");
    return res.json() as Promise<Transcript>;
  },

  // Templates
  listTemplates: () => request<Template[]>("/api/templates"),

  createTemplate: (data: { name: string; content: string; session_type?: string; description?: string }) =>
    request<Template>("/api/templates", { method: "POST", body: JSON.stringify(data) }),

  updateTemplate: (id: number, data: Partial<{ name: string; content: string; session_type: string; description: string }>) =>
    request<Template>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteTemplate: (id: number) =>
    request<{ ok: boolean }>(`/api/templates/${id}`, { method: "DELETE" }),

  // Reports
  generateReport: (sessionId: number, templateId?: number) =>
    request<Report>(`/api/reports/generate/${sessionId}`, {
      method: "POST",
      body: JSON.stringify({ template_id: templateId ?? null }),
    }),

  updateReport: (reportId: number, content_markdown: string, content_html?: string) =>
    request<Report>(`/api/reports/${reportId}`, {
      method: "PUT",
      body: JSON.stringify({ content_markdown, content_html }),
    }),

  // Sharing
  sendEmail: (sessionId: number, toEmail: string, subject?: string) =>
    request<{ ok: boolean; email_id: string }>("/api/share/email", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, to_email: toEmail, subject }),
    }),

  getWhatsAppLink: (sessionId: number) =>
    request<{ whatsapp_url: string; full_text: string }>(`/api/share/whatsapp/${sessionId}`),
};
