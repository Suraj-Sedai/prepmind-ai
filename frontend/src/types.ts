export interface User {
  id: number;
  name: string;
  email: string;
  preferred_difficulty: string;
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
}

export interface DocumentListResponse {
  items: DocumentItem[];
}

export interface UploadResponse {
  message: string;
  document: DocumentItem;
  topics_detected: string[];
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
}
