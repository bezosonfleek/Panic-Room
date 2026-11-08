CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE users(id bigserial PRIMARY KEY,email citext UNIQUE NOT NULL,username citext UNIQUE NOT NULL,pw_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions(token_hash bytea PRIMARY KEY,user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE progress(user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,lab_id text NOT NULL,xp int NOT NULL,cleared_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,lab_id));
