from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.study import TopicMastery
from app.models.user import User
from app.schemas.study import (
    AskRequest,
    AskResponse,
    DashboardResponse,
    ExamStartRequest,
    ExamStartResponse,
    ExamSubmitRequest,
    ExamSubmitResponse,
    FlashcardGenerateRequest,
    FlashcardGenerateResponse,
    FlashcardItem,
    FlashcardListResponse,
    FlashcardRateRequest,
    ProgressResponse,
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizSubmitRequest,
    QuizSubmitResponse,
    RecommendationItem,
)
from app.services.dashboard_service import build_dashboard, build_progress, build_recommendations
from app.services.study_service import (
    answer_question,
    generate_flashcards,
    generate_quiz,
    list_flashcards,
    rate_flashcard,
    start_exam,
    submit_exam,
    submit_quiz,
)

router = APIRouter(tags=["study"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    return build_dashboard(db, current_user.id)


@router.get("/progress", response_model=ProgressResponse)
def progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressResponse:
    return build_progress(db, current_user.id)


@router.get("/recommendations", response_model=list[RecommendationItem])
def recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RecommendationItem]:
    topic_rows = db.scalars(
        select(TopicMastery)
        .where(TopicMastery.user_id == current_user.id)
        .order_by(TopicMastery.mastery_score.asc())
    ).all()
    return build_recommendations(topic_rows)


@router.post("/ask", response_model=AskResponse)
def ask(
    payload: AskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AskResponse:
    return answer_question(db, current_user.id, payload.question)


@router.get("/flashcards", response_model=FlashcardListResponse)
def flashcards(
    topic: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardListResponse:
    return list_flashcards(db, current_user.id, topic)


@router.post("/flashcards/generate", response_model=FlashcardGenerateResponse)
def flashcards_generate(
    payload: FlashcardGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardGenerateResponse:
    return generate_flashcards(
        db,
        user_id=current_user.id,
        count=payload.count,
        difficulty=payload.difficulty,
        topic=payload.topic,
    )


@router.post("/flashcards/{flashcard_id}/rate", response_model=FlashcardItem)
def flashcards_rate(
    flashcard_id: int,
    payload: FlashcardRateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FlashcardItem:
    try:
        return rate_flashcard(db, current_user.id, flashcard_id, payload.rating)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/quiz/generate", response_model=QuizGenerateResponse)
def quiz_generate(
    payload: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizGenerateResponse:
    return generate_quiz(
        db,
        user_id=current_user.id,
        question_count=payload.question_count,
        difficulty=payload.difficulty,
        topic=payload.topic,
    )


@router.post("/quiz/submit", response_model=QuizSubmitResponse)
def quiz_submit(
    payload: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizSubmitResponse:
    return submit_quiz(db, current_user.id, [answer.model_dump() for answer in payload.answers])


@router.post("/exam/start", response_model=ExamStartResponse)
def exam_start(
    payload: ExamStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExamStartResponse:
    return start_exam(
        db,
        user_id=current_user.id,
        question_count=payload.question_count,
        minutes=payload.minutes,
    )


@router.post("/exam/submit", response_model=ExamSubmitResponse)
def exam_submit(
    payload: ExamSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExamSubmitResponse:
    return submit_exam(
        db,
        user_id=current_user.id,
        answers=[answer.model_dump() for answer in payload.answers],
        duration_minutes=payload.duration_minutes,
    )
