export interface User {
  id: number;
  name: string;
  email: string;
  preferred_difficulty: string;
  profile_image_url?: string | null;
  created_at: string;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface SessionState {
  authenticated: boolean;
  user: User | null;
}

export interface DashboardStat {
  label: string;
  value: string;
  tone: string;
}

export interface DocumentSnapshot {
  id: number;
  name: string;
  course_name: string;
  upload_date: string;
  chunk_count: number;
}

export interface TopicMasteryItem {
  topic_name: string;
  mastery_score: number;
  study_frequency: number;
  last_reviewed: string;
}

export interface RecommendationItem {
  topic: string;
  reason: string;
  action: string;
}

export interface DashboardResponse {
  stats: DashboardStat[];
  recent_documents: DocumentSnapshot[];
  weak_topics: TopicMasteryItem[];
  recommendations: RecommendationItem[];
}

export interface DocumentItem {
  id: number;
  document_name: string;
  document_type: string;
  upload_date: string;
  course_name: string;
  processing_status: string;
  chunk_count: number;
  file_size_bytes: number;
  extracted_word_count: number;
  topic_summary: string;
  error_message?: string | null;
}

export interface DocumentListResponse {
  items: DocumentItem[];
}

export interface UploadResponse {
  message: string;
  document: DocumentItem;
  topics_detected: string[];
}

export interface DeleteDocumentResponse {
  message: string;
  document_id: number;
}

export interface CitationItem {
  document_name: string;
  topic_label: string;
  snippet: string;
}

export interface AskResponse {
  answer: string;
  citations: CitationItem[];
  confidence: number;
}

export interface ProgressResponse {
  readiness_score: number;
  study_streak_days: number;
  topic_mastery: TopicMasteryItem[];
  recent_activity: string[];
  quiz_accuracy: number;
  flashcard_coverage: number;
}

export interface FlashcardItem {
  id: number;
  topic_name: string;
  question: string;
  answer: string;
  difficulty: string;
  student_rating?: string | null;
}

export interface FlashcardListResponse {
  items: FlashcardItem[];
}

export interface FlashcardGenerateRequest {
  topic?: string;
  count: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface FlashcardGenerateResponse {
  message: string;
  items: FlashcardItem[];
}

export interface FlashcardRateRequest {
  rating: "easy" | "medium" | "hard";
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  prompt: string;
  question_type: "multiple_choice" | "true_false" | "fill_blank" | "short_answer";
  topic_name: string;
  difficulty: string;
  options: QuestionOption[];
  source_snippet: string;
  answer_token: string;
}

export interface QuizGenerateRequest {
  topic?: string;
  difficulty: "easy" | "medium" | "hard";
  question_count: number;
}

export interface QuizGenerateResponse {
  message: string;
  questions: QuizQuestion[];
}

export interface QuizAnswerSubmission {
  prompt: string;
  topic_name: string;
  question_type: string;
  difficulty: string;
  answer_token: string;
  student_answer: string;
}

export interface QuizResultItem {
  prompt: string;
  topic_name: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  feedback: string;
}

export interface QuizSubmitResponse {
  score_percent: number;
  correct_count: number;
  total_questions: number;
  weak_topics: string[];
  results: QuizResultItem[];
}

export interface ExamStartRequest {
  question_count: number;
  minutes: number;
}

export interface ExamStartResponse {
  message: string;
  duration_minutes: number;
  questions: QuizQuestion[];
}

export interface ExamSubmitResponse {
  score_percent: number;
  readiness_score: number;
  strong_topics: string[];
  weak_topics: string[];
  feedback: string[];
  results: QuizResultItem[];
}
