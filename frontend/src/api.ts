import type {
  AskResponse,
  AuthPayload,
  AuthResponse,
  DashboardResponse,
  DocumentListResponse,
  ProgressResponse,
  RecommendationItem,
  SessionState,
  UploadResponse,
} from "./types";

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function fetchStatus() {
  return request<{ status: string }>("/api/health");
}

export function fetchSession() {
  return request<SessionState>("/api/auth/session");
}

export function registerUser(payload: AuthPayload & { name: string }) {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: AuthPayload) {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutUser() {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchDashboard() {
  return request<DashboardResponse>("/api/dashboard");
}

export function fetchDocuments() {
  return request<DocumentListResponse>("/api/documents");
}

export function fetchProgress() {
  return request<ProgressResponse>("/api/progress");
}

export function fetchRecommendations() {
  return request<RecommendationItem[]>("/api/recommendations");
}

export function askQuestion(question: string) {
  return request<AskResponse>("/api/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export function uploadDocument(file: File, courseName: string) {
  const formData = new FormData();
  formData.append("course_name", courseName);
  formData.append("file", file);

  return request<UploadResponse>("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}
