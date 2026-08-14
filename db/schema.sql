-- FDEC 2026 选座系统 · D1 表结构
-- 设计原则：手机号不落明文（只存 HMAC 摘要 + 后四位），一人一座由唯一索引兜底

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS invite_codes;
DROP TABLE IF EXISTS attendees;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS config;

-- 参会者：报名表导入的白名单 + 现场用邀请码进来的临时来宾
CREATE TABLE attendees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  phone_hash  TEXT    NOT NULL UNIQUE,   -- HMAC-SHA256(手机号)，登录时比对
  phone_tail  TEXT,                      -- 后四位，仅用于人工核对
  company     TEXT,
  job_title   TEXT,
  source      TEXT    NOT NULL DEFAULT 'whitelist', -- whitelist | invite
  invite_code TEXT,                      -- 走邀请码进来的记录来源码
  created_at  INTEGER NOT NULL
);

-- 话题（一张桌子 = 一个话题）
CREATE TABLE topics (
  id          INTEGER PRIMARY KEY,
  table_no    INTEGER NOT NULL UNIQUE,   -- 桌号 1..20，与现场桌牌一致
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  owner_name  TEXT    NOT NULL DEFAULT '待定',
  capacity    INTEGER NOT NULL DEFAULT 10, -- 含 0 号发起人位
  accent      TEXT    NOT NULL DEFAULT 'cyan'
);

-- 座位占用。seat_no = 0 固定为话题发起人，不开放选择
CREATE TABLE seats (
  topic_id    INTEGER NOT NULL,
  seat_no     INTEGER NOT NULL,
  attendee_id INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (topic_id, seat_no)
);
-- 一人只能占一个座位（换桌 = 先删后插，在同一批事务里完成）
CREATE UNIQUE INDEX idx_seats_attendee ON seats(attendee_id);

-- 邀请码：personal 一人一码用完即止，universal 现场万能码带配额和有效期
CREATE TABLE invite_codes (
  code        TEXT    PRIMARY KEY,
  kind        TEXT    NOT NULL DEFAULT 'personal', -- personal | universal
  quota       INTEGER NOT NULL DEFAULT 1,
  used        INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  expires_at  INTEGER,                   -- 秒级时间戳，NULL 表示不过期
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- 全局开关与文案，留给后台改
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 审计日志：谁在什么时候做了什么，方便现场排查纠纷
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  attendee_id INTEGER,
  action      TEXT    NOT NULL,
  detail      TEXT,
  ip          TEXT
);
CREATE INDEX idx_audit_at ON audit_log(at);

INSERT INTO config (key, value) VALUES
  ('open', '1'),
  ('notice', ''),
  ('allow_selfserve', '1'); -- 是否允许不在白名单的人凭邀请码自助入场
