import { startTransition, useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
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
type WorkspaceSnapshot = {
  dashboard: DashboardResponse;
  documents: DocumentItem[];
  progress: ProgressResponse;
  recommendations: RecommendationItem[];
  flashcards: FlashcardItem[];
};

const views: Array<{ key: ViewKey; label: string; caption: string }> = [
  { key: "dashboard", label: "Dashboard", caption: "Overview" },
  { key: "upload", label: "Upload", caption: "Materials" },
  { key: "ask", label: "Ask AI", caption: "Grounded Help" },
  { key: "flashcards", label: "Flashcards", caption: "Review" },
  { key: "quiz", label: "Quiz", caption: "Practice" },
  { key: "exam", label: "Exam Mode", caption: "Readiness" },
  { key: "progress", label: "Progress", caption: "Tracking" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  const [workspaceMessage, setWorkspaceMessage] = useState("Checking backend and loading your workspace...");
  const [authMessage, setAuthMessage] = useState("Create an account or sign in to open your study workspace.");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [courseName, setCourseName] = useState("Biology 101");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("PDF, TXT, and DOCX uploads are supported.");

  const [question, setQuestion] = useState("What topics should I review first for exam readiness?");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [askMessage, setAskMessage] = useState("Ask questions using only your uploaded course materials.");

  const [flashcardTopic, setFlashcardTopic] = useState("");
  const [flashcardCount, setFlashcardCount] = useState(6);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [flashcardMessage, setFlashcardMessage] = useState("Generate a focused deck from your uploaded material.");
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);

  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [quizMessage, setQuizMessage] = useState("Generate a mixed quiz to test topic mastery.");

  const [examCount, setExamCount] = useState(10);
  const [examMinutes, setExamMinutes] = useState(20);
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examResult, setExamResult] = useState<ExamSubmitResponse | null>(null);
  const [examMessage, setExamMessage] = useState("Run a timed exam simulation across mixed topics.");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("prepmind-theme", theme);
  }, [theme]);

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

    setWorkspaceMessage(message ?? "Refreshing your study workspace...");
    try {
      const snapshot = await loadWorkspaceSnapshot();
      setStatus("online");
      applyWorkspaceSnapshot(snapshot);
      setWorkspaceMessage("Workspace synced. Your uploads, recommendations, and progress are up to date.");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Authentication required.") {
        setCurrentUser(null);
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
          setCurrentUser(null);
          clearWorkspace();
          setWorkspaceMessage("Backend online. Sign in to start building your study memory.");
          setSessionChecked(true);
          return;
        }

        setCurrentUser(session.user);
        const snapshot = await loadWorkspaceSnapshot();
        if (cancelled) {
          return;
        }

        applyWorkspaceSnapshot(snapshot);
        setWorkspaceMessage("Workspace ready. Your study history is active and persistent.");
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

      setCurrentUser(payload.user);
      setAuthPassword("");
      setAuthMessage(payload.message);
      const snapshot = await loadWorkspaceSnapshot();
      applyWorkspaceSnapshot(snapshot);
      setWorkspaceMessage("Workspace ready. Your study history is active and persistent.");
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
      setCurrentUser(null);
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
  const activeLabel = views.find((view) => view.key === activeView)?.label ?? "Dashboard";
  const spotlightRecommendation = recommendations[0] ?? null;
  const spotlightTopic = weakTopics[0] ?? null;

  if (!sessionChecked) {
    return (
      <div className="app-shell auth-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <article className="auth-card">
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
        <section className="auth-layout">
          <article className="intro-card">
            <div className="intro-badge-row">
              <p className="section-kicker">PrepMind AI</p>
              <span className="status-badge">{status === "online" ? "Backend online" : "Backend offline"}</span>
            </div>
            <h1>Clean study flow, private uploads, adaptive practice.</h1>
            <p className="muted-text">
              Upload course materials, ask grounded questions, generate flashcards, run quizzes, and simulate exams in one workspace.
            </p>
            <div className="feature-grid">
              <div className="feature-card">
                <strong>Private sessions</strong>
                <p className="muted-text">Signed session cookies keep each learner’s materials and progress separated.</p>
              </div>
              <div className="feature-card">
                <strong>Study loop</strong>
                <p className="muted-text">Move from upload to retrieval to review, quiz, and readiness tracking without leaving the app.</p>
              </div>
              <div className="feature-card">
                <strong>Theme toggle</strong>
                <p className="muted-text">Switch between light and dark themes based on your environment and preference.</p>
              </div>
            </div>
          </article>

          <article className="auth-card">
            <div className="auth-header">
              <div>
                <p className="section-kicker">Access</p>
                <h2>{authMode === "register" ? "Create account" : "Sign in"}</h2>
              </div>
              <button className="theme-toggle" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))} type="button">
                Theme: {theme === "light" ? "Light" : "Dark"}
              </button>
            </div>

            <div className="segmented-control">
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
                {busyKey === "auth" ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="inline-note">{authMessage}</p>
            <p className="status-inline">Backend: {status}</p>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <header className="topbar">
        <div className="topbar-copy">
          <div className="brand-row">
            <p className="section-kicker">PrepMind AI</p>
            <span className="status-badge">{status === "online" ? "Live workspace" : "Backend offline"}</span>
          </div>
          <h1 className="topbar-title">{activeLabel}</h1>
          <p className="muted-text">{workspaceMessage}</p>
        </div>

        <div className="topbar-actions">
          <button className="secondary-button" onClick={() => refreshWorkspace()} type="button">
            Refresh
          </button>
          <button className="theme-toggle" onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))} type="button">
            Theme: {theme === "light" ? "Light" : "Dark"}
          </button>
          <div className="user-pill">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
          </div>
          <button className="secondary-button" disabled={busyKey === "logout"} onClick={handleLogout} type="button">
            {busyKey === "logout" ? "Leaving..." : "Logout"}
          </button>
        </div>
      </header>

      <section className="hero-banner">
        <div className="hero-copy">
          <p className="section-kicker">Study workspace</p>
          <h2>From uploaded material to guided review, quizzes, and exam readiness.</h2>
          <p className="muted-text">
            The current MVP works end to end without external model keys, while keeping the architecture ready for stronger RAG later.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setActiveView("upload")} type="button">
              Add material
            </button>
            <button className="secondary-button" onClick={() => setActiveView("ask")} type="button">
              Ask AI
            </button>
          </div>
        </div>
        <div className="hero-side">
          <article className="spotlight-card">
            <p className="section-kicker">Focus next</p>
            <h3>{spotlightRecommendation?.topic ?? spotlightTopic?.topic_name ?? "Build your study flow"}</h3>
            <p className="muted-text">
              {spotlightRecommendation?.action ??
                (spotlightTopic
                  ? `Review ${spotlightTopic.topic_name} first. It is currently your weakest tracked topic.`
                  : "Upload material to unlock personalized recommendations and adaptive review.")}
            </p>
            <div className="spotlight-meta">
              <span className="pill">{heroStats.find((item) => item.label === "Readiness")?.value ?? "0%"}</span>
              <span className="pill subtle">
                {progress ? `${Math.round(progress.quiz_accuracy)}% quiz accuracy` : "No quiz history yet"}
              </span>
            </div>
          </article>
          <div className="stat-grid">
            {heroStats.map((stat) => (
              <article key={stat.label} className={`stat-card tone-${stat.tone}`}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Workspace sections">
        {views.map((view) => (
          <button
            key={view.key}
            className={view.key === activeView ? "tab-chip active" : "tab-chip"}
            onClick={() => setActiveView(view.key)}
            type="button"
          >
            <span>{view.caption}</span>
            <strong>{view.label}</strong>
          </button>
        ))}
      </nav>

      {activeView === "dashboard" ? (
        <section className="content-grid">
          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Recommended next</p>
                <h3>Keep your next study session focused.</h3>
              </div>
            </div>
            <div className="card-grid three-up">
              {recommendations.length > 0 ? (
                recommendations.map((item) => (
                  <article key={item.topic} className="info-card">
                    <strong>{item.topic}</strong>
                    <p className="muted-text">{item.reason}</p>
                    <small>{item.action}</small>
                  </article>
                ))
              ) : (
                <article className="empty-card">Upload material first to unlock topic recommendations.</article>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Weak topics</p>
                <h3>Start here</h3>
              </div>
            </div>
            <div className="stack">
              {weakTopics.length > 0 ? (
                weakTopics.map((topic) => (
                  <article key={topic.topic_name} className="progress-card">
                    <div className="progress-card-head">
                      <strong>{topic.topic_name}</strong>
                      <span>{Math.round(topic.mastery_score)}%</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${Math.max(8, topic.mastery_score)}%` }} />
                    </div>
                    <small>{topic.study_frequency} review cycles</small>
                  </article>
                ))
              ) : (
                <article className="empty-card">No weak topics yet. Upload a document to start tracking.</article>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Recent uploads</p>
                <h3>Indexed documents</h3>
              </div>
              <button className="secondary-button" onClick={() => setActiveView("upload")} type="button">
                Add file
              </button>
            </div>
            <div className="stack">
              {recentDocuments.length > 0 ? (
                recentDocuments.map((document) => (
                  <article key={document.id} className="info-card">
                    <strong>{document.name}</strong>
                    <p className="muted-text">{document.course_name}</p>
                    <small>
                      {document.chunk_count} chunks indexed on {formatDate(document.upload_date)}
                    </small>
                  </article>
                ))
              ) : (
                <article className="empty-card">No uploaded documents yet.</article>
              )}
            </div>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Quick actions</p>
                <h3>Jump into the next study task.</h3>
              </div>
            </div>
            <div className="card-grid four-up">
              <button className="action-card" onClick={() => setActiveView("ask")} type="button">
                <strong>Ask AI</strong>
                <p className="muted-text">Get a grounded answer with source citations.</p>
              </button>
              <button className="action-card" onClick={() => setActiveView("flashcards")} type="button">
                <strong>Flashcards</strong>
                <p className="muted-text">Generate review cards from topics that need reinforcement.</p>
              </button>
              <button className="action-card" onClick={() => setActiveView("quiz")} type="button">
                <strong>Quiz</strong>
                <p className="muted-text">Test recall with mixed question types and immediate scoring.</p>
              </button>
              <button className="action-card" onClick={() => setActiveView("exam")} type="button">
                <strong>Exam mode</strong>
                <p className="muted-text">Run a timed simulation and estimate readiness.</p>
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "upload" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Upload material</p>
                <h3>Index notes, slides, and study guides.</h3>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleUpload}>
              <label>
                Course label
                <input onChange={(event) => setCourseName(event.target.value)} value={courseName} />
              </label>
              <label>
                Study file
                <input accept=".pdf,.txt,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} type="file" />
              </label>
              <label className="checkbox-row">
                <input checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} type="checkbox" />
                <span>Replace a matching document in the same course</span>
              </label>
              <button className="primary-button" disabled={busyKey === "upload"} type="submit">
                {busyKey === "upload" ? "Processing..." : "Upload and index"}
              </button>
            </form>
            <p className="inline-note">{uploadMessage}</p>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Library</p>
                <h3>Manage uploaded documents.</h3>
              </div>
            </div>
            <div className="stack">
              {documents.length > 0 ? (
                documents.map((document) => (
                  <article key={document.id} className="document-card">
                    <div>
                      <strong>{document.document_name}</strong>
                      <p className="muted-text">
                        {document.course_name} | {document.document_type.toUpperCase()} | {document.processing_status}
                      </p>
                      <small>
                        {document.chunk_count} chunks | {document.extracted_word_count} words |{" "}
                        {Math.max(1, Math.round(document.file_size_bytes / 1024))} KB
                      </small>
                      <p className="muted-text">{document.topic_summary || "Topic summary appears after processing."}</p>
                      {document.error_message ? <small>{document.error_message}</small> : null}
                    </div>
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
                <article className="empty-card">No uploaded material yet.</article>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeView === "ask" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Question answering</p>
                <h3>Ask against uploaded materials only.</h3>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleAsk}>
              <label>
                Study question
                <textarea onChange={(event) => setQuestion(event.target.value)} rows={7} value={question} />
              </label>
              <button className="primary-button" disabled={busyKey === "ask"} type="submit">
                {busyKey === "ask" ? "Searching..." : "Ask PrepMind"}
              </button>
            </form>
            <p className="inline-note">{askMessage}</p>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Grounded response</p>
                <h3>Answer and citations</h3>
              </div>
            </div>
            {answer ? (
              <div className="stack">
                <article className="answer-card">
                  <p>{answer.answer}</p>
                </article>
                <div className="card-grid two-up">
                  {answer.citations.map((citation, index) => (
                    <article key={`${citation.document_name}-${index}`} className="info-card">
                      <span className="pill">{citation.topic_label}</span>
                      <strong>{citation.document_name}</strong>
                      <p className="muted-text">{citation.snippet}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <article className="empty-card">Ask a study question to see grounded output and source snippets.</article>
            )}
          </article>
        </section>
      ) : null}

      {activeView === "flashcards" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Generate flashcards</p>
                <h3>Create a focused review deck.</h3>
              </div>
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
                {busyKey === "flashcards" ? "Generating..." : "Generate deck"}
              </button>
            </form>
            <p className="inline-note">{flashcardMessage}</p>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Review deck</p>
                <h3>Study one card at a time.</h3>
              </div>
            </div>
            {currentFlashcard ? (
              <div className="stack">
                <article className="flashcard-stage">
                  <div className="flashcard-top">
                    <span className="pill">{currentFlashcard.topic_name}</span>
                    <span className="pill subtle">{currentFlashcard.difficulty}</span>
                  </div>
                  <h3>{currentFlashcard.question}</h3>
                  <p>{currentFlashcard.answer}</p>
                  <div className="control-row">
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

                <div className="card-grid three-up">
                  {flashcards.map((card, index) => (
                    <button
                      key={card.id}
                      className={index === activeFlashcardIndex ? "mini-card active" : "mini-card"}
                      onClick={() => setActiveFlashcardIndex(index)}
                      type="button"
                    >
                      <strong>{card.topic_name}</strong>
                      <p className="muted-text">{card.student_rating ? `Rated ${card.student_rating}` : "Unrated"}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <article className="empty-card">Generate or upload material to start a flashcard deck.</article>
            )}
          </article>
        </section>
      ) : null}

      {activeView === "quiz" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Quiz builder</p>
                <h3>Create a practice session.</h3>
              </div>
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
                {busyKey === "quiz-generate" ? "Generating..." : "Generate quiz"}
              </button>
            </form>
            <p className="inline-note">{quizMessage}</p>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Quiz session</p>
                <h3>Answer and submit for scoring.</h3>
              </div>
              {quizQuestions.length > 0 ? (
                <button className="primary-button" disabled={busyKey === "quiz-submit"} onClick={handleSubmitQuiz} type="button">
                  {busyKey === "quiz-submit" ? "Scoring..." : "Submit quiz"}
                </button>
              ) : null}
            </div>

            {quizQuestions.length > 0 ? (
              <div className="stack">
                {quizQuestions.map((item, index) => (
                  <article key={`${item.topic_name}-${index}`} className="question-card">
                    <div className="question-head">
                      <span className="pill">{item.topic_name}</span>
                      <span className="pill subtle">{item.question_type}</span>
                    </div>
                    <strong>{index + 1}. {item.prompt}</strong>
                    {item.options.length > 0 ? (
                      <div className="option-grid">
                        {item.options.map((option) => (
                          <label key={option.id} className="option-card">
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
            ) : (
              <article className="empty-card">Generate a quiz to begin practicing.</article>
            )}

            {quizResult ? (
              <div className="result-panel">
                <div className="result-summary">
                  <strong>{quizResult.score_percent}%</strong>
                  <p className="muted-text">
                    {quizResult.correct_count} of {quizResult.total_questions} correct
                  </p>
                </div>
                <div className="stack">
                  {quizResult.results.map((item, index) => (
                    <article key={`${item.topic_name}-${index}`} className={item.is_correct ? "result-card success" : "result-card warning"}>
                      <strong>{item.topic_name}</strong>
                      <p>{item.prompt}</p>
                      <small>
                        Your answer: {item.student_answer || "No answer"} | Expected: {item.correct_answer}
                      </small>
                      <small>{item.feedback}</small>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {activeView === "exam" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Exam setup</p>
                <h3>Prepare a timed simulation.</h3>
              </div>
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
                {busyKey === "exam-start" ? "Building..." : "Start exam"}
              </button>
            </form>
            <p className="inline-note">{examMessage}</p>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Exam session</p>
                <h3>{examMinutes} minute timed review</h3>
              </div>
              {examQuestions.length > 0 ? (
                <button className="primary-button" disabled={busyKey === "exam-submit"} onClick={handleSubmitExam} type="button">
                  {busyKey === "exam-submit" ? "Scoring..." : "Submit exam"}
                </button>
              ) : null}
            </div>

            {examQuestions.length > 0 ? (
              <div className="stack">
                {examQuestions.map((item, index) => (
                  <article key={`${item.topic_name}-${index}`} className="question-card">
                    <div className="question-head">
                      <span className="pill">{item.topic_name}</span>
                      <span className="pill subtle">{item.question_type}</span>
                    </div>
                    <strong>{index + 1}. {item.prompt}</strong>
                    {item.options.length > 0 ? (
                      <div className="option-grid">
                        {item.options.map((option) => (
                          <label key={option.id} className="option-card">
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
            ) : (
              <article className="empty-card">Start an exam to generate a mixed, timed question set.</article>
            )}

            {examResult ? (
              <div className="result-panel">
                <div className="result-summary">
                  <strong>{examResult.readiness_score}%</strong>
                  <p className="muted-text">Readiness estimate with exam score {examResult.score_percent}%</p>
                </div>
                <div className="card-grid two-up">
                  <article className="info-card">
                    <strong>Strong topics</strong>
                    <p className="muted-text">{examResult.strong_topics.join(", ") || "None yet"}</p>
                  </article>
                  <article className="info-card">
                    <strong>Weak topics</strong>
                    <p className="muted-text">{examResult.weak_topics.join(", ") || "None flagged"}</p>
                  </article>
                </div>
                <div className="stack">
                  {examResult.feedback.map((line) => (
                    <article key={line} className="info-card">
                      <p>{line}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {activeView === "progress" ? (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Readiness</p>
                <h3>Current study health</h3>
              </div>
            </div>
            <div className="stack">
              <article className="metric-card">
                <strong>{Math.round(progress?.readiness_score ?? 0)}%</strong>
                <span>Readiness score</span>
              </article>
              <article className="metric-card">
                <strong>{Math.round(progress?.quiz_accuracy ?? 0)}%</strong>
                <span>Quiz accuracy</span>
              </article>
              <article className="metric-card">
                <strong>{progress?.flashcard_coverage ?? 0}</strong>
                <span>Flashcards available</span>
              </article>
              <article className="metric-card">
                <strong>{progress?.study_streak_days ?? 0}</strong>
                <span>Active topics this week</span>
              </article>
            </div>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Mastery map</p>
                <h3>Track topic-by-topic progress.</h3>
              </div>
            </div>
            <div className="stack">
              {progress?.topic_mastery.length ? (
                progress.topic_mastery.map((topic) => (
                  <article key={topic.topic_name} className="progress-card">
                    <div className="progress-card-head">
                      <div>
                        <strong>{topic.topic_name}</strong>
                        <p className="muted-text">{topic.study_frequency} review cycles</p>
                      </div>
                      <span>{Math.round(topic.mastery_score)}%</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${Math.max(8, topic.mastery_score)}%` }} />
                    </div>
                    <small>Last reviewed {formatDate(topic.last_reviewed)}</small>
                  </article>
                ))
              ) : (
                <article className="empty-card">Progress appears after you upload materials and complete study actions.</article>
              )}
            </div>
          </article>

          <article className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Recent activity</p>
                <h3>Signals feeding recommendations.</h3>
              </div>
            </div>
            <div className="stack">
              {progress?.recent_activity.length ? (
                progress.recent_activity.map((item) => (
                  <article key={item} className="info-card">
                    <p>{item}</p>
                  </article>
                ))
              ) : (
                <article className="empty-card">No recent study activity yet.</article>
              )}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}

export default App;
