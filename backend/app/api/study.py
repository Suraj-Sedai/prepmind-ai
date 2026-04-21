from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.study import TopicMastery
from app.models.user import User
from app.schemas.study import AskRequest, AskResponse, DashboardResponse, ProgressResponse, RecommendationItem
from app.services.dashboard_service import build_dashboard, build_progress, build_recommendations
from app.services.study_service import answer_question

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
