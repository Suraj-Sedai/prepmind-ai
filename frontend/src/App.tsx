import { startTransition, useEffect, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";
import logoMark from "./assets/prepmind-mark.svg";
import {
  askChatThread,
  createChatThread,
  createChatThreadAndAsk,
  deleteDocument,
  deleteChatThread,
  fetchDashboard,
  fetchChatThread,
  fetchChatThreads,
  fetchDocuments,
  fetchFlashcards,
  fetchProgress,
  fetchSession,
  fetchStatus,
  generateFlashcards,
  generateQuiz,
  loginUser,
  logoutUser,
  rateFlashcard,
  registerUser,
  startGoogleLogin,
  submitQuiz,
  updateProfile,
  uploadDocument,
} from "./api";
import type {
  AskResponse,
  ChatMessageItem,
  ChatThreadItem,
  DashboardResponse,
  DocumentItem,
  FlashcardItem,
  ProgressResponse,
  QuizQuestion,
  QuizSubmitResponse,
  User,
} from "./types";
import { Icon } from "./components/common/Icon";
import type { IconName } from "./components/common/Icon";
import { Layout } from "./components/layout/Layout";
import type { ViewKey } from "./components/layout/Sidebar";
import { useThemePreference } from "./hooks/useThemePreference";
import type { ThemePreference } from "./hooks/useThemePreference";

type AuthMode = "login" | "register";
type Difficulty = "easy" | "medium" | "hard";
type MaterialFilter = "all" | "pdf" | "docx" | "txt" | "md";
type WorkspaceSnapshot = {
  documents: DocumentItem[];
  flashcards: FlashcardItem[];
  dashboard: DashboardResponse | null;
  progress: ProgressResponse | null;
  chatThreads: ChatThreadItem[];
};

const views: Array<{ key: ViewKey; label: string; icon: IconName }> = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "materials", label: "Materials", icon: "upload" },
  { key: "chat", label: "AI Chat", icon: "chat" },
  { key: "flashcards", label: "Flashcards", icon: "cards" },
  { key: "quizzes", label: "Quizzes", icon: "quiz" },
  { key: "progress", label: "Progress", icon: "trend" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const materialFilters: Array<{ key: MaterialFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "Docs" },
  { key: "txt", label: "Text" },
  { key: "md", label: "MD" },
];

const sampleStudyCards = [
  { subject: "Biology", title: "Photosynthesis", progress: 68 },
  { subject: "Computer Science", title: "Data Structures", progress: 45 },
  { subject: "Anatomy", title: "Muscular System", progress: 60 },
];

const sampleDecks = [
  { subject: "Biology", title: "Photosynthesis", count: 24 },
  { subject: "Computer Science", title: "Data Structures", count: 18 },
  { subject: "Anatomy", title: "Muscular System", count: 20 },
];

const sampleWeakTopics = [
  { topic_name: "Integrals", course: "Calculus", mastery_score: 38, state: "Needs Review" },
  { topic_name: "Pointers", course: "Computer Science", mastery_score: 42, state: "Needs Review" },
  { topic_name: "Photosynthesis", course: "Biology", mastery_score: 72, state: "Improving" },
  { topic_name: "Muscular System", course: "Anatomy", mastery_score: 65, state: "Improving" },
];

const chatSuggestions = ["Summarize", "Explain Simply", "Make Flashcards", "Create Quiz"] as const;
const supportedUploadExtensions = [".pdf", ".docx", ".txt", ".md"];
const themeOptions: Array<{ key: ThemePreference; label: string; icon: IconName }> = [
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
  { key: "system", label: "System", icon: "monitor" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Size unknown";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function normalizeDifficulty(value: string): Difficulty {
  return value === "easy" || value === "hard" ? value : "medium";
}

function isSupportedUploadFile(file: File) {
  return supportedUploadExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));
}

function consumeOAuthResult() {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  const auth = params.get("auth");
  if (!authError && !auth) {
    return { authError: null, auth: null };
  }

  params.delete("auth_error");
  params.delete("auth");
  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
  return { authError, auth };
}

function materialStatusLabel(status: string) {
  if (status === "ready" || status === "processed") return "Ready to study";
  if (status === "processing") return "Processing...";
  if (status === "failed") return "Failed to process";
  if (status === "uploaded") return "Uploaded";
  return status;
}

function answerStatusLabel(status: AskResponse["answer_status"]) {
  if (status === "answered_from_documents") return "Answer from uploaded materials";
  if (status === "general_ai_fallback") return "General AI answer";
  return "Not found in uploaded materials";
}

function answerStatusClass(status: AskResponse["answer_status"]) {
  if (status === "answered_from_documents") return "document";
  if (status === "general_ai_fallback") return "general";
  return "missing";
}

function formatCitation(citation: AskResponse["citations"][number]) {
  if (citation.document_name === "General AI knowledge") {
    return "General AI knowledge - not from uploaded materials";
  }
  const location = citation.page_or_slide ?? (citation.page_start ? `Page ${citation.page_start}` : citation.topic_label);
  return `${citation.document_name}${location ? ` - ${location}` : ""}`;
}

function renderInlineFormatting(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
      return <strong key={`bold-${index}`}>{segment.slice(2, -2)}</strong>;
    }
    return segment;
  });
}

function renderAnswerContent(text: string) {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length);

  return paragraphs.map((lines, paragraphIndex) => {
    const numberedLines = lines.every((line) => /^\d+\.\s+/.test(line));
    const bulletLines = lines.every((line) => /^[-*]\s+/.test(line));

    if (numberedLines) {
      return (
        <ol className="formatted-list numbered-list" key={`paragraph-${paragraphIndex}`}>
          {lines.map((line, lineIndex) => (
            <li key={`item-${paragraphIndex}-${lineIndex}`}>
              {renderInlineFormatting(line.replace(/^\d+\.\s+/, ""))}
            </li>
          ))}
        </ol>
      );
    }

    if (bulletLines) {
      return (
        <ul className="formatted-list bullet-list" key={`paragraph-${paragraphIndex}`}>
          {lines.map((line, lineIndex) => (
            <li key={`item-${paragraphIndex}-${lineIndex}`}>
              {renderInlineFormatting(line.replace(/^[-*]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="formatted-block" key={`paragraph-${paragraphIndex}`}>
        {lines.map((line, lineIndex) => (
          <p key={`line-${paragraphIndex}-${lineIndex}`}>{renderInlineFormatting(line)}</p>
        ))}
      </div>
    );
  });
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: IconName; tone?: string }) {
  return (
    <article className={`stat-card ${tone ?? ""}`}>
      <div className="stat-icon">
        <Icon name={icon} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "orange" }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-track" aria-label={`${safeValue}% complete`}>
      <div className={`progress-fill ${tone}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <article className="empty-state">
      <div className="icon-badge large">
        <Icon name={icon} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </article>
  );
}

function App() {
  const { cyclePreference, preference: themePreference, resolvedTheme, setPreference: setThemePreference } = useThemePreference();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [status, setStatus] = useState<"online" | "offline">("offline");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("Sign in to upload notes, ask AI, and practice.");
  const [workspaceMessage, setWorkspaceMessage] = useState("Loading workspace...");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [courseName, setCourseName] = useState("Biology");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>("all");
  const [uploadMessage, setUploadMessage] = useState("PDF, DOCX, TXT, and MD files are supported.");
  const [uploadDragging, setUploadDragging] = useState(false);

  const [question, setQuestion] = useState("");
  const [chatThreads, setChatThreads] = useState<ChatThreadItem[]>([]);
  const [selectedChatThreadId, setSelectedChatThreadId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatMessage, setChatMessage] = useState("Select a conversation or start a new one.");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [flashcardTopic, setFlashcardTopic] = useState("");
  const [flashcardCount, setFlashcardCount] = useState(6);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState<Difficulty>("medium");
  const [flashcardMessage, setFlashcardMessage] = useState("Generate flashcards from your uploaded materials.");
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState<Difficulty>("medium");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [quizMessage, setQuizMessage] = useState("Create a quiz from your notes to test yourself.");
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);

  const [settingsName, setSettingsName] = useState("");
  const [settingsDifficulty, setSettingsDifficulty] = useState<Difficulty>("medium");
  const [settingsMessage, setSettingsMessage] = useState("Profile and study preferences.");
  const [emailReminders, setEmailReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  function syncUserState(user: User | null) {
    setCurrentUser(user);
    if (!user) {
      setFlashcardDifficulty("medium");
      setQuizDifficulty("medium");
      setSettingsName("");
      setSettingsDifficulty("medium");
      return;
    }
    const difficulty = normalizeDifficulty(user.preferred_difficulty);
    setFlashcardDifficulty(difficulty);
    setQuizDifficulty(difficulty);
    setSettingsName(user.name);
    setSettingsDifficulty(difficulty);
  }

  async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    const [documentPayload, flashcardPayload, dashboardPayload, progressPayload, chatThreadPayload] = await Promise.all([
      fetchDocuments(),
      fetchFlashcards(),
      fetchDashboard().catch(() => null),
      fetchProgress().catch(() => null),
      fetchChatThreads().catch(() => ({ items: [] })),
    ]);
    return {
      documents: documentPayload.items,
      flashcards: flashcardPayload.items,
      dashboard: dashboardPayload,
      progress: progressPayload,
      chatThreads: chatThreadPayload.items,
    };
  }

  function clearWorkspace() {
    startTransition(() => {
      setDocuments([]);
      setSelectedDocumentId(null);
      setFlashcards([]);
      setChatThreads([]);
      setSelectedChatThreadId(null);
      setChatMessages([]);
      setChatMessage("Select a conversation or start a new one.");
      setPendingQuestion(null);
      setQuizQuestions([]);
      setQuizAnswers({});
      setQuizResult(null);
      setDashboard(null);
      setProgress(null);
    });
  }

  function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
    startTransition(() => {
      setDocuments(snapshot.documents);
      setFlashcards(snapshot.flashcards);
      setDashboard(snapshot.dashboard);
      setProgress(snapshot.progress);
      setChatThreads(snapshot.chatThreads);
      if (!snapshot.chatThreads.length) {
        setChatMessages([]);
      }
      setSelectedChatThreadId((current) => {
        if (current && snapshot.chatThreads.some((thread) => thread.id === current)) {
          return current;
        }
        return snapshot.chatThreads[0]?.id ?? null;
      });
      setSelectedDocumentId((current) => {
        if (current && snapshot.documents.some((document) => document.id === current)) {
          return current;
        }
        return snapshot.documents[0]?.id ?? null;
      });
    });
  }

  async function refreshWorkspace(message?: string) {
    if (!currentUser) {
      clearWorkspace();
      return;
    }
    setWorkspaceMessage(message ?? "Refreshing workspace...");
    try {
      const snapshot = await loadWorkspaceSnapshot();
      applyWorkspaceSnapshot(snapshot);
      setStatus("online");
      setWorkspaceMessage("Workspace ready.");
    } catch (error) {
      console.error(error);
      setStatus("offline");
      setWorkspaceMessage(error instanceof Error ? error.message : "Workspace refresh failed.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const oauthResult = consumeOAuthResult();
      try {
        await fetchStatus();
        if (cancelled) return;
        setStatus("online");

        const session = await fetchSession();
        if (cancelled) return;

        if (!session.authenticated || !session.user) {
          syncUserState(null);
          clearWorkspace();
          setWorkspaceMessage("Backend online. Sign in to get started.");
          if (oauthResult.authError) {
            setAuthMessage(`Google sign-in failed: ${oauthResult.authError}`);
          }
          setSessionChecked(true);
          return;
        }

        syncUserState(session.user);
        const snapshot = await loadWorkspaceSnapshot();
        if (cancelled) return;
        applyWorkspaceSnapshot(snapshot);
        if (oauthResult.auth === "google") {
          setAuthMessage("Google sign-in successful.");
        }
        setWorkspaceMessage("Workspace ready.");
        setSessionChecked(true);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setStatus("offline");
        setWorkspaceMessage("Backend offline. Start the API server to continue.");
        setAuthMessage("The backend is offline right now. Start it, then sign in.");
        setSessionChecked(true);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !selectedChatThreadId) {
      return;
    }

    const threadId = selectedChatThreadId;
    let cancelled = false;
    async function loadSelectedThread() {
      try {
        const payload = await fetchChatThread(threadId);
        if (cancelled) return;
        setChatMessages(payload.messages);
        setChatThreads((current) =>
          current.some((thread) => thread.id === payload.thread.id)
            ? current.map((thread) => (thread.id === payload.thread.id ? payload.thread : thread))
            : [payload.thread, ...current],
        );
        if (payload.thread.document_id) {
          setSelectedDocumentId(payload.thread.document_id);
        }
        setChatMessage("Conversation loaded.");
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setChatMessage(error instanceof Error ? error.message : "Could not load this conversation.");
      }
    }

    void loadSelectedThread();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedChatThreadId]);

  function upsertChatThread(thread: ChatThreadItem) {
    setChatThreads((current) => {
      const withoutThread = current.filter((item) => item.id !== thread.id);
      return [thread, ...withoutThread].sort(
        (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      );
    });
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = authName.trim();
    const normalizedEmail = authEmail.trim();

    if (authMode === "register" && normalizedName.length < 2) {
      setAuthMessage("Enter a name with at least 2 characters.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setAuthMessage("Enter a valid email address.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthMessage("Password must be at least 8 characters.");
      return;
    }

    setBusyKey("auth");
    setAuthMessage(authMode === "register" ? "Creating account..." : "Signing in...");
    try {
      const payload =
        authMode === "register"
          ? await registerUser({ name: normalizedName, email: normalizedEmail, password: authPassword })
          : await loginUser({ email: normalizedEmail, password: authPassword });
      syncUserState(payload.user);
      setAuthPassword("");
      const snapshot = await loadWorkspaceSnapshot();
      applyWorkspaceSnapshot(snapshot);
      setAuthMessage(payload.message);
      setWorkspaceMessage("Workspace ready.");
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusyKey(null);
      setSessionChecked(true);
    }
  }

  async function handleLogout() {
    setBusyKey("logout");
    try {
      await logoutUser();
      syncUserState(null);
      clearWorkspace();
      setAuthMode("login");
      setAuthPassword("");
      setWorkspaceMessage("Signed out.");
      setAuthMessage("Sign in again to continue.");
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      setAuthMessage(error instanceof Error ? error.message : "Logout failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadMessage("Choose a PDF, DOCX, TXT, or MD file first.");
      return;
    }
    setBusyKey("upload");
    setUploadMessage("Uploading and processing your material...");
    try {
      const payload = await uploadDocument(selectedFile, courseName, replaceExisting);
      setSelectedFile(null);
      setReplaceExisting(false);
      setSelectedDocumentId(payload.document.id);
      setUploadMessage(payload.message);
      await refreshWorkspace("Refreshing after upload...");
    } catch (error) {
      console.error(error);
      setUploadMessage(error instanceof Error ? error.message : "We could not process this file. Please upload a PDF, DOCX, TXT, or MD file.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleSelectedUploadFile(file: File | null | undefined) {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isSupportedUploadFile(file)) {
      setSelectedFile(null);
      setUploadMessage("We could not process this file. Please upload a PDF, DOCX, TXT, or MD file.");
      return;
    }
    setSelectedFile(file);
    setUploadMessage(`${file.name} is ready to upload.`);
  }

  function handleUploadDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setUploadDragging(false);
    handleSelectedUploadFile(event.dataTransfer.files[0]);
  }

  async function handleDeleteDocument(documentId: number) {
    setBusyKey(`delete-${documentId}`);
    try {
      const payload = await deleteDocument(documentId);
      setUploadMessage(payload.message);
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(null);
      }
      await refreshWorkspace("Refreshing after delete...");
    } catch (error) {
      console.error(error);
      setUploadMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateChatThread() {
    setBusyKey("chat-new");
    setChatMessage("Starting a new conversation...");
    try {
      const payload = await createChatThread({
        document_id: selectedDocumentId,
        course_name: selectedDocument?.course_name,
      });
      upsertChatThread(payload.thread);
      setSelectedChatThreadId(payload.thread.id);
      setChatMessages(payload.messages);
      setQuestion("");
      setChatMessage("New conversation ready.");
    } catch (error) {
      console.error(error);
      setChatMessage(error instanceof Error ? error.message : "Could not create a conversation.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleSelectChatThread(thread: ChatThreadItem) {
    setSelectedChatThreadId(thread.id);
    if (thread.document_id) {
      setSelectedDocumentId(thread.document_id);
    }
  }

  async function handleDeleteChatThread(threadId: number) {
    setBusyKey(`chat-delete-${threadId}`);
    try {
      await deleteChatThread(threadId);
      setChatThreads((current) => {
        const nextThreads = current.filter((thread) => thread.id !== threadId);
        if (selectedChatThreadId === threadId) {
          setSelectedChatThreadId(nextThreads[0]?.id ?? null);
          setChatMessages([]);
        }
        return nextThreads;
      });
      setChatMessage("Conversation deleted.");
    } catch (error) {
      console.error(error);
      setChatMessage(error instanceof Error ? error.message : "Could not delete this conversation.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion) return;
    setPendingQuestion(submittedQuestion);
    setBusyKey("ask");
    try {
      const payload = selectedChatThreadId
        ? await askChatThread(selectedChatThreadId, { question: submittedQuestion, document_id: selectedDocumentId })
        : await createChatThreadAndAsk({ question: submittedQuestion, document_id: selectedDocumentId });
      upsertChatThread(payload.thread);
      setSelectedChatThreadId(payload.thread.id);
      setChatMessages(payload.messages);
      setChatMessage("Conversation saved.");
      setQuestion("");
      setPendingQuestion(null);
      void refreshWorkspace("Updating study progress...");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "AI response failed. Please try again.";
      setChatMessage(message);
      setQuestion("");
      setPendingQuestion(null);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGenerateFlashcards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("flashcards");
    setFlashcardMessage("Generating flashcards...");
    try {
      const payload = await generateFlashcards({
        topic: flashcardTopic.trim() || undefined,
        count: flashcardCount,
        difficulty: flashcardDifficulty,
      });
      setFlashcards(payload.items);
      setActiveFlashcardIndex(0);
      setShowFlashcardAnswer(false);
      setFlashcardMessage(payload.message);
      void refreshWorkspace("Updating flashcard deck...");
    } catch (error) {
      console.error(error);
      setFlashcardMessage(error instanceof Error ? error.message : "Flashcard generation failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRateCurrentFlashcard(rating: Difficulty) {
    const currentFlashcard = flashcards[activeFlashcardIndex];
    if (!currentFlashcard) return;
    setBusyKey("flashcard-rate");
    try {
      const updated = await rateFlashcard(currentFlashcard.id, rating);
      setFlashcards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
      setFlashcardMessage(`Marked as ${rating}.`);
      setShowFlashcardAnswer(false);
      setActiveFlashcardIndex((value) => Math.min(value + 1, Math.max(flashcards.length - 1, 0)));
      void refreshWorkspace("Updating mastery levels...");
    } catch (error) {
      console.error(error);
      setFlashcardMessage(error instanceof Error ? error.message : "Could not save this flashcard rating.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGenerateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("quiz-generate");
    setQuizMessage("Generating quiz...");
    try {
      const payload = await generateQuiz({
        topic: quizTopic.trim() || undefined,
        difficulty: quizDifficulty,
        question_count: quizCount,
      });
      setQuizQuestions(payload.questions);
      setQuizAnswers({});
      setQuizResult(null);
      setActiveQuizIndex(0);
      setQuizMessage(payload.message);
    } catch (error) {
      console.error(error);
      setQuizMessage(error instanceof Error ? error.message : "Quiz generation failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSubmitQuiz() {
    if (!quizQuestions.length) {
      setQuizMessage("Generate a quiz first.");
      return;
    }
    setBusyKey("quiz-submit");
    setQuizMessage("Scoring quiz...");
    try {
      const result = await submitQuiz(
        quizQuestions.map((item, index) => ({
          prompt: item.prompt,
          topic_name: item.topic_name,
          question_type: item.question_type,
          difficulty: item.difficulty,
          answer_token: item.answer_token,
          student_answer: quizAnswers[index] ?? "",
        })),
      );
      setQuizResult(result);
      setQuizMessage("Quiz scored.");
      await refreshWorkspace("Updating mastery levels...");
    } catch (error) {
      console.error(error);
      setQuizMessage(error instanceof Error ? error.message : "Quiz submit failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = settingsName.trim();
    if (normalizedName.length < 2) {
      setSettingsMessage("Enter a name with at least 2 characters.");
      return;
    }
    setBusyKey("settings");
    setSettingsMessage("Saving profile...");
    try {
      const payload = await updateProfile({
        name: normalizedName,
        preferred_difficulty: settingsDifficulty,
      });
      syncUserState(payload.user);
      setSettingsMessage(payload.message);
    } catch (error) {
      console.error(error);
      setSettingsMessage(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleQuickAction(action: (typeof chatSuggestions)[number]) {
    if (action === "Summarize") {
      setQuestion("Summarize my uploaded study materials.");
      return;
    }
    if (action === "Explain Simply") {
      setQuestion("Explain the selected material in simple words.");
      return;
    }
    if (action === "Make Flashcards") {
      setFlashcardTopic(selectedDocument?.topic_summary.split(",")[0]?.trim() ?? "");
      setActiveView("flashcards");
      return;
    }
    setQuizTopic(selectedDocument?.topic_summary.split(",")[0]?.trim() ?? "");
    setActiveView("quizzes");
  }

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
  const selectedChatThread = chatThreads.find((thread) => thread.id === selectedChatThreadId) ?? null;
  const currentFlashcard = flashcards[activeFlashcardIndex] ?? null;
  const currentQuizQuestion = quizQuestions[activeQuizIndex] ?? null;
  const currentQuizResult = quizResult?.results[activeQuizIndex] ?? null;
  const latestCitations =
    [...chatMessages].reverse().find((message) => message.role === "assistant" && message.citations.length)?.citations ?? [];
  const latestStudyCitations = latestCitations.filter((citation) => citation.document_name !== "General AI knowledge");
  const filteredDocuments =
    materialFilter === "all"
      ? documents
      : documents.filter((document) => document.document_type.toLowerCase() === materialFilter);
  const groupedDecks = Object.values(
    flashcards.reduce<Record<string, { topic: string; count: number }>>((groups, card) => {
      const key = card.topic_name || "General";
      groups[key] = groups[key] ?? { topic: key, count: 0 };
      groups[key].count += 1;
      return groups;
    }, {}),
  );

  function renderDashboard() {
    const studyStreak = progress ? `${progress.study_streak_days} days` : "12 days";
    const quizAccuracy = progress ? `${Math.round(progress.quiz_accuracy)}%` : "78%";
    const weakTopicCount = progress ? progress.topic_mastery.filter((topic) => topic.mastery_score < 70).length : 5;
    const studyCards = documents.length
      ? documents.slice(0, 3).map((document, index) => ({
          subject: document.course_name,
          title: document.topic_summary.split(",")[0]?.trim() || document.document_name,
          progress: Math.min(85, 45 + index * 11 + Math.min(document.chunk_count, 8)),
        }))
      : sampleStudyCards;
    const recommendation = dashboard?.recommendations[0];
    const recommendedTopic = recommendation?.topic ?? "Calculus integrals";
    const recommendationText = recommendation
      ? `${recommendation.topic}: ${recommendation.reason}`
      : "You should review Calculus integrals today because your last quiz score was low.";

    return (
      <section className="page-stack">
        <PageHeader
          title="Dashboard"
          subtitle="Welcome back. Continue your study plan today."
          action={
            <button className="primary-button" onClick={() => setActiveView("materials")} type="button">
              <Icon name="upload" />
              Upload Material
            </button>
          }
        />

        <div className="stats-grid three">
          <StatCard label="Study Streak" value={studyStreak} icon="trend" />
          <StatCard label="Quiz Accuracy" value={quizAccuracy} icon="quiz" tone="green" />
          <StatCard label="Weak Topics" value={`${weakTopicCount} topics`} icon="spark" tone="orange" />
        </div>

        <section className="section-block">
          <div className="section-heading">
            <h2>Continue Studying</h2>
            <p>{documents.length ? "Based on your uploaded materials." : "Sample study plan until you upload materials."}</p>
          </div>
          <div className="study-card-grid">
            {studyCards.map((item) => (
              <article className="study-card" key={`${item.subject}-${item.title}`}>
                <span className="small-label">{item.subject}</span>
                <h3>{item.title}</h3>
                <ProgressBar value={item.progress} />
                <div className="card-footer-row">
                  <span>{item.progress}% complete</span>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setQuestion(`Help me continue studying ${item.title}.`);
                      setActiveView("chat");
                    }}
                    type="button"
                  >
                    Continue
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <article className="recommendation-card">
          <div className="recommendation-icon">
            <Icon name="spark" />
          </div>
          <div>
            <span className="small-label">Recommended Next Step</span>
            <p>{recommendationText}</p>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setQuizTopic(recommendedTopic);
              setActiveView("quizzes");
            }}
            type="button"
          >
            Start Practice
          </button>
        </article>
      </section>
    );
  }

  function renderMaterials() {
    return (
      <section className="page-stack">
        <PageHeader title="Materials" subtitle="Upload notes, PDFs, and study guides." />

        <section className="materials-layout">
          <article className="panel">
            <div className="section-heading">
              <h2>Upload Material</h2>
              <p>Drag and drop your file here or click to upload.</p>
            </div>
            <form className="form-grid" onSubmit={handleUpload}>
              <label>
                Subject
                <input onChange={(event) => setCourseName(event.target.value)} placeholder="e.g. Biology" value={courseName} />
              </label>
              <label
                className={uploadDragging ? "upload-box dragging" : "upload-box"}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setUploadDragging(true);
                }}
                onDragLeave={() => setUploadDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleUploadDrop}
              >
                <span className="upload-icon">
                  <Icon name="upload" />
                </span>
                <strong>{selectedFile ? selectedFile.name : "Drag and drop your files here"}</strong>
                <span>or click to upload</span>
                <small>PDF, DOCX, TXT, and MD supported</small>
                <input accept=".pdf,.txt,.md,.docx" onChange={(event) => handleSelectedUploadFile(event.target.files?.[0])} type="file" />
              </label>
              <label className="checkbox-row">
                <input checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} type="checkbox" />
                <span>Replace an existing file with the same name</span>
              </label>
              <button className="primary-button" disabled={busyKey === "upload"} type="submit">
                <Icon name="upload" />
                {busyKey === "upload" ? "Processing..." : "Upload Material"}
              </button>
            </form>
            <p className="helper-text">{uploadMessage}</p>
          </article>

          <article className="panel">
            <div className="section-heading compact">
              <div>
                <h2>Uploaded Files</h2>
                <p>Your processed and indexed materials.</p>
              </div>
              <div className="filter-tabs" aria-label="Material filters">
                {materialFilters.map((filter) => (
                  <button
                    className={materialFilter === filter.key ? "filter-tab active" : "filter-tab"}
                    key={filter.key}
                    onClick={() => setMaterialFilter(filter.key)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="stack-list">
              {filteredDocuments.length ? (
                filteredDocuments.map((document) => (
                  <article className="file-card" key={document.id}>
                    <div className="file-main">
                      <div className="icon-badge">
                        <Icon name="file" />
                      </div>
                      <div>
                        <strong>{document.document_name}</strong>
                        <p>
                          {document.course_name} / {document.document_type.toUpperCase()} / {formatDate(document.upload_date)}
                        </p>
                        <small>
                          <span className={`status-pill ${document.processing_status}`}>{materialStatusLabel(document.processing_status)}</span>
                          {formatBytes(document.file_size_bytes)} / {document.chunk_count} chunks
                        </small>
                        {document.error_message ? <p className="file-error">{document.error_message}</p> : null}
                      </div>
                    </div>
                    <div className="file-actions">
                      <button
                        className="secondary-button"
                        disabled={document.processing_status === "failed" || document.processing_status === "processing"}
                        onClick={() => {
                          setSelectedDocumentId(document.id);
                          setActiveView("chat");
                        }}
                        type="button"
                      >
                        Ask AI
                      </button>
                      <button
                        className="ghost-button danger"
                        disabled={busyKey === `delete-${document.id}`}
                        onClick={() => handleDeleteDocument(document.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon="file"
                  title="No materials yet"
                  description="Upload your first PDF, DOCX, TXT, or MD file to start studying."
                  action={
                    <button className="secondary-button" onClick={() => setMaterialFilter("all")} type="button">
                      Show All
                    </button>
                  }
                />
              )}
            </div>
          </article>
        </section>
      </section>
    );
  }

  function renderChat() {
    const contextSnippets = latestStudyCitations.length
      ? latestStudyCitations.slice(0, 3).map((citation) => ({
          title: citation.page_or_slide ?? (citation.page_start ? `Page ${citation.page_start}` : citation.topic_label),
          text: citation.snippet,
        }))
      : selectedDocument
        ? [
            {
              title: selectedDocument.topic_summary ? "Detected topics" : "Selected source",
              text: selectedDocument.topic_summary || selectedDocument.document_name,
            },
          ]
        : [];

    return (
      <section className="page-stack">
        <PageHeader title="AI Chat" subtitle="Ask questions based on your uploaded study materials." />

        <section className="chat-layout">
          <aside className="panel context-panel">
            <div className="chat-sidebar-header">
              <div>
                <h2>Conversations</h2>
                <p>Return to previous study chats.</p>
              </div>
              <button
                className="icon-button"
                disabled={busyKey === "chat-new"}
                onClick={handleCreateChatThread}
                title="New chat"
                type="button"
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="thread-list">
              {chatThreads.length ? (
                chatThreads.map((thread) => (
                  <div className={selectedChatThreadId === thread.id ? "thread-row active" : "thread-row"} key={thread.id}>
                    <button onClick={() => handleSelectChatThread(thread)} type="button">
                      <strong>{thread.title}</strong>
                      <span>{thread.document_name ?? thread.course_name ?? "All materials"}</span>
                    </button>
                    <button
                      className="thread-delete"
                      disabled={busyKey === `chat-delete-${thread.id}`}
                      onClick={() => handleDeleteChatThread(thread.id)}
                      title="Delete conversation"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon="chat"
                  title="No saved chats"
                  description="Start a conversation to keep your study history."
                  action={
                    <button className="secondary-button" disabled={busyKey === "chat-new"} onClick={handleCreateChatThread} type="button">
                      New Chat
                    </button>
                  }
                />
              )}
            </div>

            <div className="section-heading">
              <h2>Study Context</h2>
              <p>Choose the material PrepMind should focus on.</p>
            </div>
            {documents.length ? (
              <label className="simple-label">
                Selected material
                <select
                  onChange={(event) => setSelectedDocumentId(Number(event.target.value))}
                  value={selectedDocument?.id ?? ""}
                >
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.document_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <EmptyState
                icon="upload"
                title="No study context"
                description="Upload a material first so answers can use your notes."
                action={
                  <button className="secondary-button" onClick={() => setActiveView("materials")} type="button">
                    Upload Material
                  </button>
                }
              />
            )}
            {contextSnippets.length ? (
              <div className="source-list">
                {contextSnippets.map((snippet, index) => (
                  <article className="source-snippet" key={`${snippet.title}-${index}`}>
                    <strong>{snippet.title}</strong>
                    <p>{snippet.text}</p>
                  </article>
                ))}
              </div>
            ) : null}
            <button className="ghost-button" onClick={() => setActiveView("materials")} type="button">
              Change Material
            </button>
          </aside>

          <article className="panel chat-panel">
            <div className="active-thread-bar">
              <div>
                <span className="small-label">Active conversation</span>
                <strong>{selectedChatThread?.title ?? "New unsaved chat"}</strong>
              </div>
              <span>{selectedChatThread?.document_name ?? selectedDocument?.document_name ?? "All materials"}</span>
            </div>

            <div className="quick-actions">
              {chatSuggestions.map((suggestion) => (
                <button className="quick-action" key={suggestion} onClick={() => handleQuickAction(suggestion)} type="button">
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="chat-history">
              {chatMessages.length === 0 && !pendingQuestion ? (
                <EmptyState
                  icon="chat"
                  title="Ask about your notes"
                  description={chatMessage || "Try asking PrepMind to summarize a chapter or explain a concept in simple words."}
                />
              ) : null}
              {chatMessages.map((message) =>
                message.role === "user" ? (
                  <article className="chat-bubble user" key={message.id}>
                    <p>{message.content}</p>
                  </article>
                ) : (
                  <article className="chat-bubble assistant" key={message.id}>
                    <div className="assistant-header">
                      <Icon name="spark" />
                      <span>PrepMind AI</span>
                    </div>
                    <div className={`answer-status ${answerStatusClass(message.answer_status ?? "not_found_in_documents")}`}>
                      <strong>{answerStatusLabel(message.answer_status ?? "not_found_in_documents")}</strong>
                      <span>
                        {message.used_general_ai
                          ? "This answer is not from your uploaded materials."
                          : `Confidence: ${message.confidence_label ?? "low"}`}
                      </span>
                    </div>
                    <div className="assistant-content">{renderAnswerContent(message.content)}</div>
                    {message.citations.length ? (
                      <div className="sources-line">
                        <strong>Sources</strong>
                        {message.citations.map((citation, citationIndex) => (
                          <span key={`${citation.document_name}-${citationIndex}`}>{formatCitation(citation)}</span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ),
              )}
              {pendingQuestion ? (
                <div className="message-group">
                  <article className="chat-bubble user">
                    <p>{pendingQuestion}</p>
                  </article>
                  <article className="chat-bubble assistant">
                    <div className="assistant-header">
                      <Icon name="spark" />
                      <span>Thinking</span>
                    </div>
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </article>
                </div>
              ) : null}
            </div>

            <form className="chat-composer" onSubmit={handleAsk}>
              <textarea
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask a question about your notes..."
                rows={2}
                value={question}
              />
              <button className="send-button" disabled={busyKey === "ask" || !question.trim()} type="submit">
                <Icon name="send" />
              </button>
            </form>
          </article>
        </section>
      </section>
    );
  }

  function renderFlashcards() {
    return (
      <section className="page-stack">
        <PageHeader title="Flashcards" subtitle="Review key ideas from your materials." />

        <section className="split-layout">
          <aside className="panel">
            <div className="section-heading">
              <h2>Decks</h2>
              <p>Generate or review a focused card set.</p>
            </div>
            <form className="form-grid compact-form" onSubmit={handleGenerateFlashcards}>
              <label>
                Topic
                <input onChange={(event) => setFlashcardTopic(event.target.value)} placeholder="e.g. Photosynthesis" value={flashcardTopic} />
              </label>
              <div className="form-row">
                <label>
                  Cards
                  <input max={20} min={1} onChange={(event) => setFlashcardCount(Number(event.target.value))} type="number" value={flashcardCount} />
                </label>
                <label>
                  Level
                  <select onChange={(event) => setFlashcardDifficulty(event.target.value as Difficulty)} value={flashcardDifficulty}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
              <button className="primary-button" disabled={busyKey === "flashcards"} type="submit">
                <Icon name="spark" />
                {busyKey === "flashcards" ? "Generating..." : "Generate Flashcards"}
              </button>
            </form>
            <p className="helper-text">{flashcardMessage}</p>
            <div className="deck-list">
              {groupedDecks.length
                ? groupedDecks.map((deck) => (
                    <button className="deck-row" key={deck.topic} onClick={() => setFlashcardTopic(deck.topic)} type="button">
                      <span>{deck.topic}</span>
                      <small>{deck.count} cards</small>
                    </button>
                  ))
                : sampleDecks.map((deck) => (
                    <button className="deck-row sample" key={`${deck.subject}-${deck.title}`} onClick={() => setFlashcardTopic(deck.title)} type="button">
                      <span>{deck.subject} - {deck.title}</span>
                      <small>{deck.count} sample cards</small>
                    </button>
                  ))}
            </div>
          </aside>

          <article className="panel flashcard-viewer">
            {currentFlashcard ? (
              <>
                <div className="flashcard-toolbar">
                  <span>Card {activeFlashcardIndex + 1} of {flashcards.length}</span>
                  <span className="pill">{currentFlashcard.topic_name}</span>
                </div>
                <article className="flashcard-card">
                  <span className="small-label">Question</span>
                  <h2>{currentFlashcard.question}</h2>
                  {showFlashcardAnswer ? (
                    <div className="answer-box">
                      <span className="small-label">Answer</span>
                      <p>{currentFlashcard.answer}</p>
                      {currentFlashcard.source_document_name ? (
                        <small className="source-footnote">
                          Source: {currentFlashcard.source_document_name}
                          {currentFlashcard.source_page_start ? ` - Page ${currentFlashcard.source_page_start}` : ""}
                        </small>
                      ) : null}
                    </div>
                  ) : (
                    <button className="primary-button" onClick={() => setShowFlashcardAnswer(true)} type="button">
                      Show Answer
                    </button>
                  )}
                </article>
                {showFlashcardAnswer ? (
                  <div className="rating-row">
                    <button disabled={busyKey === "flashcard-rate"} onClick={() => handleRateCurrentFlashcard("easy")} type="button">
                      Easy
                    </button>
                    <button disabled={busyKey === "flashcard-rate"} onClick={() => handleRateCurrentFlashcard("medium")} type="button">
                      Medium
                    </button>
                    <button disabled={busyKey === "flashcard-rate"} onClick={() => handleRateCurrentFlashcard("hard")} type="button">
                      Hard
                    </button>
                  </div>
                ) : null}
                <div className="footer-actions">
                  <button
                    className="secondary-button"
                    disabled={activeFlashcardIndex === 0}
                    onClick={() => {
                      setActiveFlashcardIndex((value) => Math.max(0, value - 1));
                      setShowFlashcardAnswer(false);
                    }}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="secondary-button"
                    disabled={activeFlashcardIndex >= flashcards.length - 1}
                    onClick={() => {
                      setActiveFlashcardIndex((value) => Math.min(flashcards.length - 1, value + 1));
                      setShowFlashcardAnswer(false);
                    }}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                icon="cards"
                title="No flashcards yet"
                description="Generate flashcards from your uploaded materials."
                action={
                  <button className="secondary-button" onClick={() => setActiveView("materials")} type="button">
                    Upload Material
                  </button>
                }
              />
            )}
          </article>
        </section>
      </section>
    );
  }

  function renderQuizzes() {
    const quizProgress = quizQuestions.length ? ((activeQuizIndex + 1) / quizQuestions.length) * 100 : 0;

    return (
      <section className="page-stack">
        <PageHeader title="Quizzes" subtitle="Practice questions generated from your notes." />

        <section className="split-layout">
          <aside className="panel">
            <div className="section-heading">
              <h2>Create Quiz</h2>
              <p>Pick a topic and difficulty level.</p>
            </div>
            <form className="form-grid compact-form" onSubmit={handleGenerateQuiz}>
              <label>
                Focus topic
                <input onChange={(event) => setQuizTopic(event.target.value)} placeholder="Leave blank for all notes" value={quizTopic} />
              </label>
              <div className="form-row">
                <label>
                  Questions
                  <input max={20} min={1} onChange={(event) => setQuizCount(Number(event.target.value))} type="number" value={quizCount} />
                </label>
                <label>
                  Level
                  <select onChange={(event) => setQuizDifficulty(event.target.value as Difficulty)} value={quizDifficulty}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
              <button className="primary-button" disabled={busyKey === "quiz-generate"} type="submit">
                <Icon name="quiz" />
                {busyKey === "quiz-generate" ? "Preparing..." : "Create Quiz"}
              </button>
            </form>
            <p className="helper-text">{quizMessage}</p>
          </aside>

          <article className="panel quiz-panel">
            {currentQuizQuestion ? (
              <>
                <div className="quiz-header">
                  <div>
                    <span className="small-label">Quiz: {currentQuizQuestion.topic_name}</span>
                    <h2>Question {activeQuizIndex + 1} of {quizQuestions.length}</h2>
                  </div>
                  {quizResult ? (
                    <div className="score-pill">
                      {quizResult.score_percent}% score
                    </div>
                  ) : null}
                </div>
                <ProgressBar value={quizProgress} />
                <div className="question-card">
                  <h3>{currentQuizQuestion.prompt}</h3>
                  {currentQuizQuestion.options.length ? (
                    <div className="options-grid">
                      {currentQuizQuestion.options.map((option) => {
                        const selected = quizAnswers[activeQuizIndex] === option.id;
                        const correct = currentQuizResult
                          ? option.id === currentQuizResult.correct_answer || option.label === currentQuizResult.correct_answer
                          : false;
                        const incorrect = currentQuizResult && selected && !correct;
                        const stateClass = correct ? "correct" : incorrect ? "incorrect" : selected ? "selected" : "";
                        return (
                          <label className={`option-card ${stateClass}`} key={option.id}>
                            <input
                              checked={selected}
                              disabled={Boolean(quizResult)}
                              name={`quiz-${activeQuizIndex}`}
                              onChange={() => setQuizAnswers((current) => ({ ...current, [activeQuizIndex]: option.id }))}
                              type="radio"
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      className="quiz-textarea"
                      disabled={Boolean(quizResult)}
                      onChange={(event) => setQuizAnswers((current) => ({ ...current, [activeQuizIndex]: event.target.value }))}
                      placeholder="Type your answer here..."
                      rows={4}
                      value={quizAnswers[activeQuizIndex] ?? ""}
                    />
                  )}
                  {currentQuizResult ? (
                    <div className={currentQuizResult.is_correct ? "explanation correct" : "explanation incorrect"}>
                      <strong>{currentQuizResult.is_correct ? "Correct" : "Review this"}</strong>
                      <p>{currentQuizResult.feedback}</p>
                      {currentQuizResult.explanation && currentQuizResult.explanation !== currentQuizResult.feedback ? (
                        <p>{currentQuizResult.explanation}</p>
                      ) : null}
                      <small>Answer: {currentQuizResult.correct_answer}</small>
                    </div>
                  ) : null}
                  <small className="source-footnote">
                    Source: {currentQuizQuestion.source_document_name ?? "Uploaded material"}
                    {currentQuizQuestion.source_page_start ? ` - Page ${currentQuizQuestion.source_page_start}` : ""}
                  </small>
                </div>
                <div className="footer-actions">
                  <button
                    className="secondary-button"
                    disabled={activeQuizIndex === 0}
                    onClick={() => setActiveQuizIndex((value) => Math.max(0, value - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="secondary-button"
                    disabled={activeQuizIndex >= quizQuestions.length - 1}
                    onClick={() => setActiveQuizIndex((value) => Math.min(quizQuestions.length - 1, value + 1))}
                    type="button"
                  >
                    Next
                  </button>
                  <button className="primary-button" disabled={busyKey === "quiz-submit" || Boolean(quizResult)} onClick={handleSubmitQuiz} type="button">
                    Finish Quiz
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                icon="quiz"
                title="No quizzes yet"
                description="Create a quiz from your notes to test yourself."
              />
            )}
          </article>
        </section>
      </section>
    );
  }

  function renderProgress() {
    const topicRows = progress?.topic_mastery.length
      ? progress.topic_mastery.slice(0, 6).map((topic) => ({
          topic_name: topic.topic_name,
          course: "Uploaded materials",
          mastery_score: topic.mastery_score,
          state: topic.mastery_score < 60 ? "Needs Review" : "Improving",
        }))
      : sampleWeakTopics;
    const recommendation = dashboard?.recommendations[0];

    return (
      <section className="page-stack">
        <PageHeader title="Progress" subtitle="See what you are improving and what needs review." />

        <div className="stats-grid three">
          <StatCard label="Overall Accuracy" value={progress ? `${Math.round(progress.quiz_accuracy)}%` : "78%"} icon="quiz" />
          <StatCard label="Materials Studied" value={String(documents.length || 12)} icon="file" />
          <StatCard label="Quizzes Completed" value={quizResult ? "1 this session" : "8"} icon="trend" />
        </div>

        <section className="progress-layout">
          <article className="panel">
            <div className="section-heading">
              <h2>Weak Topics</h2>
              <p>Use these topics to decide what to study next.</p>
            </div>
            <div className="topic-list">
              {topicRows.map((topic) => (
                <article className="topic-row" key={`${topic.topic_name}-${topic.course}`}>
                  <div>
                    <strong>{topic.topic_name}</strong>
                    <p>
                      {topic.course} / {topic.state}
                    </p>
                  </div>
                  <div className="topic-score">
                    <span>{Math.round(topic.mastery_score)}%</span>
                    <ProgressBar value={topic.mastery_score} tone={topic.mastery_score < 60 ? "orange" : "green"} />
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="recommendation-card vertical">
            <div className="recommendation-icon">
              <Icon name="spark" />
            </div>
            <span className="small-label">Recommended Focus</span>
            <p>
              {recommendation
                ? `${recommendation.action} Focus on ${recommendation.topic}.`
                : "Practice Integrals today. You missed the most questions from this topic."}
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setQuizTopic(recommendation?.topic ?? "Integrals");
                setActiveView("quizzes");
              }}
              type="button"
            >
              Start Quiz
            </button>
          </article>
        </section>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="page-stack">
        <PageHeader title="Settings" subtitle="Keep your profile and study preferences simple." />

        <section className="settings-grid">
          <article className="panel">
            <div className="section-heading">
              <h2>Profile</h2>
              <p>Update your display name and default difficulty.</p>
            </div>
            <form className="form-grid" onSubmit={handleProfileUpdate}>
              <label>
                Name
                <input minLength={2} onChange={(event) => setSettingsName(event.target.value)} value={settingsName} />
              </label>
              <label>
                Study level
                <select onChange={(event) => setSettingsDifficulty(event.target.value as Difficulty)} value={settingsDifficulty}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <button className="primary-button" disabled={busyKey === "settings"} type="submit">
                Save Changes
              </button>
            </form>
            <p className="helper-text">{settingsMessage}</p>
          </article>

          <article className="panel settings-card">
            <div className="section-heading">
              <h2>Account</h2>
              <p>{currentUser?.email}</p>
            </div>
            <button className="ghost-button danger" disabled={busyKey === "logout"} onClick={handleLogout} type="button">
              <Icon name="logout" />
              Sign Out
            </button>
          </article>

          <article className="panel settings-card">
            <div className="section-heading">
              <h2>Study Preferences</h2>
              <p>Default quiz and flashcard difficulty follows your profile setting.</p>
            </div>
            <div className="preference-row">
              <span>Current level</span>
              <strong>{settingsDifficulty}</strong>
            </div>
          </article>

          <article className="panel settings-card">
            <div className="section-heading">
              <h2>Appearance</h2>
              <p>Choose the interface theme for this device.</p>
            </div>
            <div className="theme-segment" aria-label="Theme preference">
              {themeOptions.map((option) => (
                <button
                  aria-pressed={themePreference === option.key}
                  className={themePreference === option.key ? "theme-option active" : "theme-option"}
                  key={option.key}
                  onClick={() => setThemePreference(option.key)}
                  type="button"
                >
                  <Icon name={option.icon} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <p className="helper-text">Active theme: {resolvedTheme}.</p>
          </article>

          <article className="panel settings-card">
            <div className="section-heading">
              <h2>Notifications</h2>
              <p>Local UI preferences for reminders.</p>
            </div>
            <label className="toggle-row">
              <input checked={emailReminders} onChange={(event) => setEmailReminders(event.target.checked)} type="checkbox" />
              <span>Study reminders</span>
            </label>
            <label className="toggle-row">
              <input checked={weeklySummary} onChange={(event) => setWeeklySummary(event.target.checked)} type="checkbox" />
              <span>Weekly progress summary</span>
            </label>
          </article>
        </section>
      </section>
    );
  }

  if (!sessionChecked) {
    return (
      <div className="auth-shell">
        <article className="auth-card loading-card">
          <img alt="PrepMind AI logo" className="auth-logo" src={logoMark} />
          <h1>Loading PrepMind AI</h1>
          <p>{workspaceMessage}</p>
          <div className="spinner" />
        </article>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <section className="auth-layout">
          <article className="auth-intro">
            <div className="brand-lockup">
              <img alt="PrepMind AI logo" className="auth-logo" src={logoMark} />
              <strong>PrepMind AI</strong>
            </div>
            <h1>Study smarter. Achieve more.</h1>
            <p>Upload your notes and let PrepMind AI turn them into summaries, flashcards, quizzes, and answers.</p>
            <div className="auth-feature-grid">
              <span>Upload Materials</span>
              <span>Ask AI Questions</span>
              <span>Generate Flashcards</span>
              <span>Take Quizzes</span>
              <span>Track Progress</span>
            </div>
          </article>

          <article className="auth-card">
            <div className="auth-card-header">
              <span className="small-label">Account</span>
              <h2>{authMode === "register" ? "Create account" : "Sign in"}</h2>
            </div>
            <div className="auth-tabs">
              <button className={authMode === "login" ? "filter-tab active" : "filter-tab"} onClick={() => setAuthMode("login")} type="button">
                Login
              </button>
              <button className={authMode === "register" ? "filter-tab active" : "filter-tab"} onClick={() => setAuthMode("register")} type="button">
                Register
              </button>
            </div>
            <button className="google-button" disabled={status === "offline"} onClick={startGoogleLogin} type="button">
              <span className="google-mark">G</span>
              Continue with Google
            </button>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <form className="form-grid" onSubmit={handleAuthSubmit}>
              {authMode === "register" ? (
                <label>
                  Name
                  <input minLength={2} onChange={(event) => setAuthName(event.target.value)} required={authMode === "register"} value={authName} />
                </label>
              ) : null}
              <label>
                Email
                <input onChange={(event) => setAuthEmail(event.target.value)} required type="email" value={authEmail} />
              </label>
              <label>
                Password
                <input minLength={8} onChange={(event) => setAuthPassword(event.target.value)} required type="password" value={authPassword} />
              </label>
              <button className="primary-button" disabled={busyKey === "auth" || status === "offline"} type="submit">
                {busyKey === "auth" ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>
            <p className="helper-text">{authMessage}</p>
          </article>
        </section>
      </div>
    );
  }

  return (
    <Layout
      activeView={activeView}
      onViewChange={setActiveView}
      views={views}
      onRefresh={() => refreshWorkspace()}
      onLogout={handleLogout}
      onThemeCycle={cyclePreference}
      currentUser={currentUser}
      resolvedTheme={resolvedTheme}
      status={status}
      themePreference={themePreference}
    >
      {activeView === "dashboard" ? renderDashboard() : null}
      {activeView === "materials" ? renderMaterials() : null}
      {activeView === "chat" ? renderChat() : null}
      {activeView === "flashcards" ? renderFlashcards() : null}
      {activeView === "quizzes" ? renderQuizzes() : null}
      {activeView === "progress" ? renderProgress() : null}
      {activeView === "settings" ? renderSettings() : null}
    </Layout>
  );
}

export default App;
