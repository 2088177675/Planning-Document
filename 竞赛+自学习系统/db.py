# -*- coding: utf-8 -*-
"""数据库连接与表结构定义（SQLite，无需额外安装）"""
import os
import sqlite3
from flask import g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'app.db')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  real_name TEXT DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
  is_member INTEGER NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id INTEGER,
  review_note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS member_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  operator_id INTEGER,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publisher_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  intro TEXT DEFAULT '',
  background TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  audience TEXT DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'individual',
  team_size_max INTEGER DEFAULT 1,
  team_count_max INTEGER,
  participant_limit INTEGER,
  signup_start TEXT,
  signup_end TEXT,
  contest_start TEXT,
  submit_deadline TEXT,
  result_time TEXT,
  prize_amount REAL NOT NULL DEFAULT 0,
  eval_mode TEXT NOT NULL DEFAULT 'manual',
  tie_breaker TEXT NOT NULL DEFAULT 'earliest',
  status TEXT NOT NULL DEFAULT 'pending',
  champion_user_id INTEGER,
  champion_team_id INTEGER,
  reject_reason TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS comp_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  kind TEXT DEFAULT '',
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comp_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comp_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  qno INTEGER NOT NULL,
  content TEXT NOT NULL,
  answer TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  leader_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS comp_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  team_id INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(competition_id, user_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  team_id INTEGER,
  content TEXT DEFAULT '',
  answers_json TEXT DEFAULT '',
  filename TEXT DEFAULT '',
  stored_name TEXT DEFAULT '',
  score REAL,
  review_note TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bounties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publisher_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  bounty_amount REAL NOT NULL,
  expire_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  adopted_answer_id INTEGER,
  reject_reason TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS bounty_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bounty_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bounty_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bounty_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  filename TEXT DEFAULT '',
  stored_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL,
  UNIQUE(bounty_id, user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  direction TEXT NOT NULL,
  ref_type TEXT DEFAULT '',
  ref_id INTEGER,
  balance_after REAL NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  imported_by INTEGER,
  created_at TEXT NOT NULL
);

-- ================= 自学习平台表 =================

CREATE TABLE IF NOT EXISTS learn_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learn_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  folder_id INTEGER,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  meta_json TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learn_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learn_ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  result TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'success',
  cost_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learn_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL,
  followee_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, material_id)
);

CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  handler_id INTEGER,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  handled_at TEXT
);

CREATE TABLE IF NOT EXISTS user_quota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  daily_limit INTEGER NOT NULL DEFAULT 30,
  used_today INTEGER NOT NULL DEFAULT 0,
  reset_date TEXT NOT NULL
);
"""


def get_db():
    if 'db' not in g:
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        g.db = conn
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.executescript(SCHEMA)
    db.commit()


def q(sql, args=()):
    return get_db().execute(sql, args).fetchall()


def qone(sql, args=()):
    return get_db().execute(sql, args).fetchone()


def execute(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur
