import type {
  AskResponse,
  AuthPayload,
  AuthResponse,
  DashboardResponse,
  DeleteDocumentResponse,
  DocumentListResponse,
  ExamStartRequest,
  ExamStartResponse,
  ExamSubmitResponse,
  FlashcardGenerateRequest,
  FlashcardGenerateResponse,
  FlashcardItem,
  FlashcardListResponse,
  ProgressResponse,
  QuizAnswerSubmission,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizSubmitResponse,
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

export function uploadProfileImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return request<AuthResponse>("/api/auth/profile-image", {
    method: "POST",
    body: formData,
  });
}

export function updateProfile(payload: { name: string; preferred_difficulty: "easy" | "medium" | "hard" }) {
  return request<AuthResponse>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchDashboard() {
  return request<DashboardResponse>("/api/dashboard");
}

export function fetchDocuments() {
  return request<DocumentListResponse>("/api/documents");
}

export function deleteDocument(documentId: number) {
  return request<DeleteDocumentResponse>(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
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

export function uploadDocument(file: File, courseName: string, replaceExisting = false) {
  const formData = new FormData();
  formData.append("course_name", courseName);
  formData.append("replace_existing", String(replaceExisting));
  formData.append("file", file);

  return request<UploadResponse>("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export function fetchFlashcards(topic?: string) {
  const suffix = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return request<FlashcardListResponse>(`/api/flashcards${suffix}`);
}

export function generateFlashcards(payload: FlashcardGenerateRequest) {
  return request<FlashcardGenerateResponse>("/api/flashcards/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rateFlashcard(flashcardId: number, rating: "easy" | "medium" | "hard") {
  return request<FlashcardItem>(`/api/flashcards/${flashcardId}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

export function generateQuiz(payload: QuizGenerateRequest) {
  return request<QuizGenerateResponse>("/api/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitQuiz(answers: QuizAnswerSubmission[]) {
  return request<QuizSubmitResponse>("/api/quiz/submit", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function startExam(payload: ExamStartRequest) {
  return request<ExamStartResponse>("/api/exam/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitExam(answers: QuizAnswerSubmission[], durationMinutes: number) {
  return request<ExamSubmitResponse>("/api/exam/submit", {
    method: "POST",
    body: JSON.stringify({ answers, duration_minutes: durationMinutes }),
  });
}
