import { startTransition, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import "./App.css";
import logoMark from "./assets/prepmind-mark.svg";
import {
  askQuestion,
  deleteDocument,
  fetchDocuments,
  fetchFlashcards,
  fetchSession,
  fetchStatus,
  generateFlashcards,
  generateQuiz,
  loginUser,
  logoutUser,
  rateFlashcard,
  registerUser,
  submitQuiz,
  uploadDocument,
} from "./api";
import type { AskResponse, DocumentItem, FlashcardItem, QuizQuestion, QuizSubmitResponse, User } from "./types";

type ViewKey = "upload" | "flashcards" | "quiz";
type AuthMode = "login" | "register";
type ThemeMode = "light" | "dark";
type Difficulty = "easy" | "medium" | "hard";
type WorkspaceSnapshot = {
  documents: DocumentItem[];
  flashcards: FlashcardItem[];
};
type ChatExchange = {
  question: string;
  answer: string;
  citations: AskResponse["citations"];
};
type IconName =
  | "dashboard"
  | "upload"
  | "chat"
  | "cards"
  | "quiz"
  | "moon"
  | "logout"
  | "refresh"
  | "file"
  | "spark"
  | "plus"
  | "chevron"
  | "mic"
  | "send"
  | "user"
  | "settings"
  | "trend";

const views: Array<{ key: ViewKey; label: string; icon: IconName }> = [
  { key: "upload", label: "Library", icon: "upload" },
  { key: "flashcards", label: "Study", icon: "cards" },
  { key: "quiz", label: "Quiz", icon: "quiz" },
];

const chatSuggestions = [
  "Summarize my uploaded notes.",
  "Explain this topic in simple words.",
  "Ask me a practice question.",
];

function AppIcon({ name, style }: { name: IconName; style?: React.CSSProperties }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg aria-hidden="true" style={style} viewBox="0 0 24 24">
      {name === "dashboard" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" {...stroke} />
          <rect x="14" y="3" width="7" height="7" rx="1" {...stroke} />
          <rect x="14" y="14" width="7" height="7" rx="1" {...stroke} />
          <rect x="3" y="14" width="7" height="7" rx="1" {...stroke} />
        </>
      ) : null}
      {name === "upload" ? (
        <>
          <path d="M12 15V4.5" {...stroke} />
          <path d="M8 8.5L12 4.5L16 8.5" {...stroke} />
          <path d="M4 16.5V18.5C4 19.6 4.9 20.5 6 20.5H18C19.1 20.5 20 19.6 20 18.5V16.5" {...stroke} />
        </>
      ) : null}
      {name === "chat" ? (
        <>
          <path d="M12 3.5C7.3 3.5 3.5 6.9 3.5 11.1C3.5 13.2 4.5 15 6.1 16.2L5.2 20.5L9.3 18.3C10.2 18.5 11.1 18.6 12 18.6C16.7 18.6 20.5 15.2 20.5 11.1C20.5 7 16.7 3.5 12 3.5Z" {...stroke} />
          <path d="M8.5 10.5H15.5" {...stroke} />
          <path d="M8.5 13.5H13.5" {...stroke} />
        </>
      ) : null}
      {name === "cards" ? (
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
      {name === "moon" ? (
        <path d="M16.5 4.2C15.8 4 15.1 3.9 14.3 3.9C9.8 3.9 6.1 7.6 6.1 12.1C6.1 16.6 9.8 20.3 14.3 20.3C17.9 20.3 21 18 22 14.8C21.2 15 20.5 15.1 19.7 15.1C15.2 15.1 11.5 11.4 11.5 6.9C11.5 5.9 11.7 5 12 4.2" {...stroke} />
      ) : null}
      {name === "logout" ? (
        <>
          <path d="M10 4.5H6C4.9 4.5 4 5.4 4 6.5V17.5C4 18.6 4.9 19.5 6 19.5H10" {...stroke} />
          <path d="M14.5 8.5L19 12L14.5 15.5" {...stroke} />
          <path d="M9 12H19" {...stroke} />
        </>
      ) : null}
      {name === "refresh" ? (
        <>
          <path d="M19.5 8.5C18 5.8 15.2 4 12 4C7.3 4 3.5 7.8 3.5 12.5C3.5 17.2 7.3 21 12 21C15.8 21 19 18.5 20.1 15" {...stroke} />
          <path d="M19.5 4.5V8.8H15.2" {...stroke} />
        </>
      ) : null}
      {name === "file" ? (
        <>
          <path d="M8 3.5H14.5L19 8V18.5C19 19.6 18.1 20.5 17 20.5H8C6.9 20.5 6 19.6 6 18.5V5.5C6 4.4 6.9 3.5 8 3.5Z" {...stroke} />
          <path d="M14 3.5V8.5H19" {...stroke} />
        </>
      ) : null}
      {name === "spark" ? (
        <>
          <path d="M12 3.5L13.8 8.2L18.5 10L13.8 11.8L12 16.5L10.2 11.8L5.5 10L10.2 8.2L12 3.5Z" {...stroke} />
          <path d="M18 16L18.8 18.2L21 19L18.8 19.8L18 22L17.2 19.8L15 19L17.2 18.2L18 16Z" {...stroke} />
        </>
      ) : null}
      {name === "plus" ? (
        <>
          <path d="M12 5V19" {...stroke} />
          <path d="M5 12H19" {...stroke} />
        </>
      ) : null}
      {name === "chevron" ? <path d="M7.5 10L12 14.5L16.5 10" {...stroke} /> : null}
      {name === "mic" ? (
        <>
          <path d="M12 15.5C10.3 15.5 9 14.2 9 12.5V8.5C9 6.8 10.3 5.5 12 5.5C13.7 5.5 15 6.8 15 8.5V12.5C15 14.2 13.7 15.5 12 15.5Z" {...stroke} />
          <path d="M6.5 11.5V12C6.5 15 8.9 17.5 12 17.5C15.1 17.5 17.5 15 17.5 12V11.5" {...stroke} />
          <path d="M12 17.5V20" {...stroke} />
        </>
      ) : null}
      {name === "send" ? (
        <>
          <path d="M20 4L10.5 13.5" {...stroke} />
          <path d="M20 4L14 20L10.5 13.5L4 10L20 4Z" {...stroke} />
        </>
      ) : null}
      {name === "user" ? (
        <>
          <path d="M19 21V19C19 17.9 18.1 17 17 17H7C5.9 17 5 17.9 5 19V21" {...stroke} />
          <circle cx="12" cy="7" r="4" {...stroke} />
        </>
      ) : null}
      {name === "trend" ? (
        <>
          <path d="M22 12H18L15 21L9 3L6 12H2" {...stroke} />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <circle cx="12" cy="12" r="3" {...stroke} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" {...stroke} />
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

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
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

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem("prepmind-theme") === "dark" ? "dark" : "light";
  });
  const [sessionChecked, setSessionChecked] = useState(false);
  const [status, setStatus] = useState<"online" | "offline">("offline");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("upload");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("Sign in to use uploads, chat, flashcards, and quiz.");
  const [workspaceMessage, setWorkspaceMessage] = useState("Loading workspace...");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [courseName, setCourseName] = useState("Biology 101");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("Upload notes, PDF, TXT, or DOCX files.");

  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatExchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);

  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [flashcardTopic, setFlashcardTopic] = useState("");
  const [flashcardCount, setFlashcardCount] = useState(6);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState<Difficulty>("medium");
  const [flashcardMessage, setFlashcardMessage] = useState("Generate a flashcard deck from your material.");
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);

  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState<Difficulty>("medium");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [quizMessage, setQuizMessage] = useState("Generate a simple quiz from your notes.");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("prepmind-theme", theme);
  }, [theme]);

  function syncUserState(user: User | null) {
    setCurrentUser(user);
    if (!user) {
      setFlashcardDifficulty("medium");
      setQuizDifficulty("medium");
      return;
    }
    const difficulty = user.preferred_difficulty as Difficulty;
    setFlashcardDifficulty(difficulty);
    setQuizDifficulty(difficulty);
  }

  async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    const [documentPayload, flashcardPayload] = await Promise.all([fetchDocuments(), fetchFlashcards()]);
    return {
      documents: documentPayload.items,
      flashcards: flashcardPayload.items,
    };
  }

  function clearWorkspace() {
    startTransition(() => {
      setDocuments([]);
      setFlashcards([]);
      setChatHistory([]);
      setPendingQuestion(null);
      setQuizQuestions([]);
      setQuizAnswers({});
      setQuizResult(null);
    });
  }

  function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
    startTransition(() => {
      setDocuments(snapshot.documents);
      setFlashcards(snapshot.flashcards);
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
          setSessionChecked(true);
          return;
        }

        syncUserState(session.user);
        const snapshot = await loadWorkspaceSnapshot();
        if (cancelled) return;
        applyWorkspaceSnapshot(snapshot);
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
      setActiveView("upload");
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
      setUploadMessage("Choose a file first.");
      return;
    }
    setBusyKey("upload");
    setUploadMessage("Uploading and indexing...");
    try {
      const payload = await uploadDocument(selectedFile, courseName, replaceExisting);
      setSelectedFile(null);
      setReplaceExisting(false);
      setUploadMessage(payload.message);
      await refreshWorkspace("Refreshing after upload...");
    } catch (error) {
      console.error(error);
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteDocument(documentId: number) {
    setBusyKey(`delete-${documentId}`);
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
    const submittedQuestion = question.trim();
    if (!submittedQuestion) return;
    setChatExpanded(true);
    setPendingQuestion(submittedQuestion);
    setBusyKey("ask");
    try {
      const payload = await askQuestion(submittedQuestion);
      setChatHistory((current) => [
        ...current,
        {
          question: submittedQuestion,
          answer: payload.answer,
          citations: payload.citations,
        },
      ]);
      setQuestion("");
      setPendingQuestion(null);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Chat failed.";
      setChatHistory((current) => [
        ...current,
        {
          question: submittedQuestion,
          answer: message,
          citations: [],
        },
      ]);
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
      setFlashcardMessage(payload.message);
    } catch (error) {
      console.error(error);
      setFlashcardMessage(error instanceof Error ? error.message : "Flashcard generation failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRateFlashcard(flashcardId: number, rating: Difficulty) {
    setBusyKey(`rate-${flashcardId}`);
    try {
      const updated = await rateFlashcard(flashcardId, rating);
      setFlashcards((current) => current.map((card) => (card.id === flashcardId ? updated : card)));
      setFlashcardMessage(`Marked as ${rating}.`);
      await refreshWorkspace("Updating mastery...");
    } catch (error) {
      console.error(error);
      setFlashcardMessage(error instanceof Error ? error.message : "Rating failed.");
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

  const currentFlashcard = flashcards[activeFlashcardIndex] ?? null;

  function renderUpload() {
    return (
      <section className="view-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>Upload Materials</h2>
              <p>Add your PDF, DOCX, or TXT notes to index them for AI.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleUpload}>
            <label>
              Course Category
              <input onChange={(event) => setCourseName(event.target.value)} placeholder="e.g. Biology, History..." value={courseName} />
            </label>
            <label className="file-upload-zone">
              <div className="icon-badge upload-zone-icon">
                <AppIcon name="upload" />
              </div>
              <span className="file-label">Select Study File</span>
              <input accept=".pdf,.txt,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} type="file" />
              <span className="file-name">{selectedFile ? selectedFile.name : "No file selected"}</span>
            </label>
            <label className="checkbox-row">
              <input checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} type="checkbox" />
              <span>Update existing file in this course</span>
            </label>
            <button className="primary-button" disabled={busyKey === "upload"} type="submit">
              <AppIcon name="upload" />
              {busyKey === "upload" ? "Processing..." : "Start Upload"}
            </button>
          </form>
          <p className="helper-text">{uploadMessage}</p>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Managed Files</h2>
              <p>Your processed and indexed material.</p>
            </div>
          </div>
          <div className="stack-list">
            {documents.length ? (
              documents.map((document) => (
                <article className="file-card premium-file-card" key={document.id}>
                  <div className="file-meta">
                    <div className="icon-badge">
                      <AppIcon name="file" />
                    </div>
                    <div className="file-info">
                      <strong>{document.document_name}</strong>
                      <div className="file-tags">
                        <span className="tag">{document.course_name}</span>
                        <span className="tag type">{document.document_type.toUpperCase()}</span>
                      </div>
                      <small className="file-date">
                        Added {formatDate(document.upload_date)} | {document.processing_status}
                      </small>
                    </div>
                  </div>
                  <button
                    className="ghost-button danger mini"
                    disabled={busyKey === `delete-${document.id}`}
                    onClick={() => handleDeleteDocument(document.id)}
                    type="button"
                  >
                    <AppIcon name="logout" style={{ width: '14px', height: '14px' }} />
                  </button>
                </article>
              ))
            ) : (
              <article className="empty-card empty-card-short">
                <div className="icon-badge large">
                  <AppIcon name="file" />
                </div>
                <strong>Library is empty.</strong>
                <p>Upload your first document to get started.</p>
              </article>
            )}
          </div>
        </article>
      </section>
    );
  }


  function renderChatDock() {
    return (
      <div className={chatExpanded ? "chat-dock expanded" : "chat-dock"}>
        <div className="chat-dock-backdrop" onClick={() => setChatExpanded(false)} />
        
        <section className="chat-dock-shell">
          <div className="chat-dock-body">
            <div className="chat-scroll">
              {chatExpanded && (
                <div className="chat-stage-top">
                  <div>
                    <p className="eyebrow chat-eyebrow">Prepmind.ai</p>
                    <h2>Ask anything</h2>
                  </div>
                  <div className="chat-stage-actions">
                    {chatHistory.length ? (
                      <button className="ghost-button mini-close" onClick={() => setChatHistory([])} type="button">
                        Clear
                      </button>
                    ) : null}
                    <button className="ghost-button mini-close" onClick={() => setChatExpanded(false)} type="button">
                      <AppIcon name="chevron" style={{ transform: "rotate(180deg)" }} />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="chat-history">
                {chatHistory.length || pendingQuestion ? (
                  <div className="answer-stack">
                    {chatHistory.map((entry, index) => (
                      <div className="answer-stack" key={`${entry.question}-${index}`}>
                        <article className="message-card user-message">
                          <p>{entry.question}</p>
                        </article>
                        <article className="message-card assistant-message">
                          <div className="assistant-header">
                            <AppIcon name="spark" style={{ width: "16px", height: "16px" }} />
                            <span>Prepmind.ai</span>
                          </div>
                          <div className="assistant-content">{renderAnswerContent(entry.answer)}</div>
                        </article>
                        {entry.citations.length ? (
                          <div className="citation-grid">
                            {entry.citations.map((citation, citationIndex) => (
                              <article className="citation-card" key={`${citation.document_name}-${citationIndex}`}>
                                <div className="cit-header">
                                  <AppIcon name="file" style={{ width: "12px", height: "12px" }} />
                                  <strong>{citation.document_name}</strong>
                                </div>
                                <p>{citation.snippet}</p>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {pendingQuestion ? (
                      <>
                        <article className="message-card user-message">
                          <p>{pendingQuestion}</p>
                        </article>
                        <article className="message-card assistant-message loading-message">
                          <div className="assistant-header">
                            <AppIcon name="spark" style={{ width: "16px", height: "16px" }} />
                            <span>Prepmind.ai</span>
                          </div>
                          <div className="assistant-content">
                            <p>Thinking...</p>
                          </div>
                        </article>
                      </>
                    ) : null}
                  </div>
                ) : chatExpanded ? (
                  <div className="chat-empty">
                    <div className="ai-pulse">
                      <AppIcon name="spark" />
                    </div>
                    <h3>How can I help?</h3>
                    <p>Ask about your notes, get explanations, or ask a general question.</p>
                    <div className="chat-suggestion-row">
                      {chatSuggestions.map((suggestion) => (
                        <button
                          className="chat-suggestion-chip"
                          key={suggestion}
                          onClick={() => {
                            setQuestion(suggestion);
                            setChatExpanded(true);
                          }}
                          type="button"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <form className="chat-composer-wrap" onSubmit={handleAsk}>
              <div className="composer-inner">
                <textarea
                  onChange={(event) => setQuestion(event.target.value)}
                  onFocus={() => setChatExpanded(true)}
                  placeholder="Message Prepmind.ai..."
                  rows={1}
                  value={question}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <div className="composer-actions">
                  <div className="composer-meta">
                    <AppIcon name="spark" style={{ width: "14px", height: "14px" }} />
                    <span>{documents.length ? `${documents.length} notes ready` : "General mode"}</span>
                  </div>
                  <button className="send-circle" disabled={busyKey === "ask" || !question.trim()} type="submit">
                    <AppIcon name="send" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    );
  }



  function renderFlashcards() {
    return (
      <section className="view-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Flashcards</p>
              <h2>Study Smart.</h2>
              <p>Generate targeted flashcards from your material.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleGenerateFlashcards}>
            <label>
              Specific Topic
              <input onChange={(event) => setFlashcardTopic(event.target.value)} placeholder="e.g. Mitochondria, Civil War..." value={flashcardTopic} />
            </label>
            <div className="form-row split-fields">
              <label>
                Quantity
                <input max={20} min={1} onChange={(event) => setFlashcardCount(Number(event.target.value))} type="number" value={flashcardCount} />
              </label>
              <label>
                Level
                <select onChange={(event) => setFlashcardDifficulty(event.target.value as Difficulty)} value={flashcardDifficulty}>
                  <option value="easy">Beginner</option>
                  <option value="medium">Intermediate</option>
                  <option value="hard">Advanced</option>
                </select>
              </label>
            </div>
            <button className="primary-button" disabled={busyKey === "flashcards"} type="submit">
              <AppIcon name="spark" />
              {busyKey === "flashcards" ? "Creating Deck..." : "Generate Deck"}
            </button>
          </form>
          <p className="helper-text">{flashcardMessage}</p>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Active Session</p>
              <h2>Flashcard Deck</h2>
            </div>
          </div>
          {currentFlashcard ? (
            <div className="answer-stack">
              <article className="flashcard-card premium-card">
                <div className="card-header">
                  <span className="pill">{currentFlashcard.topic_name}</span>
                  <span className="card-counter">{activeFlashcardIndex + 1} / {flashcards.length}</span>
                </div>
                <div className="card-content">
                  <h3>{currentFlashcard.question}</h3>
                  <div className="card-divider" />
                  <p>{currentFlashcard.answer}</p>
                </div>
                <div className="card-actions">
                  <div className="nav-buttons">
                    <button
                      className="ghost-button"
                      disabled={activeFlashcardIndex === 0}
                      onClick={() => setActiveFlashcardIndex((value) => Math.max(0, value - 1))}
                      type="button"
                    >
                      <AppIcon name="chevron" style={{ transform: 'rotate(90deg)' }} />
                      Back
                    </button>
                    <button
                      className="ghost-button"
                      disabled={activeFlashcardIndex >= flashcards.length - 1}
                      onClick={() => setActiveFlashcardIndex((value) => Math.min(flashcards.length - 1, value + 1))}
                      type="button"
                    >
                      Next
                      <AppIcon name="chevron" style={{ transform: 'rotate(-90deg)' }} />
                    </button>
                  </div>
                  <div className="rating-buttons">
                    <p className="small-label">Rate this card:</p>
                    <div className="button-group">
                      <button className="chip-button" onClick={() => handleRateFlashcard(currentFlashcard.id, "easy")} type="button">Easy</button>
                      <button className="chip-button" onClick={() => handleRateFlashcard(currentFlashcard.id, "medium")} type="button">Mid</button>
                      <button className="chip-button" onClick={() => handleRateFlashcard(currentFlashcard.id, "hard")} type="button">Hard</button>
                    </div>
                  </div>
                </div>
              </article>
              <div className="mini-deck-scroll">
                {flashcards.map((card, index) => (
                  <button
                    className={index === activeFlashcardIndex ? "mini-card active" : "mini-card"}
                    key={card.id}
                    onClick={() => setActiveFlashcardIndex(index)}
                    type="button"
                  >
                    <span className="dot" />
                    <strong>{card.topic_name}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <article className="empty-card empty-card-tall">
              <div className="icon-badge large">
                <AppIcon name="cards" />
              </div>
              <strong>No active deck.</strong>
              <p>Generate flashcards to start your study session.</p>
            </article>
          )}
        </article>
      </section>
    );
  }


  function renderQuiz() {
    return (
      <section className="view-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Assessment</p>
              <h2>Quiz Generator</h2>
              <p>Test your knowledge with custom quizzes.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleGenerateQuiz}>
            <label>
              Focus Topic
              <input onChange={(event) => setQuizTopic(event.target.value)} placeholder="Leave blank for comprehensive" value={quizTopic} />
            </label>
            <div className="form-row split-fields">
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
              <AppIcon name="quiz" />
              {busyKey === "quiz-generate" ? "Preparing Quiz..." : "Start Quiz"}
            </button>
          </form>
          <p className="helper-text">{quizMessage}</p>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Questions</p>
              <h2>{quizQuestions.length ? "Knowledge Check" : "Ready to Start?"}</h2>
            </div>
            {quizQuestions.length ? (
              <button className="primary-button" disabled={busyKey === "quiz-submit"} onClick={handleSubmitQuiz} type="button">
                {busyKey === "quiz-submit" ? "Scoring..." : "Submit Answers"}
              </button>
            ) : null}
          </div>
          {quizQuestions.length ? (
            <div className="stack-list">
              {quizQuestions.map((item, index) => (
                <article className="question-card premium-question" key={`${item.topic_name}-${index}`}>
                  <div className="question-header">
                    <span className="pill">{item.topic_name}</span>
                    <span className="badge">{item.question_type}</span>
                  </div>
                  <h3 className="question-text">{index + 1}. {item.prompt}</h3>
                  {item.options.length ? (
                    <div className="options-grid">
                      {item.options.map((option) => (
                        <label className={quizAnswers[index] === option.id ? "option-card selected" : "option-card"} key={option.id}>
                          <input
                            checked={quizAnswers[index] === option.id}
                            name={`quiz-${index}`}
                            onChange={() => setQuizAnswers((current) => ({ ...current, [index]: option.id }))}
                            type="radio"
                          />
                          <span className="option-label">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="quiz-textarea"
                      onChange={(event) => setQuizAnswers((current) => ({ ...current, [index]: event.target.value }))}
                      placeholder="Type your answer here..."
                      rows={3}
                      value={quizAnswers[index] ?? ""}
                    />
                  )}
                </article>
              ))}
              {quizResult ? (
                <article className="result-card premium-result">
                  <div className="result-score">
                    <strong>{quizResult.score_percent}%</strong>
                    <span>Your Score</span>
                  </div>
                  <p>
                    You got {quizResult.correct_count} out of {quizResult.total_questions} questions correct.
                  </p>
                </article>
              ) : null}
            </div>
          ) : (
            <article className="empty-card empty-card-tall">
              <div className="icon-badge large">
                <AppIcon name="quiz" />
              </div>
              <strong>No active quiz.</strong>
              <p>Configure and start a quiz to test your mastery.</p>
            </article>
          )}
        </article>
      </section>
    );
  }

  if (!sessionChecked) {
    return (
      <div className="app-shell auth-shell">
        <article className="auth-card">
          <img alt="Prepmind.ai logo" className="logo-mark" src={logoMark} />
          <h1>Loading...</h1>
          <p>{workspaceMessage}</p>
        </article>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-shell auth-shell">
        <div className="auth-layout">
          <article className="auth-card intro-card">
            <img alt="Prepmind.ai logo" className="logo-mark" src={logoMark} />
            <p className="eyebrow">Prepmind.ai</p>
            <h1>Simple study workspace.</h1>
            <p>Upload notes, chat, generate flashcards, and create quizzes.</p>
            <ul className="simple-list">
              <li>Upload notes, PDF, TXT, and DOCX files</li>
              <li>Ask about your notes or ask general questions</li>
              <li>Create flashcards and quizzes</li>
            </ul>
          </article>

          <article className="auth-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Access</p>
                <h2>{authMode === "register" ? "Create account" : "Sign in"}</h2>
              </div>
              <button className="ghost-button" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))} type="button">
                <AppIcon name="moon" />
                {theme === "light" ? "Dark" : "Light"}
              </button>
            </div>
            <div className="tab-row auth-tabs">
              <button className={authMode === "login" ? "tab-button active" : "tab-button"} onClick={() => setAuthMode("login")} type="button">
                Login
              </button>
              <button className={authMode === "register" ? "tab-button active" : "tab-button"} onClick={() => setAuthMode("register")} type="button">
                Register
              </button>
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
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <img alt="Prepmind.ai logo" className="logo-mark" src={logoMark} />
          <div>
            <h1>Prepmind.ai</h1>
            <p className="status-text">{status === "online" ? "Connected" : "Offline"}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={() => refreshWorkspace()} type="button">
            <AppIcon name="refresh" />
            Sync
          </button>
          <button className="ghost-button" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))} type="button">
            <AppIcon name="moon" />
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button className="ghost-button" disabled={busyKey === "logout"} onClick={handleLogout} type="button">
            <AppIcon name="logout" />
            Sign out
          </button>
        </div>
      </header>

      <nav className="main-tabs" aria-label="Main navigation">
        {views.map((view) => (
          <button className={activeView === view.key ? "tab-button active" : "tab-button"} key={view.key} onClick={() => setActiveView(view.key)} type="button">
            <AppIcon name={view.icon} />
            {view.label}
          </button>
        ))}
      </nav>

      <main className="view-container">
        {activeView === "upload" ? renderUpload() : null}
        {activeView === "flashcards" ? renderFlashcards() : null}
        {activeView === "quiz" ? renderQuiz() : null}
      </main>

      {renderChatDock()}
    </div>
  );
}

export default App;

