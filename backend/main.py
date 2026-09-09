import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.path.join(os.path.dirname(__file__), "cfo_game.db")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                score INTEGER NOT NULL,
                ranking TEXT NOT NULL,
                total_profit INTEGER NOT NULL,
                total_cash INTEGER NOT NULL,
                risk_score INTEGER NOT NULL,
                credit_rating TEXT NOT NULL,
                months_survived INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Trade CFO API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScoreIn(BaseModel):
    name: str
    score: int
    ranking: str
    total_profit: int
    total_cash: int
    risk_score: int
    credit_rating: str
    months_survived: int


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/leaderboard")
def leaderboard() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM scores ORDER BY score DESC, id ASC LIMIT 50"
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/scores", status_code=201)
def create_score(score: ScoreIn) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO scores
                (name, score, ranking, total_profit, total_cash,
                 risk_score, credit_rating, months_survived, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                score.name,
                score.score,
                score.ranking,
                score.total_profit,
                score.total_cash,
                score.risk_score,
                score.credit_rating,
                score.months_survived,
                created_at,
            ),
        )
        row = conn.execute("SELECT * FROM scores WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)
