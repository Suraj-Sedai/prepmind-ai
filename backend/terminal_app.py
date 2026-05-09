import sys
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.text import Text
from rich.box import ROUNDED
from rich.theme import Theme
from rich.status import Status

# Import project logic
from app.db.session import SessionLocal
from app.rag.answer import answer_question_with_rag
from app.core.config import get_settings

# 1. Define the Professional "Safe" Theme
study_app_theme = Theme({
    "app.title": "bold underline cadet_blue",
    "ai.response": "slate_blue1",
    "user.query": "bold sea_green3",
    "error": "bold bright_red",
    "context.source": "italic dim sky_blue3",
    "ui.border": "grey39"
})

console = Console(theme=study_app_theme)

class StudyUI:
    @staticmethod
    def format_agent_response(raw_text: str, source_name: str = "Course Material"):
        """
        Takes raw string from the AI and wraps it in a professional UI.
        Works for both Light and Dark terminal modes.
        """
        # Convert raw text to Markdown for proper bolding/lists
        md_content = Markdown(raw_text)
        
        # Create a clean subtitle for the "Source" attribution
        subtitle = Text(f" Source: {source_name} ", style="italic dim grey50")
        
        # Create the Panel (The "Box")
        response_panel = Panel(
            md_content,
            title="[bold teal]AI Tutor[/bold teal]",
            title_align="left",
            subtitle=subtitle,
            subtitle_align="right",
            border_style="grey39",
            box=ROUNDED,
            padding=(1, 2)
        )
        
        console.print("\n") 
        console.print(response_panel)
        console.print("\n")

def run_terminal_app():
    settings = get_settings()
    db = SessionLocal()
    
    # For demo purposes, we'll use the first user found or a default
    user_id = 2 # Based on previous database check
    
    console.print(Rule(style="ui.border"))
    console.print("PrepMind AI - Terminal Study Workspace", style="app.title", justify="center")
    console.print(Rule(style="ui.border"))
    console.print("\nWelcome back! Type your question below or 'exit' to quit.\n")

    try:
        while True:
            query = console.input("[user.query]Question:[/user.query] ")
            
            if query.lower() in ["exit", "quit", "q"]:
                console.print("\n[italic dim]Happy studying! Goodbye.[/italic dim]")
                break
                
            if not query.strip():
                continue

            with console.status("[italic grey50]Consulting study materials...", spinner="dots"):
                try:
                    response = answer_question_with_rag(db, user_id=user_id, question=query)
                    
                    # Determine source name from citations if available
                    source_name = "General AI knowledge"
                    if response.citations:
                        source_name = response.citations[0].document_name
                        if len(response.citations) > 1:
                            source_name += f" (+{len(response.citations)-1} more)"
                    
                    StudyUI.format_agent_response(response.answer, source_name=source_name)
                    
                except Exception as e:
                    console.print(f"\n[error]Error:[/error] {str(e)}")
                    
    except KeyboardInterrupt:
        console.print("\n\n[italic dim]Interrupted. Goodbye.[/italic dim]")
    finally:
        db.close()

if __name__ == "__main__":
    from rich.rule import Rule
    run_terminal_app()
