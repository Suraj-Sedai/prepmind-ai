import { startTransition, useEffect, useState } from "react";
import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import "./App.css";
import logoMark from "./assets/prepmind-mark.svg";
import {
  askQuestion,
  deleteDocument,
  fetchDashboard,
  fetchDocuments,
  fetchFlashcards,
  fetchProgress,
  fetchRecommendations,
  fetchSession,
  fetchStatus,
  generateFlashcards,
  generateQuiz,
  loginUser,
  logoutUser,
  rateFlashcard,
  registerUser,
  startExam,
  submitExam,
  submitQuiz,
  uploadDocument,
  uploadProfileImage,
  updateProfile,
} from "./api";
import type {
  AskResponse,
  DashboardResponse,
  DocumentItem,
  ExamSubmitResponse,
  FlashcardItem,
  ProgressResponse,
  QuizQuestion,
  QuizSubmitResponse,
  RecommendationItem,
  User,
} from "./types";

type ViewKey = "dashboard" | "upload" | "ask" | "flashcards" | "quiz" | "exam" | "progress";
type AuthMode = "login" | "register";
type ThemeMode = "light" | "dark";
type IconName =
  | "dashboard"
  | "upload"
  | "ask"
  | "flashcards"
  | "quiz"
  | "exam"
  | "progress"
  | "spark"
  | "shield"
  | "moon"
  | "refresh"
  | "library"
  | "camera"
  | "logout"
  | "bolt"
  | "clock"
  | "user"
  | "target";

type WorkspaceSnapshot = {
  dashboard: DashboardResponse;
  documents: DocumentItem[];
  progress: ProgressResponse;
  recommendations: RecommendationItem[];
  flashcards: FlashcardItem[];
};

const views: Array<{ key: ViewKey; label: string; caption: string; icon: IconName }> = [
  { key: "dashboard", label: "Dashboard", caption: "Command center", icon: "dashboard" },
  { key: "upload", label: "Upload", caption: "Materials", icon: "upload" },
  { key: "ask", label: "Ask AI", caption: "Grounded help", icon: "ask" },
  { key: "flashcards", label: "Flashcards", caption: "Recall", icon: "flashcards" },
  { key: "quiz", label: "Quiz", caption: "Practice", icon: "quiz" },
  { key: "exam", label: "Exam Mode", caption: "Timed", icon: "exam" },
  { key: "progress", label: "Progress", caption: "Signals", icon: "progress" },
];

const viewMeta: Record<ViewKey, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "Study command center",
    title: "Everything you need for the next session.",
    description: "A redesigned home base with focus areas, quick launches, and the signals that matter first.",
  },
  upload: {
    eyebrow: "Material studio",
    title: "Bring your notes, handouts, and guides into one library.",
    description: "Upload once and keep the study pipeline ready for grounded answers, decks, quizzes, and exam sessions.",
  },
  ask: {
    eyebrow: "Grounded assistant",
    title: "Ask questions against your own material.",
    description: "Use your uploaded content as the source of truth and get citations back with every response.",
  },
  flashcards: {
    eyebrow: "Active recall lab",
    title: "Turn weak topics into compact review cycles.",
    description: "Generate a cleaner deck, move card by card, and push new ratings back into your progress data.",
  },
  quiz: {
    eyebrow: "Practice engine",
    title: "Build a short quiz and spot recall gaps fast.",
    description: "Mix question types, track answer progress live, and review feedback immediately after scoring.",
  },
  exam: {
    eyebrow: "Readiness simulator",
    title: "Run a timed set and see where you stand.",
    description: "Start a mixed session, submit once, and get readiness signals with strengths and weak areas.",
  },
  progress: {
    eyebrow: "Study analytics",
    title: "Watch confidence build across topics.",
    description: "Track readiness, quiz accuracy, flashcard coverage, and the recent actions feeding recommendations.",
  },
};

const askExamples = [
  "What should I review first?",
  "Summarize the hardest topic in my notes.",
  "Give me a quick exam-ready explanation.",
];

const quickActions: Array<{ title: string; detail: string; view: ViewKey; tag: string; icon: IconName }> = [
  { title: "Ask AI", detail: "Grounded answers from your uploads", view: "ask", tag: "Grounded", icon: "ask" },
  { title: "Flashcards", detail: "Fast review for weak topics", view: "flashcards", tag: "Recall", icon: "flashcards" },
  { title: "Quiz", detail: "Check retention in a few minutes", view: "quiz", tag: "Practice", icon: "quiz" },
  { title: "Exam mode", detail: "Run a timed readiness check", view: "exam", tag: "Timed", icon: "exam" },
];

function AppIcon({ name }: { name: IconName }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {name === "dashboard" ? (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...stroke} />
          <rect x="13.5" y="3.5" width="7" height="11" rx="2" {...stroke} />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...stroke} />
          <rect x="13.5" y="17.5" width="7" height="3" rx="1.5" {...stroke} />
        </>
      ) : null}
      {name === "upload" ? (
        <>
          <path d="M12 15V4.5" {...stroke} />
          <path d="M8 8.5L12 4.5L16 8.5" {...stroke} />
          <path d="M4 16.5V18.5C4 19.6 4.9 20.5 6 20.5H18C19.1 20.5 20 19.6 20 18.5V16.5" {...stroke} />
        </>
      ) : null}
      {name === "ask" ? (
        <>
          <path d="M12 3.5C7.3 3.5 3.5 6.7 3.5 10.8C3.5 12.9 4.5 14.7 6.2 16L5.2 20.5L9.3 18.2C10.2 18.4 11.1 18.5 12 18.5C16.7 18.5 20.5 15.3 20.5 11.2C20.5 7.1 16.7 3.5 12 3.5Z" {...stroke} />
          <path d="M9 10.8H15" {...stroke} />
          <path d="M9 13.8H12.5" {...stroke} />
        </>
      ) : null}
      {name === "flashcards" ? (
        <>
          <rect x="5" y="6" width="12" height="10" rx="2" {...stroke} />
          <path d="M8 3.5H18.5C19.6 3.5 20.5 4.4 20.5 5.5V14" {...stroke} />
          <path d="M8 10.5H14" {...stroke} />
        </>
      ) : null}
      {name === "quiz" ? (
        <>
          <path d="M8.5 7.5H18.5" {...stroke} />
          <path d="M8.5 12H18.5" {...stroke} />
          <path d="M8.5 16.5H13.5" {...stroke} />
          <circle cx="5.5" cy="7.5" r="1.25" {...stroke} />
          <circle cx="5.5" cy="12" r="1.25" {...stroke} />
          <circle cx="5.5" cy="16.5" r="1.25" {...stroke} />
        </>
      ) : null}
      {name === "exam" ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M12 7.5V12L15.5 14" {...stroke} />
        </>
      ) : null}
      {name === "progress" ? (
        <>
          <path d="M4 18.5H20" {...stroke} />
          <path d="M7 16V11" {...stroke} />
          <path d="M12 16V7.5" {...stroke} />
          <path d="M17 16V9.5" {...stroke} />
        </>
      ) : null}
      {name === "spark" ? (
        <>
          <path d="M12 3.5L13.8 8.2L18.5 10L13.8 11.8L12 16.5L10.2 11.8L5.5 10L10.2 8.2L12 3.5Z" {...stroke} />
          <path d="M18 16L18.8 18.2L21 19L18.8 19.8L18 22L17.2 19.8L15 19L17.2 18.2L18 16Z" {...stroke} />
        </>
      ) : null}
      {name === "shield" ? (
        <>
          <path d="M12 3.5L19 6.2V11.1C19 15.6 16.2 19.6 12 20.8C7.8 19.6 5 15.6 5 11.1V6.2L12 3.5Z" {...stroke} />
          <path d="M9.5 12.3L11.2 14L14.8 10.2" {...stroke} />
        </>
      ) : null}
      {name === "moon" ? (
        <path d="M16.5 4.2C15.8 4 15.1 3.9 14.3 3.9C9.8 3.9 6.1 7.6 6.1 12.1C6.1 16.6 9.8 20.3 14.3 20.3C17.9 20.3 21 18 22 14.8C21.2 15 20.5 15.1 19.7 15.1C15.2 15.1 11.5 11.4 11.5 6.9C11.5 5.9 11.7 5 12 4.2" {...stroke} />
      ) : null}
      {name === "refresh" ? (
        <>
          <path d="M19.5 8.5C18 5.8 15.2 4 12 4C7.3 4 3.5 7.8 3.5 12.5C3.5 17.2 7.3 21 12 21C15.8 21 19 18.5 20.1 15" {...stroke} />
          <path d="M19.5 4.5V8.8H15.2" {...stroke} />
        </>
      ) : null}
      {name === "library" ? (
        <>
          <path d="M5.5 4.5H9.5V19.5H5.5C4.4 19.5 3.5 18.6 3.5 17.5V6.5C3.5 5.4 4.4 4.5 5.5 4.5Z" {...stroke} />
          <path d="M10 4.5H14V19.5H10" {...stroke} />
          <path d="M14.5 4.5H18.5C19.6 4.5 20.5 5.4 20.5 6.5V17.5C20.5 18.6 19.6 19.5 18.5 19.5H14.5" {...stroke} />
        </>
      ) : null}
      {name === "camera" ? (
        <>
          <path d="M5 8.5H7.5L9 6.5H15L16.5 8.5H19C20.1 8.5 21 9.4 21 10.5V17.5C21 18.6 20.1 19.5 19 19.5H5C3.9 19.5 3 18.6 3 17.5V10.5C3 9.4 3.9 8.5 5 8.5Z" {...stroke} />
          <circle cx="12" cy="14" r="3.5" {...stroke} />
        </>
      ) : null}
      {name === "logout" ? (
        <>
          <path d="M10 4.5H6C4.9 4.5 4 5.4 4 6.5V17.5C4 18.6 4.9 19.5 6 19.5H10" {...stroke} />
          <path d="M14.5 8.5L19 12L14.5 15.5" {...stroke} />
          <path d="M9 12H19" {...stroke} />
        </>
      ) : null}
      {name === "bolt" ? (
        <path d="M13 2.8L6.8 12H11L10.8 21.2L17.2 12H13L13 2.8Z" {...stroke} />
      ) : null}
      {name === "clock" ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M12 7.5V12L15 13.8" {...stroke} />
        </>
      ) : null}
      {name === "user" ? (
        <>
          <circle cx="12" cy="8.2" r="3.2" {...stroke} />
          <path d="M5.5 18.5C6.9 15.8 9.2 14.5 12 14.5C14.8 14.5 17.1 15.8 18.5 18.5" {...stroke} />
        </>
      ) : null}
      {name === "target" ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <circle cx="12" cy="12" r="4.5" {...stroke} />
          <circle cx="12" cy="12" r="1.5" {...stroke} />
        </>
      ) : null}
    </svg>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function userInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem("prepmind-theme") === "dark" ? "dark" : "light";
  });
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [status, setStatus] = useState<"online" | "offline">("offline");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);

  const [workspaceMessage, setWorkspaceMessage] = useState("Loading your workspace...");
  const [authMessage, setAuthMessage] = useState("Sign in to open your study space.");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileDifficulty, setProfileDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  const [courseName, setCourseName] = useState("Biology 101");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("Drop in PDF, TXT, or DOCX files.");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryStatusFilter, setLibraryStatusFilter] = useState<"all" | "processed" | "processing" | "failed">("all");

  const [question, setQuestion] = useState("What topics should I review first for exam readiness?");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [askMessage, setAskMessage] = useState("Answers stay grounded in your uploaded material.");

  const [flashcardTopic, setFlashcardTopic] = useState("");
  const [flashcardCount, setFlashcardCount] = useState(6);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [flashcardMessage, setFlashcardMessage] = useState("Build a focused deck in one click.");
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);

  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [quizMessage, setQuizMessage] = useState("Spin up a short practice round.");

  const [examCount, setExamCount] = useState(10);
  const [examMinutes, setExamMinutes] = useState(20);
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examResult, setExamResult] = useState<ExamSubmitResponse | null>(null);
  const [examMessage, setExamMessage] = useState("Launch a timed readiness check.");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("prepmind-theme", theme);
  }, [theme]);

  function syncUserState(user: User | null) {
    setCurrentUser(user);
    if (!user) {
      setProfileName("");
      setProfileDifficulty("medium");
      setFlashcardDifficulty("medium");
      setQuizDifficulty("medium");
      return;
    }

    const difficulty = user.preferred_difficulty as "easy" | "medium" | "hard";
    setProfileName(user.name);
    setProfileDifficulty(difficulty);
    setFlashcardDifficulty(difficulty);
    setQuizDifficulty(difficulty);
  }

  async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    const [dashboardPayload, documentPayload, progressPayload, recommendationPayload, flashcardPayload] =
      await Promise.all([
        fetchDashboard(),
        fetchDocuments(),
        fetchProgress(),
        fetchRecommendations(),
        fetchFlashcards(),
      ]);

    return {
      dashboard: dashboardPayload,
      documents: documentPayload.items,
      progress: progressPayload,
      recommendations: recommendationPayload,
      flashcards: flashcardPayload.items,
    };
  }

  function clearWorkspace() {
    startTransition(() => {
      setDashboard(null);
      setDocuments([]);
      setProgress(null);
      setRecommendations([]);
      setFlashcards([]);
      setAnswer(null);
      setQuizQuestions([]);
      setQuizAnswers({});
      setQuizResult(null);
      setExamQuestions([]);
      setExamAnswers({});
      setExamResult(null);
    });
  }

  function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
    startTransition(() => {
      setDashboard(snapshot.dashboard);
      setDocuments(snapshot.documents);
      setProgress(snapshot.progress);
      setRecommendations(snapshot.recommendations);
      setFlashcards(snapshot.flashcards);
    });
  }

  async function refreshWorkspace(message?: string) {
    if (!currentUser) {
      clearWorkspace();
      return;
    }

    setWorkspaceMessage(message ?? "Refreshing your workspace...");
    try {
      const snapshot = await loadWorkspaceSnapshot();
      setStatus("online");
      applyWorkspaceSnapshot(snapshot);
      setWorkspaceMessage("Workspace synced.");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Authentication required.") {
        syncUserState(null);
        clearWorkspace();
        setAuthMessage("Your session expired. Sign in again to continue.");
      } else {
        setStatus("offline");
        setWorkspaceMessage("Backend offline. Start the API server to use the app.");
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        await fetchStatus();
        if (cancelled) {
          return;
        }
        setStatus("online");

        const session = await fetchSession();
        if (cancelled) {
          return;
        }

        if (!session.authenticated || !session.user) {
          syncUserState(null);
          clearWorkspace();
          setWorkspaceMessage("Backend online. Sign in to start building your study system.");
          setSessionChecked(true);
          return;
        }

        syncUserState(session.user);
        const snapshot = await loadWorkspaceSnapshot();
        if (cancelled) {
          return;
        }

        applyWorkspaceSnapshot(snapshot);
        setWorkspaceMessage("Workspace ready. Your study system is live.");
        setSessionChecked(true);
      } catch (error) {
        if (cancelled) {
          return;
        }
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

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("auth");
    setAuthMessage(authMode === "register" ? "Creating your account..." : "Signing you in...");

    try {
      const payload =
        authMode === "register"
          ? await registerUser({ name: authName, email: authEmail, password: authPassword })
          : await loginUser({ email: authEmail, password: authPassword });

      syncUserState(payload.user);
      setAuthPassword("");
      setAuthMessage(payload.message);
      const snapshot = await loadWorkspaceSnapshot();
      applyWorkspaceSnapshot(snapshot);
      setWorkspaceMessage("Workspace ready. Your study system is live.");
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
      setActiveView("dashboard");
      setAuthMode("login");
      setAuthPassword("");
      setWorkspaceMessage("Signed out successfully.");
      setAuthMessage("Sign in again to continue.");
    } catch (error) {
      console.error(error);
      setAuthMessage(error instanceof Error ? error.message : "Logout failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setBusyKey("profile-image");
    setWorkspaceMessage("Updating your profile photo...");
    try {
      const payload = await uploadProfileImage(file);
      syncUserState(payload.user);
      setWorkspaceMessage(payload.message);
    } catch (error) {
      console.error(error);
      setWorkspaceMessage(error instanceof Error ? error.message : "Profile image update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("profile");
    setWorkspaceMessage("Saving your profile settings...");
    try {
      const payload = await updateProfile({
        name: profileName,
        preferred_difficulty: profileDifficulty,
      });
      syncUserState(payload.user);
      setWorkspaceMessage(payload.message);
    } catch (error) {
      console.error(error);
      setWorkspaceMessage(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadMessage("Choose a file before uploading.");
      return;
    }

    setBusyKey("upload");
    setUploadMessage("Uploading, extracting text, and indexing topics...");
    try {
      const payload = await uploadDocument(selectedFile, courseName, replaceExisting);
      setUploadMessage(`${payload.message} Topics detected: ${payload.topics_detected.join(", ")}.`);
      setSelectedFile(null);
      setReplaceExisting(false);
      await refreshWorkspace("Refreshing after upload...");
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteDocument(documentId: number) {
    setBusyKey(`delete-${documentId}`);
    setUploadMessage("Removing document and indexed chunks...");
    try {
      const payload = await deleteDocument(documentId);
      setUploadMessage(payload.message);
      await refreshWorkspace("Refreshing after delete...");
    } catch (error) {
      console.error(error);
      setUploadMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("ask");
    setAskMessage("Searching the indexed study material...");
    try {
      const payload = await askQuestion(question);
      setAnswer(payload);
      setAskMessage(`Grounded response created with ${Math.round(payload.confidence * 100)}% confidence.`);
      await refreshWorkspace("Refreshing after study interaction...");
    } catch (error) {
      console.error(error);
      setAskMessage(error instanceof Error ? error.message : "Ask failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGenerateFlashcards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("flashcards");
    setFlashcardMessage("Generating a fresh flashcard deck...");
    try {
      const payload = await generateFlashcards({
        topic: flashcardTopic.trim() || undefined,
        count: flashcardCount,
        difficulty: flashcardDifficulty,
      });
      setFlashcards(payload.items);
      setActiveFlashcardIndex(0);
      setFlashcardMessage(payload.message);
      await refreshWorkspace("Refreshing after flashcard generation...");
    } catch (error) {
      console.error(error);
      setFlashcardMessage(error instanceof Error ? error.message : "Flashcard generation failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRateFlashcard(flashcardId: number, rating: "easy" | "medium" | "hard") {
    setBusyKey(`flashcard-rate-${flashcardId}`);
    try {
      const updated = await rateFlashcard(flashcardId, rating);
      setFlashcards((current) => current.map((card) => (card.id === flashcardId ? updated : card)));
      setFlashcardMessage(`Flashcard rated ${rating}. Progress signals updated.`);
      await refreshWorkspace("Refreshing after flashcard rating...");
    } catch (error) {
      console.error(error);
      setFlashcardMessage(error instanceof Error ? error.message : "Flashcard rating failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGenerateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("quiz-generate");
    setQuizMessage("Building a quiz from your indexed material...");
    try {
      const payload = await generateQuiz({
        topic: quizTopic.trim() || undefined,
        difficulty: quizDifficulty,
        question_count: quizCount,
      });
      setQuizQuestions(payload.questions);
      setQuizAnswers({});
      setQuizResult(null);
      setQuizMessage(payload.message);
    } catch (error) {
      console.error(error);
      setQuizMessage(error instanceof Error ? error.message : "Quiz generation failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSubmitQuiz() {
    if (quizQuestions.length === 0) {
      setQuizMessage("Generate a quiz first.");
      return;
    }
    setBusyKey("quiz-submit");
    setQuizMessage("Scoring your quiz...");
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
      setQuizMessage("Quiz scored successfully.");
      await refreshWorkspace("Refreshing after quiz submission...");
    } catch (error) {
      console.error(error);
      setQuizMessage(error instanceof Error ? error.message : "Quiz submit failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleStartExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("exam-start");
    setExamMessage("Preparing your timed exam simulation...");
    try {
      const payload = await startExam({ question_count: examCount, minutes: examMinutes });
      setExamQuestions(payload.questions);
      setExamAnswers({});
      setExamResult(null);
      setExamMessage(`${payload.message} ${payload.duration_minutes} minute session ready.`);
    } catch (error) {
      console.error(error);
      setExamMessage(error instanceof Error ? error.message : "Exam start failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSubmitExam() {
    if (examQuestions.length === 0) {
      setExamMessage("Start an exam first.");
      return;
    }
    setBusyKey("exam-submit");
    setExamMessage("Scoring exam performance...");
    try {
      const result = await submitExam(
        examQuestions.map((item, index) => ({
          prompt: item.prompt,
          topic_name: item.topic_name,
          question_type: item.question_type,
          difficulty: item.difficulty,
          answer_token: item.answer_token,
          student_answer: examAnswers[index] ?? "",
        })),
        examMinutes,
      );
      setExamResult(result);
      setExamMessage("Exam scored successfully.");
      await refreshWorkspace("Refreshing after exam submission...");
    } catch (error) {
      console.error(error);
      setExamMessage(error instanceof Error ? error.message : "Exam submit failed.");
    } finally {
      setBusyKey(null);
    }
  }

  const heroStats = dashboard?.stats ?? [];
  const weakTopics = dashboard?.weak_topics ?? [];
  const recentDocuments = dashboard?.recent_documents ?? [];
  const currentFlashcard = flashcards[activeFlashcardIndex] ?? null;
  const spotlightRecommendation = recommendations[0] ?? null;
  const spotlightTopic = weakTopics[0] ?? null;
  const processedDocuments = documents.filter((document) => document.processing_status === "processed").length;
  const quizAnsweredCount = Object.values(quizAnswers).filter((value) => String(value).trim().length > 0).length;
  const examAnsweredCount = Object.values(examAnswers).filter((value) => String(value).trim().length > 0).length;
  const quizProgress = quizQuestions.length ? Math.round((quizAnsweredCount / quizQuestions.length) * 100) : 0;
  const examProgress = examQuestions.length ? Math.round((examAnsweredCount / examQuestions.length) * 100) : 0;
  const activeMeta = viewMeta[activeView];
  const readinessValue = Math.round(progress?.readiness_score ?? 0);
  const quizAccuracy = Math.round(progress?.quiz_accuracy ?? 0);
  const firstName = currentUser?.name.split(" ")[0] ?? "Learner";
  const profileImageUrl = currentUser?.profile_image_url ?? null;
  const preferredDifficulty = currentUser?.preferred_difficulty ?? profileDifficulty;
  const docsReadyPercent = documents.length ? Math.round((processedDocuments / documents.length) * 100) : 0;
  const filteredDocuments = documents.filter((document) => {
    const matchesSearch =
      !librarySearch.trim() ||
      `${document.document_name} ${document.course_name} ${document.topic_summary}`.toLowerCase().includes(librarySearch.trim().toLowerCase());
    const matchesStatus = libraryStatusFilter === "all" || document.processing_status === libraryStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const focusAction =
    spotlightRecommendation?.action ??
    (spotlightTopic
      ? `Review ${spotlightTopic.topic_name} first. It is your weakest tracked topic right now.`
      : "Upload a file to unlock recommendations, decks, and timed practice.");
  const orbitalStyle: CSSProperties = { "--score": `${readinessValue}%` } as CSSProperties;

  function renderDashboard() {
    return (
      <section className="page-grid dashboard-grid">
        <article className="panel panel-span-2 narrative-card">
          <div className="panel-topline">
            <span className="eyebrow-pill">Today board</span>
            <span className="mini-pill">{status === "online" ? "Live sync" : "Offline"}</span>
          </div>
          <h2>Keep the next study block focused, visual, and easy to start.</h2>
          <p className="section-copy">{focusAction}</p>
          <div className="story-grid">
            <article className="story-step">
              <span className="story-icon">
                <AppIcon name="upload" />
              </span>
              <strong>{documents.length} materials</strong>
              <p>{documents.length ? `${processedDocuments} indexed and ready for retrieval.` : "Start by bringing in your first file."}</p>
            </article>
            <article className="story-step">
              <span className="story-icon">
                <AppIcon name="target" />
              </span>
              <strong>{weakTopics.length || 1} focus lane</strong>
              <p>{spotlightTopic ? `${spotlightTopic.topic_name} needs the most attention right now.` : "Weak-topic tracking starts after upload and review."}</p>
            </article>
            <article className="story-step">
              <span className="story-icon">
                <AppIcon name="bolt" />
              </span>
              <strong>{flashcards.length} review cards</strong>
              <p>{flashcards.length ? "Your active recall deck is ready to reuse." : "Generate a deck to turn notes into rapid recall."}</p>
            </article>
          </div>
          <div className="hero-cta-row">
            <button className="primary-button" onClick={() => setActiveView("ask")} type="button">
              <AppIcon name="ask" />
              Ask a question
            </button>
            <button className="secondary-button" onClick={() => setActiveView("upload")} type="button">
              <AppIcon name="upload" />
              Add material
            </button>
          </div>
        </article>

        <article className="panel pulse-card">
          <div className="panel-topline">
            <span className="eyebrow-pill">Readiness pulse</span>
            <span className="mini-pill">{quizAccuracy}% quiz accuracy</span>
          </div>
          <div className="orbital-score">
            <div className="orbital-ring" style={orbitalStyle}>
              <strong>{readinessValue}%</strong>
              <span>ready</span>
            </div>
          </div>
          <p className="section-copy">
            {readinessValue >= 70
              ? "Your current signals are trending strong. Keep pressure on the weakest topic to close the gap."
              : "You have momentum, but there is still room to tighten recall before exam mode."}
          </p>
        </article>

        <div className="stats-ribbon panel-span-3">
          {heroStats.map((stat) => (
            <article className={`stat-tile tone-${stat.tone}`} key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>

        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Focus topics</span>
            <span className="mini-pill">{weakTopics.length || 0} tracked</span>
          </div>
          <div className="stack-list">
            {weakTopics.length ? (
              weakTopics.map((topic) => (
                <article key={topic.topic_name} className="topic-row-card">
                  <div className="topic-row-head">
                    <div>
                      <strong>{topic.topic_name}</strong>
                      <p>{topic.study_frequency} review cycles</p>
                    </div>
                    <span>{Math.round(topic.mastery_score)}%</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${Math.max(8, topic.mastery_score)}%` }} />
                  </div>
                </article>
              ))
            ) : (
              <article className="empty-block">
                <AppIcon name="progress" />
                <strong>No weak topics yet</strong>
                <p>Upload material and complete a few actions to start tracking confidence.</p>
              </article>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Library pulse</span>
            <span className="mini-pill">{docsReadyPercent}% ready</span>
          </div>
          <div className="stack-list">
            {recentDocuments.length ? (
              recentDocuments.map((document) => (
                <article key={document.id} className="library-row">
                  <div className="library-icon">
                    <AppIcon name="library" />
                  </div>
                  <div>
                    <strong>{document.name}</strong>
                    <p>{document.course_name}</p>
                    <small>{document.chunk_count} chunks indexed</small>
                  </div>
                </article>
              ))
            ) : (
              <article className="empty-block">
                <AppIcon name="library" />
                <strong>No material yet</strong>
                <p>Bring in notes, handouts, or revision guides to activate the workspace.</p>
              </article>
            )}
          </div>
        </article>

        <article className="panel panel-span-2">
          <div className="panel-topline">
            <span className="eyebrow-pill">Smart launches</span>
            <span className="mini-pill">1 click</span>
          </div>
          <div className="action-mosaic">
            {quickActions.map((action) => (
              <button className="launch-card" key={action.title} onClick={() => setActiveView(action.view)} type="button">
                <span className="launch-icon">
                  <AppIcon name={action.icon} />
                </span>
                <div>
                  <span className="launch-tag">{action.tag}</span>
                  <strong>{action.title}</strong>
                  <p>{action.detail}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel panel-span-3">
          <div className="panel-topline">
            <span className="eyebrow-pill">Recommendations</span>
            <span className="mini-pill">{recommendations.length ? "Adaptive" : "Waiting for data"}</span>
          </div>
          <div className="recommendation-grid">
            {recommendations.length ? (
              recommendations.map((item) => (
                <article className="recommendation-card" key={item.topic}>
                  <div className="card-icon-shell">
                    <AppIcon name="spark" />
                  </div>
                  <div>
                    <strong>{item.topic}</strong>
                    <p>{item.action}</p>
                    <small>{item.reason}</small>
                  </div>
                </article>
              ))
            ) : (
              <article className="empty-block wide">
                <AppIcon name="spark" />
                <strong>Recommendations appear after your first upload</strong>
                <p>The dashboard will start nudging you toward the best next action once material is indexed.</p>
              </article>
            )}
          </div>
        </article>
      </section>
    );
  }

  function renderUpload() {
    return (
      <section className="page-grid">
        <article className="panel panel-span-2 upload-hero-card">
          <div className="upload-hero-copy">
            <span className="eyebrow-pill">Upload studio</span>
            <h2>Feed the engine with clean study material.</h2>
            <p className="section-copy">PDF, TXT, and DOCX files flow into the same retrieval and practice pipeline.</p>
            <form className="form-grid" onSubmit={handleUpload}>
              <label>
                Course label
                <input onChange={(event) => setCourseName(event.target.value)} value={courseName} />
              </label>
              <label className="file-drop-card">
                <span className="file-drop-icon">
                  <AppIcon name="upload" />
                </span>
                <strong>{selectedFile ? selectedFile.name : "Choose a study file"}</strong>
                <p>{selectedFile ? "Ready to upload and index." : "Drop in a file or browse from your device."}</p>
                <input accept=".pdf,.txt,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} type="file" />
              </label>
              <label className="toggle-row">
                <input checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} type="checkbox" />
                <span>Replace a matching document in the same course</span>
              </label>
              <button className="primary-button" disabled={busyKey === "upload"} type="submit">
                <AppIcon name="upload" />
                {busyKey === "upload" ? "Processing..." : "Upload and index"}
              </button>
            </form>
            <p className="status-note">{uploadMessage}</p>
          </div>
          <div className="upload-side-panel">
            <div className="side-stat">
              <strong>{documents.length}</strong>
              <span>files in library</span>
            </div>
            <div className="side-stat">
              <strong>{processedDocuments}</strong>
              <span>processed</span>
            </div>
            <div className="side-stat">
              <strong>{docsReadyPercent}%</strong>
              <span>ready for retrieval</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Library health</span>
            <span className="mini-pill">{processedDocuments}/{documents.length} ready</span>
          </div>
          <div className="stack-list">
            <article className="compact-metric">
              <strong>{processedDocuments}</strong>
              <span>Indexed documents</span>
            </article>
            <article className="compact-metric">
              <strong>{documents.length - processedDocuments}</strong>
              <span>Still processing or failed</span>
            </article>
            <article className="compact-metric">
              <strong>{documents.reduce((total, item) => total + item.chunk_count, 0)}</strong>
              <span>Total chunks</span>
            </article>
          </div>
        </article>

        <article className="panel panel-span-3">
          <div className="panel-topline">
            <span className="eyebrow-pill">Study library</span>
            <span className="mini-pill">{filteredDocuments.length} shown</span>
          </div>
          <div className="library-toolbar">
            <label>
              Search files
              <input onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search by file, course, or topic summary" value={librarySearch} />
            </label>
            <label>
              Status
              <select onChange={(event) => setLibraryStatusFilter(event.target.value as "all" | "processed" | "processing" | "failed")} value={libraryStatusFilter}>
                <option value="all">All statuses</option>
                <option value="processed">Processed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>
          <div className="document-grid">
            {filteredDocuments.length ? (
              filteredDocuments.map((document) => (
                <article className="document-surface" key={document.id}>
                  <div className="document-surface-head">
                    <span className="document-badge">
                      <AppIcon name="library" />
                    </span>
                    <div className="document-tags">
                      <span className="mini-pill">{document.course_name}</span>
                      <span className="mini-pill">{document.document_type.toUpperCase()}</span>
                      <span className="mini-pill">{document.processing_status}</span>
                    </div>
                  </div>
                  <strong>{document.document_name}</strong>
                  <p>{document.topic_summary || "Topic summary appears after processing."}</p>
                  <small>
                    {document.chunk_count} chunks | {document.extracted_word_count} words |{" "}
                    {Math.max(1, Math.round(document.file_size_bytes / 1024))} KB
                  </small>
                  {document.error_message ? <small className="danger-note">{document.error_message}</small> : null}
                  <button
                    className="secondary-button danger-button"
                    disabled={busyKey === `delete-${document.id}`}
                    onClick={() => handleDeleteDocument(document.id)}
                    type="button"
                  >
                    {busyKey === `delete-${document.id}` ? "Deleting..." : "Delete"}
                  </button>
                </article>
              ))
            ) : (
              <article className="empty-block wide">
                <AppIcon name="upload" />
                <strong>{documents.length ? "No files match the current filters" : "Your library is empty"}</strong>
                <p>
                  {documents.length
                    ? "Try a different search or status filter."
                    : "Upload your first file and this space becomes the source for questions, flashcards, quizzes, and exam sessions."}
                </p>
              </article>
            )}
          </div>
        </article>
      </section>
    );
  }

  function renderAsk() {
    return (
      <section className="page-grid">
        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Composer</span>
            <span className="mini-pill">Grounded only</span>
          </div>
          <h2>Ask directly against your uploaded material.</h2>
          <form className="form-grid" onSubmit={handleAsk}>
            <label>
              Study question
              <textarea onChange={(event) => setQuestion(event.target.value)} rows={8} value={question} />
            </label>
            <div className="chip-row">
              {askExamples.map((example) => (
                <button className="chip-button" key={example} onClick={() => setQuestion(example)} type="button">
                  {example}
                </button>
              ))}
            </div>
            <button className="primary-button" disabled={busyKey === "ask"} type="submit">
              <AppIcon name="ask" />
              {busyKey === "ask" ? "Searching..." : "Ask PrepMind"}
            </button>
          </form>
          <p className="status-note">{askMessage}</p>
        </article>

        <article className="panel panel-span-2 answer-stage">
          <div className="panel-topline">
            <span className="eyebrow-pill">Response stage</span>
            <span className="mini-pill">{answer ? `${Math.round(answer.confidence * 100)}% confidence` : "Waiting"}</span>
          </div>
          {answer ? (
            <>
              <article className="answer-hero-card">
                <div className="card-icon-shell">
                  <AppIcon name="spark" />
                </div>
                <p>{answer.answer}</p>
              </article>
              <div className="citation-grid">
                {answer.citations.map((citation, index) => (
                  <article className="citation-card" key={`${citation.document_name}-${index}`}>
                    <span className="mini-pill">{citation.topic_label}</span>
                    <strong>{citation.document_name}</strong>
                    <p>{citation.snippet}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <article className="empty-block tall">
              <AppIcon name="ask" />
              <strong>Ask anything about your uploaded material</strong>
              <p>When you send a question, this panel will fill with a concise answer and the source snippets behind it.</p>
            </article>
          )}
        </article>
      </section>
    );
  }

  function renderFlashcards() {
    return (
      <section className="page-grid">
        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Deck builder</span>
            <span className="mini-pill">Default {preferredDifficulty}</span>
          </div>
          <form className="form-grid" onSubmit={handleGenerateFlashcards}>
            <label>
              Topic filter
              <input onChange={(event) => setFlashcardTopic(event.target.value)} placeholder="Leave blank for mixed topics" value={flashcardTopic} />
            </label>
            <label>
              Count
              <input max={20} min={1} onChange={(event) => setFlashcardCount(Number(event.target.value))} type="number" value={flashcardCount} />
            </label>
            <label>
              Difficulty
              <select onChange={(event) => setFlashcardDifficulty(event.target.value as "easy" | "medium" | "hard")} value={flashcardDifficulty}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <button className="primary-button" disabled={busyKey === "flashcards"} type="submit">
              <AppIcon name="flashcards" />
              {busyKey === "flashcards" ? "Generating..." : "Generate deck"}
            </button>
          </form>
          <p className="status-note">{flashcardMessage}</p>
        </article>

        <article className="panel panel-span-2">
          <div className="panel-topline">
            <span className="eyebrow-pill">Deck stage</span>
            <span className="mini-pill">{currentFlashcard ? `${activeFlashcardIndex + 1}/${flashcards.length}` : "No deck"}</span>
          </div>
          {currentFlashcard ? (
            <>
              <article className="flashcard-canvas">
                <div className="flashcard-header">
                  <span className="mini-pill">{currentFlashcard.topic_name}</span>
                  <span className="mini-pill">{currentFlashcard.difficulty}</span>
                </div>
                <div className="progress-track compact-track">
                  <span style={{ width: `${Math.round(((activeFlashcardIndex + 1) / flashcards.length) * 100)}%` }} />
                </div>
                <h2>{currentFlashcard.question}</h2>
                <p>{currentFlashcard.answer}</p>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    disabled={activeFlashcardIndex === 0}
                    onClick={() => setActiveFlashcardIndex((value) => Math.max(0, value - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="secondary-button"
                    disabled={activeFlashcardIndex >= flashcards.length - 1}
                    onClick={() => setActiveFlashcardIndex((value) => Math.min(flashcards.length - 1, value + 1))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
                <div className="rating-row">
                  <button className="rate-button" onClick={() => handleRateFlashcard(currentFlashcard.id, "easy")} type="button">
                    Easy
                  </button>
                  <button className="rate-button" onClick={() => handleRateFlashcard(currentFlashcard.id, "medium")} type="button">
                    Medium
                  </button>
                  <button className="rate-button" onClick={() => handleRateFlashcard(currentFlashcard.id, "hard")} type="button">
                    Hard
                  </button>
                </div>
              </article>
              <div className="deck-rail">
                {flashcards.map((card, index) => (
                  <button className={index === activeFlashcardIndex ? "rail-card active" : "rail-card"} key={card.id} onClick={() => setActiveFlashcardIndex(index)} type="button">
                    <strong>{card.topic_name}</strong>
                    <p>{card.student_rating ? `Rated ${card.student_rating}` : "Unrated"}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <article className="empty-block tall">
              <AppIcon name="flashcards" />
              <strong>Generate a review deck</strong>
              <p>We will build cards from uploaded material and weaker areas so recall practice feels lightweight.</p>
            </article>
          )}
        </article>
      </section>
    );
  }

  function renderQuiz() {
    return (
      <section className="page-grid">
        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Quiz builder</span>
            <span className="mini-pill">Default {preferredDifficulty}</span>
          </div>
          <form className="form-grid" onSubmit={handleGenerateQuiz}>
            <label>
              Topic filter
              <input onChange={(event) => setQuizTopic(event.target.value)} placeholder="Leave blank for mixed topics" value={quizTopic} />
            </label>
            <label>
              Question count
              <input max={20} min={1} onChange={(event) => setQuizCount(Number(event.target.value))} type="number" value={quizCount} />
            </label>
            <label>
              Difficulty
              <select onChange={(event) => setQuizDifficulty(event.target.value as "easy" | "medium" | "hard")} value={quizDifficulty}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <button className="primary-button" disabled={busyKey === "quiz-generate"} type="submit">
              <AppIcon name="quiz" />
              {busyKey === "quiz-generate" ? "Generating..." : "Generate quiz"}
            </button>
          </form>
          <p className="status-note">{quizMessage}</p>
        </article>

        <article className="panel panel-span-2">
          <div className="panel-topline">
            <span className="eyebrow-pill">Quiz session</span>
            <span className="mini-pill">{quizProgress}% complete</span>
          </div>
          {quizQuestions.length ? (
            <>
              <article className="session-banner">
                <div>
                  <strong>{quizAnsweredCount} of {quizQuestions.length} answered</strong>
                  <p>Short practice, clear feedback, and fast scoring.</p>
                </div>
                <button className="primary-button" disabled={busyKey === "quiz-submit"} onClick={handleSubmitQuiz} type="button">
                  {busyKey === "quiz-submit" ? "Scoring..." : "Submit quiz"}
                </button>
              </article>
              <div className="progress-track compact-track">
                <span style={{ width: `${quizProgress}%` }} />
              </div>
              <div className="question-stack">
                {quizQuestions.map((item, index) => (
                  <article className="question-surface" key={`${item.topic_name}-${index}`}>
                    <div className="question-top">
                      <span className="mini-pill">{item.topic_name}</span>
                      <span className="mini-pill">{item.question_type}</span>
                    </div>
                    <strong>{index + 1}. {item.prompt}</strong>
                    {item.options.length ? (
                      <div className="option-grid">
                        {item.options.map((option) => (
                          <label className="option-card" key={option.id}>
                            <input
                              checked={quizAnswers[index] === option.id}
                              name={`quiz-${index}`}
                              onChange={() => setQuizAnswers((current) => ({ ...current, [index]: option.id }))}
                              type="radio"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        onChange={(event) => setQuizAnswers((current) => ({ ...current, [index]: event.target.value }))}
                        rows={3}
                        value={quizAnswers[index] ?? ""}
                      />
                    )}
                    <small>{item.source_snippet}</small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <article className="empty-block tall">
              <AppIcon name="quiz" />
              <strong>Generate a quick quiz</strong>
              <p>A short round is the fastest way to spot weak recall and build better next-step recommendations.</p>
            </article>
          )}

          {quizResult ? (
            <div className="results-grid">
              <article className="score-card">
                <strong>{quizResult.score_percent}%</strong>
                <p>{quizResult.correct_count} of {quizResult.total_questions} correct</p>
              </article>
              {quizResult.results.map((item, index) => (
                <article className={item.is_correct ? "result-card success" : "result-card warning"} key={`${item.topic_name}-${index}`}>
                  <strong>{item.topic_name}</strong>
                  <p>{item.prompt}</p>
                  <small>Your answer: {item.student_answer || "No answer"} | Expected: {item.correct_answer}</small>
                  <small>{item.feedback}</small>
                </article>
              ))}
            </div>
          ) : null}
        </article>
      </section>
    );
  }

  function renderExam() {
    return (
      <section className="page-grid">
        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Exam setup</span>
            <span className="mini-pill">{examMinutes} min</span>
          </div>
          <form className="form-grid" onSubmit={handleStartExam}>
            <label>
              Questions
              <input max={30} min={3} onChange={(event) => setExamCount(Number(event.target.value))} type="number" value={examCount} />
            </label>
            <label>
              Minutes
              <input max={120} min={5} onChange={(event) => setExamMinutes(Number(event.target.value))} type="number" value={examMinutes} />
            </label>
            <button className="primary-button" disabled={busyKey === "exam-start"} type="submit">
              <AppIcon name="clock" />
              {busyKey === "exam-start" ? "Building..." : "Start exam"}
            </button>
          </form>
          <p className="status-note">{examMessage}</p>
        </article>

        <article className="panel panel-span-2">
          <div className="panel-topline">
            <span className="eyebrow-pill">Timed session</span>
            <span className="mini-pill">{examProgress}% complete</span>
          </div>
          {examQuestions.length ? (
            <>
              <article className="session-banner danger-surface">
                <div>
                  <strong>{examAnsweredCount} of {examQuestions.length} answered</strong>
                  <p>{examMinutes} minute simulation with mixed question types.</p>
                </div>
                <button className="primary-button" disabled={busyKey === "exam-submit"} onClick={handleSubmitExam} type="button">
                  {busyKey === "exam-submit" ? "Scoring..." : "Submit exam"}
                </button>
              </article>
              <div className="progress-track compact-track">
                <span style={{ width: `${examProgress}%` }} />
              </div>
              <div className="question-stack">
                {examQuestions.map((item, index) => (
                  <article className="question-surface" key={`${item.topic_name}-${index}`}>
                    <div className="question-top">
                      <span className="mini-pill">{item.topic_name}</span>
                      <span className="mini-pill">{item.question_type}</span>
                    </div>
                    <strong>{index + 1}. {item.prompt}</strong>
                    {item.options.length ? (
                      <div className="option-grid">
                        {item.options.map((option) => (
                          <label className="option-card" key={option.id}>
                            <input
                              checked={examAnswers[index] === option.id}
                              name={`exam-${index}`}
                              onChange={() => setExamAnswers((current) => ({ ...current, [index]: option.id }))}
                              type="radio"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        onChange={(event) => setExamAnswers((current) => ({ ...current, [index]: event.target.value }))}
                        rows={3}
                        value={examAnswers[index] ?? ""}
                      />
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <article className="empty-block tall">
              <AppIcon name="exam" />
              <strong>Start a timed set</strong>
              <p>You will get a mixed question set and a readiness estimate once you submit the session.</p>
            </article>
          )}

          {examResult ? (
            <div className="results-grid">
              <article className="score-card highlight">
                <strong>{examResult.readiness_score}%</strong>
                <p>Readiness estimate with exam score {examResult.score_percent}%</p>
              </article>
              <article className="insight-card">
                <strong>Strong topics</strong>
                <p>{examResult.strong_topics.join(", ") || "None yet"}</p>
              </article>
              <article className="insight-card">
                <strong>Weak topics</strong>
                <p>{examResult.weak_topics.join(", ") || "None flagged"}</p>
              </article>
              {examResult.feedback.map((line) => (
                <article className="result-card" key={line}>
                  <p>{line}</p>
                </article>
              ))}
            </div>
          ) : null}
        </article>
      </section>
    );
  }

  function renderProgress() {
    return (
      <section className="page-grid">
        <div className="stats-ribbon panel-span-3">
          <article className="stat-tile tone-accent">
            <span>Readiness score</span>
            <strong>{readinessValue}%</strong>
          </article>
          <article className="stat-tile tone-info">
            <span>Quiz accuracy</span>
            <strong>{quizAccuracy}%</strong>
          </article>
          <article className="stat-tile tone-success">
            <span>Flashcards</span>
            <strong>{progress?.flashcard_coverage ?? 0}</strong>
          </article>
          <article className="stat-tile tone-accent">
            <span>Active topics</span>
            <strong>{progress?.study_streak_days ?? 0}</strong>
          </article>
        </div>

        <article className="panel panel-span-2">
          <div className="panel-topline">
            <span className="eyebrow-pill">Mastery map</span>
            <span className="mini-pill">{progress?.topic_mastery.length ?? 0} topics</span>
          </div>
          <div className="stack-list">
            {progress?.topic_mastery.length ? (
              progress.topic_mastery.map((topic) => (
                <article className="topic-row-card" key={topic.topic_name}>
                  <div className="topic-row-head">
                    <div>
                      <strong>{topic.topic_name}</strong>
                      <p>{topic.study_frequency} review cycles</p>
                    </div>
                    <span>{Math.round(topic.mastery_score)}%</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${Math.max(8, topic.mastery_score)}%` }} />
                  </div>
                  <small>Last reviewed {formatDate(topic.last_reviewed)}</small>
                </article>
              ))
            ) : (
              <article className="empty-block wide">
                <AppIcon name="progress" />
                <strong>Your mastery map will appear here</strong>
                <p>Upload material, review a deck, or finish a quiz to start building progress signals.</p>
              </article>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-topline">
            <span className="eyebrow-pill">Activity feed</span>
            <span className="mini-pill">Recent</span>
          </div>
          <div className="timeline-list">
            {progress?.recent_activity.length ? (
              progress.recent_activity.map((item) => (
                <article className="timeline-item" key={item}>
                  <span className="timeline-dot" />
                  <p>{item}</p>
                </article>
              ))
            ) : (
              <article className="empty-block">
                <AppIcon name="spark" />
                <strong>No recent activity</strong>
                <p>Your latest study actions will show up here.</p>
              </article>
            )}
          </div>
        </article>
      </section>
    );
  }

  function renderCurrentView() {
    if (activeView === "dashboard") return renderDashboard();
    if (activeView === "upload") return renderUpload();
    if (activeView === "ask") return renderAsk();
    if (activeView === "flashcards") return renderFlashcards();
    if (activeView === "quiz") return renderQuiz();
    if (activeView === "exam") return renderExam();
    return renderProgress();
  }

  if (!sessionChecked) {
    return (
      <div className="app-shell auth-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <article className="auth-card loading-card">
          <img alt="PrepMind AI logo" className="logo-mark large-mark" src={logoMark} />
          <p className="section-kicker">PrepMind AI</p>
          <h1>Loading your workspace...</h1>
          <p className="muted-text">{workspaceMessage}</p>
        </article>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-shell auth-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />
        <section className="auth-stage">
          <article className="auth-showcase">
            <div className="brand-lockup">
              <img alt="PrepMind AI logo" className="logo-mark auth-mark" src={logoMark} />
              <div>
                <p className="section-kicker">PrepMind AI</p>
                <span className="brand-caption">Adaptive study workspace</span>
              </div>
            </div>
            <h1>Rebuilt as a study product, not a text-heavy tool.</h1>
            <p className="lead-copy">
              Upload course material, ask grounded questions, generate recall decks, run quizzes, and track readiness in one visual flow.
            </p>
            <div className="showcase-grid">
              <article className="showcase-card">
                <span className="showcase-icon">
                  <AppIcon name="shield" />
                </span>
                <strong>Private by account</strong>
                <p>Each learner keeps separate files, sessions, and progress.</p>
              </article>
              <article className="showcase-card">
                <span className="showcase-icon">
                  <AppIcon name="spark" />
                </span>
                <strong>From upload to exam</strong>
                <p>Everything moves through one connected workspace.</p>
              </article>
              <article className="showcase-card">
                <span className="showcase-icon">
                  <AppIcon name="moon" />
                </span>
                <strong>Designed to feel lighter</strong>
                <p>Cleaner sections, stronger hierarchy, and better mobile behavior.</p>
              </article>
            </div>
            <div className="auth-metric-row">
              <article className="auth-metric">
                <strong>Grounded</strong>
                <span>Answers use your material</span>
              </article>
              <article className="auth-metric">
                <strong>Adaptive</strong>
                <span>Recommendations change with study signals</span>
              </article>
              <article className="auth-metric">
                <strong>Persistent</strong>
                <span>Sessions keep your workspace state in place</span>
              </article>
            </div>
          </article>

          <article className="auth-card">
            <div className="auth-card-head">
              <div>
                <span className="eyebrow-pill">Access</span>
                <h2>{authMode === "register" ? "Create your account" : "Sign in to your workspace"}</h2>
              </div>
              <button className="theme-toggle" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))} type="button">
                <AppIcon name="moon" />
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
            </div>

            <div className="auth-toggle">
              <button className={authMode === "login" ? "segment active" : "segment"} onClick={() => setAuthMode("login")} type="button">
                Login
              </button>
              <button className={authMode === "register" ? "segment active" : "segment"} onClick={() => setAuthMode("register")} type="button">
                Register
              </button>
            </div>

            <form className="form-grid" onSubmit={handleAuthSubmit}>
              {authMode === "register" ? (
                <label>
                  Full name
                  <input onChange={(event) => setAuthName(event.target.value)} placeholder="Ava Johnson" value={authName} />
                </label>
              ) : null}
              <label>
                Email
                <input onChange={(event) => setAuthEmail(event.target.value)} placeholder="ava@example.com" type="email" value={authEmail} />
              </label>
              <label>
                Password
                <input
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  type="password"
                  value={authPassword}
                />
              </label>
              <button className="primary-button" disabled={busyKey === "auth" || status === "offline"} type="submit">
                <AppIcon name="user" />
                {busyKey === "auth" ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="status-note">{authMessage}</p>
            <p className="status-inline">Backend: {status}</p>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell-redesign">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      <div className="workspace-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-lockup">
              <img alt="PrepMind AI logo" className="logo-mark" src={logoMark} />
              <div>
                <p className="section-kicker">PrepMind AI</p>
                <span className="brand-caption">Adaptive study workspace</span>
              </div>
            </div>
            <span className="status-badge">{status === "online" ? "Workspace live" : "Backend offline"}</span>
          </div>

          <nav className="sidebar-nav" aria-label="Workspace sections">
            {views.map((view) => (
              <button
                className={view.key === activeView ? "nav-pill active" : "nav-pill"}
                key={view.key}
                onClick={() => setActiveView(view.key)}
                type="button"
              >
                <span className="nav-pill-icon">
                  <AppIcon name={view.icon} />
                </span>
                <span className="nav-pill-copy">
                  <small>{view.caption}</small>
                  <strong>{view.label}</strong>
                </span>
              </button>
            ))}
          </nav>

          <article className="profile-card">
            <div className="profile-head">
              {profileImageUrl ? (
                <img alt={`${currentUser.name} profile`} className="profile-avatar" src={profileImageUrl} />
              ) : (
                <div className="profile-avatar avatar-fallback">{userInitials(currentUser.name)}</div>
              )}
              <div>
                <strong>{currentUser.name}</strong>
                <p>{currentUser.email}</p>
              </div>
            </div>
            <label className="avatar-upload-button">
              <AppIcon name="camera" />
              {busyKey === "profile-image" ? "Uploading..." : "Upload profile photo"}
              <input accept=".jpg,.jpeg,.png,.webp" onChange={handleProfileImageChange} type="file" />
            </label>
            <div className="profile-stats">
              <article>
                <strong>{readinessValue}%</strong>
                <span>readiness</span>
              </article>
              <article>
                <strong>{documents.length}</strong>
                <span>materials</span>
              </article>
              <article>
                <strong>{flashcards.length}</strong>
                <span>cards</span>
              </article>
            </div>
            <form className="profile-form form-grid" onSubmit={handleProfileUpdate}>
              <label>
                Display name
                <input onChange={(event) => setProfileName(event.target.value)} value={profileName} />
              </label>
              <label>
                Preferred difficulty
                <select onChange={(event) => setProfileDifficulty(event.target.value as "easy" | "medium" | "hard")} value={profileDifficulty}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <button className="secondary-button" disabled={busyKey === "profile"} type="submit">
                <AppIcon name="user" />
                {busyKey === "profile" ? "Saving..." : "Save settings"}
              </button>
            </form>
          </article>
        </aside>

        <main className="workspace-main">
          <header className="workspace-header">
            <div>
              <span className="section-kicker">Hi {firstName}</span>
              <h1>{activeMeta.title}</h1>
              <p className="workspace-intro">{activeMeta.description}</p>
            </div>
            <div className="header-actions">
              <button className="secondary-button" onClick={() => refreshWorkspace()} type="button">
                <AppIcon name="refresh" />
                Refresh
              </button>
              <button className="theme-toggle" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))} type="button">
                <AppIcon name="moon" />
                {theme === "light" ? "Dark" : "Light"}
              </button>
              <button className="secondary-button" disabled={busyKey === "logout"} onClick={handleLogout} type="button">
                <AppIcon name="logout" />
                {busyKey === "logout" ? "Leaving..." : "Logout"}
              </button>
            </div>
          </header>

          <section className="hero-shell">
            <article className="hero-main-card">
              <div className="panel-topline">
                <span className="eyebrow-pill">{activeMeta.eyebrow}</span>
                <span className="mini-pill">{workspaceMessage}</span>
              </div>
              <h2>{spotlightRecommendation?.topic ?? spotlightTopic?.topic_name ?? "Build your next study move"}</h2>
              <p className="section-copy">{focusAction}</p>
              <div className="hero-chip-row">
                <span className="hero-chip">
                  <AppIcon name="library" />
                  {documents.length} files
                </span>
                <span className="hero-chip">
                  <AppIcon name="progress" />
                  {readinessValue}% ready
                </span>
                <span className="hero-chip">
                  <AppIcon name="quiz" />
                  {quizAccuracy}% quiz accuracy
                </span>
              </div>
            </article>

            <article className="hero-side-card">
              <div className="panel-topline">
                <span className="eyebrow-pill">Now active</span>
                <span className="mini-pill">{views.find((view) => view.key === activeView)?.label}</span>
              </div>
              <div className="mini-focus-list">
                <div className="mini-focus-item">
                  <span className="focus-dot accent" />
                  <div>
                    <strong>{processedDocuments}</strong>
                    <p>documents processed</p>
                  </div>
                </div>
                <div className="mini-focus-item">
                  <span className="focus-dot success" />
                  <div>
                    <strong>{flashcards.length}</strong>
                    <p>flashcards available</p>
                  </div>
                </div>
                <div className="mini-focus-item">
                  <span className="focus-dot info" />
                  <div>
                    <strong>{recommendations.length}</strong>
                    <p>recommendations queued</p>
                  </div>
                </div>
              </div>
            </article>
          </section>

          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}

export default App;
