import { startTransition, useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import {
  askQuestion,
  fetchDashboard,
  fetchDocuments,
  fetchProgress,
  fetchRecommendations,
  fetchSession,
  fetchStatus,
  loginUser,
  logoutUser,
  registerUser,
  uploadDocument,
} from "./api";
import type {
  AskResponse,
  DashboardResponse,
  DocumentItem,
  ProgressResponse,
  RecommendationItem,
  User,
} from "./types";

type ViewKey = "dashboard" | "upload" | "ask" | "flashcards" | "quiz" | "exam" | "progress";
type AuthMode = "login" | "register";
type WorkspaceSnapshot = {
  dashboard: DashboardResponse;
  documents: DocumentItem[];
  progress: ProgressResponse;
  recommendations: RecommendationItem[];
};

const views: Array<{ key: ViewKey; label: string; eyebrow: string }> = [
  { key: "dashboard", label: "Dashboard", eyebrow: "Overview" },
  { key: "upload", label: "Upload", eyebrow: "Ingestion" },
  { key: "ask", label: "Ask AI", eyebrow: "Grounded Study" },
  { key: "flashcards", label: "Flashcards", eyebrow: "Adaptive Review" },
  { key: "quiz", label: "Quiz", eyebrow: "Practice" },
  { key: "exam", label: "Exam Mode", eyebrow: "Readiness" },
  { key: "progress", label: "Progress", eyebrow: "Mastery" },
];

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [status, setStatus] = useState<"online" | "offline">("offline");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [question, setQuestion] = useState("What topics should I review first for exam readiness?");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [courseName, setCourseName] = useState("Biology 101");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [askMessage, setAskMessage] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("Checking backend and session state...");
  const [authMessage, setAuthMessage] = useState("Create an account or sign in to access your private study workspace.");
  const [isBusy, setIsBusy] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
    const [dashboardPayload, documentPayload, progressPayload, recommendationPayload] =
      await Promise.all([
        fetchDashboard(),
        fetchDocuments(),
        fetchProgress(),
        fetchRecommendations(),
      ]);

    return {
      dashboard: dashboardPayload,
      documents: documentPayload.items,
      progress: progressPayload,
      recommendations: recommendationPayload,
    };
  }

  function clearWorkspace() {
    startTransition(() => {
      setDashboard(null);
      setDocuments([]);
      setProgress(null);
      setRecommendations([]);
      setAnswer(null);
    });
  }

  function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
    startTransition(() => {
      setDashboard(snapshot.dashboard);
      setDocuments(snapshot.documents);
      setProgress(snapshot.progress);
      setRecommendations(snapshot.recommendations);
    });
  }

  async function refreshWorkspace() {
    if (!currentUser) {
      clearWorkspace();
      return;
    }

    setWorkspaceMessage("Syncing dashboard, progress, and study recommendations...");

    try {
      const snapshot = await loadWorkspaceSnapshot();
      setStatus("online");
      applyWorkspaceSnapshot(snapshot);
      setWorkspaceMessage("Workspace ready. Your session is active and progress will persist across refreshes.");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "Authentication required.") {
        setCurrentUser(null);
        clearWorkspace();
        setAuthMessage("Your session expired. Sign in again to continue.");
        setWorkspaceMessage("Session expired.");
      } else {
        setStatus("offline");
        setWorkspaceMessage("Backend offline. Start FastAPI to unlock uploads, study retrieval, and progress data.");
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
          setWorkspaceMessage("Backend online. Sign in to start your private study workspace.");
          setAuthMessage("Create an account or sign in to access your private study workspace.");
          setSessionChecked(true);
          return;
        }

        setCurrentUser(session.user);
        const snapshot = await loadWorkspaceSnapshot();
        if (cancelled) {
          return;
        }

        applyWorkspaceSnapshot(snapshot);
        setWorkspaceMessage("Workspace ready. Your session is active and progress will persist across refreshes.");
        setSessionChecked(true);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(error);
        setStatus("offline");
        setWorkspaceMessage("Backend offline. Start FastAPI to unlock uploads, study retrieval, and progress data.");
        setAuthMessage("The API is offline right now. Start the backend, then sign in.");
        setSessionChecked(true);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadMessage("Choose a PDF, TXT, or DOCX file first.");
      return;
    }

    setIsBusy(true);
    setUploadMessage("Processing document, extracting text, and mapping starter topics...");

    try {
      const payload = await uploadDocument(selectedFile, courseName);
      setUploadMessage(`${payload.message} Topics detected: ${payload.topics_detected.join(", ")}.`);
      setSelectedFile(null);
      await refreshWorkspace();
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      setUploadMessage(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setAskMessage("Searching uploaded material for grounded study support...");

    try {
      const payload = await askQuestion(question);
      setAnswer(payload);
      setAskMessage(`Response generated with ${Math.round(payload.confidence * 100)}% confidence.`);
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      setAskMessage(error instanceof Error ? error.message : "I couldn't reach the backend.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setAuthMessage(authMode === "register" ? "Creating your account and starting a session..." : "Signing you in...");

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
      setWorkspaceMessage("Workspace ready. Your session is active and progress will persist across refreshes.");
    } catch (error) {
      console.error(error);
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsBusy(false);
      setSessionChecked(true);
    }
  }

  async function handleLogout() {
    setIsBusy(true);
    try {
      await logoutUser();
      setCurrentUser(null);
      clearWorkspace();
      setActiveView("dashboard");
      setAuthMode("login");
      setAuthPassword("");
      setWorkspaceMessage("Signed out. Sign in again to continue.");
      setAuthMessage("Logged out successfully.");
    } catch (error) {
      console.error(error);
      setAuthMessage(error instanceof Error ? error.message : "Logout failed.");
    } finally {
      setIsBusy(false);
    }
  }

  const heroStats = dashboard?.stats ?? [];
  const weakTopics = dashboard?.weak_topics ?? [];
  const recentDocuments = dashboard?.recent_documents ?? [];
  const activeLabel = views.find((view) => view.key === activeView)?.label ?? "Dashboard";

  if (!sessionChecked) {
    return (
      <div className="app-shell">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <section className="auth-shell">
          <article className="auth-card">
            <p className="eyebrow">PrepMind AI</p>
            <h1>Loading your study workspace...</h1>
            <p className="auth-copy">{workspaceMessage}</p>
          </article>
        </section>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-shell">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />

        <section className="auth-shell">
          <article className="auth-card auth-card-large">
            <div className="auth-intro">
              <p className="eyebrow">PrepMind AI</p>
              <h1>Secure study sessions with saved progress and private uploads.</h1>
              <p className="auth-copy">
                Registration, login, logout, secure password hashing, and persistent sessions are now wired into the app.
              </p>
              <div className={`status-pill status-${status}`}>{status === "online" ? "Backend Online" : "Backend Offline"}</div>
            </div>

            <div className="auth-panel">
              <div className="auth-tabs">
                <button
                  className={authMode === "login" ? "nav-chip active" : "nav-chip"}
                  onClick={() => setAuthMode("login")}
                  type="button"
                >
                  <span>Access</span>
                  <strong>Login</strong>
                </button>
                <button
                  className={authMode === "register" ? "nav-chip active" : "nav-chip"}
                  onClick={() => setAuthMode("register")}
                  type="button"
                >
                  <span>Setup</span>
                  <strong>Register</strong>
                </button>
              </div>

              <form className="form-shell" onSubmit={handleAuthSubmit}>
                {authMode === "register" && (
                  <label>
                    Full name
                    <input
                      onChange={(event) => setAuthName(event.target.value)}
                      placeholder="Ava Johnson"
                      value={authName}
                    />
                  </label>
                )}

                <label>
                  Email
                  <input
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="ava@example.com"
                    type="email"
                    value={authEmail}
                  />
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

                <button className="primary-btn" disabled={isBusy || status === "offline"} type="submit">
                  {isBusy ? "Please wait..." : authMode === "register" ? "Create Account" : "Sign In"}
                </button>
              </form>

              <p className="inline-message">{authMessage}</p>
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">PrepMind AI</p>
          <h1>Adaptive study workspace for retrieval, mastery tracking, and exam prep.</h1>
          <p className="hero-text">
            Your account session is active, so uploads, recommendations, and progress are now tied to your own study history.
          </p>
        </div>

        <div className="hero-meta">
          <div className="account-row">
            <div>
              <div className={`status-pill status-${status}`}>{status === "online" ? "Backend Online" : "Backend Offline"}</div>
              <strong className="account-name">{currentUser.name}</strong>
              <p>{currentUser.email}</p>
            </div>
            <button className="ghost-btn" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
          <p>{workspaceMessage}</p>
          <div className="hero-grid">
            {heroStats.map((stat) => (
              <article key={stat.label} className={`stat-card tone-${stat.tone}`}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="navigation-panel">
          <div>
            <p className="eyebrow">Product Areas</p>
            <h2>{activeLabel}</h2>
          </div>

          <nav className="nav-list" aria-label="PrepMind sections">
            {views.map((view) => (
              <button
                key={view.key}
                className={view.key === activeView ? "nav-chip active" : "nav-chip"}
                onClick={() => setActiveView(view.key)}
                type="button"
              >
                <span>{view.eyebrow}</span>
                <strong>{view.label}</strong>
              </button>
            ))}
          </nav>

          <div className="side-note">
            <p className="eyebrow">Auth Status</p>
            <h3>Session persistence enabled</h3>
            <p>Refresh the page and your signed session cookie will keep you logged in until logout or expiry.</p>
          </div>
        </aside>

        <section className="content-panel">
          {activeView === "dashboard" && (
            <div className="view-grid">
              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Weak Topics</p>
                    <h2>Start with the concepts that are pulling readiness down.</h2>
                  </div>
                  <button className="ghost-btn" type="button" onClick={() => setActiveView("progress")}>
                    Open progress
                  </button>
                </div>

                <div className="topic-grid">
                  {weakTopics.length > 0 ? (
                    weakTopics.map((topic) => (
                      <article key={topic.topic_name} className="topic-card">
                        <span>{topic.topic_name}</span>
                        <strong>{Math.round(topic.mastery_score)}%</strong>
                        <p>{topic.study_frequency} review cycle(s) tracked</p>
                      </article>
                    ))
                  ) : (
                    <div className="empty-card">Upload your first study document to begin topic tracking.</div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Recommendations</p>
                    <h2>Next best actions</h2>
                  </div>
                </div>

                <div className="stack-list">
                  {recommendations.length > 0 ? (
                    recommendations.map((item) => (
                      <article key={item.topic} className="stack-card">
                        <strong>{item.topic}</strong>
                        <p>{item.reason}</p>
                        <small>{item.action}</small>
                      </article>
                    ))
                  ) : (
                    <div className="empty-card">Recommendations appear after ingestion creates topic signals.</div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Recent Uploads</p>
                    <h2>Indexed materials</h2>
                  </div>
                  <button className="ghost-btn" type="button" onClick={() => setActiveView("upload")}>
                    Add material
                  </button>
                </div>

                <div className="stack-list">
                  {recentDocuments.length > 0 ? (
                    recentDocuments.map((document) => (
                      <article key={document.id} className="stack-card">
                        <strong>{document.name}</strong>
                        <p>{document.course_name}</p>
                        <small>{document.chunk_count} chunks indexed</small>
                      </article>
                    ))
                  ) : (
                    <div className="empty-card">No study content yet. Start from the Upload tab.</div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeView === "upload" && (
            <div className="view-grid">
              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Document Upload</p>
                    <h2>Feed the study memory with clean course materials.</h2>
                  </div>
                </div>

                <form className="form-shell" onSubmit={handleUpload}>
                  <label>
                    Course label
                    <input value={courseName} onChange={(event) => setCourseName(event.target.value)} />
                  </label>

                  <label className="file-picker">
                    Study file
                    <input
                      accept=".pdf,.txt,.docx"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                  </label>

                  <button className="primary-btn" disabled={isBusy} type="submit">
                    {isBusy ? "Processing..." : "Upload and Index"}
                  </button>
                </form>

                <p className="inline-message">{uploadMessage || "Accepted formats: PDF, TXT, DOCX."}</p>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Live Inventory</p>
                    <h2>Current documents</h2>
                  </div>
                </div>

                <div className="stack-list">
                  {documents.length > 0 ? (
                    documents.map((document) => (
                      <article key={document.id} className="stack-card">
                        <strong>{document.document_name}</strong>
                        <p>
                          {document.course_name} | {document.document_type.toUpperCase()}
                        </p>
                        <small>{document.chunk_count} chunks ready</small>
                      </article>
                    ))
                  ) : (
                    <div className="empty-card">No uploaded documents yet.</div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeView === "ask" && (
            <div className="view-grid">
              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Grounded Study Assistant</p>
                    <h2>Ask questions only against uploaded study materials.</h2>
                  </div>
                </div>

                <form className="form-shell" onSubmit={handleAsk}>
                  <label>
                    Question
                    <textarea
                      onChange={(event) => setQuestion(event.target.value)}
                      rows={5}
                      value={question}
                    />
                  </label>

                  <button className="primary-btn" disabled={isBusy} type="submit">
                    {isBusy ? "Searching..." : "Ask PrepMind"}
                  </button>
                </form>

                <p className="inline-message">{askMessage || "Responses stay grounded in indexed chunks."}</p>
              </section>

              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Response</p>
                    <h2>Study guidance with citations</h2>
                  </div>
                </div>

                {answer ? (
                  <div className="answer-shell">
                    <article className="answer-card">
                      <p>{answer.answer}</p>
                    </article>

                    <div className="citation-grid">
                      {answer.citations.map((citation, index) => (
                        <article key={`${citation.document_name}-${index}`} className="citation-card">
                          <span>{citation.topic_label}</span>
                          <strong>{citation.document_name}</strong>
                          <p>{citation.snippet}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-card">Ask a study question to see grounded output and source snippets.</div>
                )}
              </section>
            </div>
          )}

          {(activeView === "flashcards" || activeView === "quiz" || activeView === "exam") && (
            <div className="view-grid">
              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Next Milestone</p>
                    <h2>
                      {activeView === "flashcards" && "Adaptive flashcard generation"}
                      {activeView === "quiz" && "Structured quiz generation"}
                      {activeView === "exam" && "Timed exam simulation"}
                    </h2>
                  </div>
                </div>

                <div className="roadmap-grid">
                  <article className="roadmap-card">
                    <strong>Already scaffolded</strong>
                    <p>Topic mastery, recommendations, and grounded retrieval are now in place to support this flow.</p>
                  </article>
                  <article className="roadmap-card">
                    <strong>Next implementation</strong>
                    <p>Add generation endpoints backed by retrieved chunks, structured response validation, and attempt persistence.</p>
                  </article>
                  <article className="roadmap-card">
                    <strong>What unlocks the best version</strong>
                    <p>An external model key for quiz, flashcard, and exam-quality content creation.</p>
                  </article>
                </div>
              </section>
            </div>
          )}

          {activeView === "progress" && (
            <div className="view-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Readiness</p>
                    <h2>Exam readiness score</h2>
                  </div>
                </div>

                <div className="readiness-card">
                  <strong>{Math.round(progress?.readiness_score ?? 0)}%</strong>
                  <p>{progress?.study_streak_days ?? 0} active topic touchpoints in the last week.</p>
                </div>
              </section>

              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Mastery Table</p>
                    <h2>Topic-level progress</h2>
                  </div>
                </div>

                <div className="progress-list">
                  {progress?.topic_mastery.length ? (
                    progress.topic_mastery.map((topic) => (
                      <article key={topic.topic_name} className="progress-row">
                        <div>
                          <strong>{topic.topic_name}</strong>
                          <p>{topic.study_frequency} review cycle(s)</p>
                        </div>
                        <div className="progress-meter">
                          <span style={{ width: `${Math.max(topic.mastery_score, 6)}%` }} />
                        </div>
                        <strong>{Math.round(topic.mastery_score)}%</strong>
                      </article>
                    ))
                  ) : (
                    <div className="empty-card">Progress data appears after documents create topics and study activity begins.</div>
                  )}
                </div>
              </section>

              <section className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Recent Activity</p>
                    <h2>Study signals</h2>
                  </div>
                </div>

                <div className="stack-list">
                  {progress?.recent_activity.length ? (
                    progress.recent_activity.map((item) => (
                      <article key={item} className="stack-card">
                        <p>{item}</p>
                      </article>
                    ))
                  ) : (
                    <div className="empty-card">No study activity recorded yet.</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
