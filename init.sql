-- Teenverse Database Initialization Script
-- This script runs once when the PostgreSQL container is first created

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    dob TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    snitch_status TEXT,
    creator_badge INTEGER DEFAULT 0,
    tier INTEGER DEFAULT 1,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    title TEXT,
    legend_status TEXT DEFAULT '',
    bio TEXT,
    background_theme TEXT DEFAULT 'default',
    spending_restrictions BOOLEAN DEFAULT false,
    auto_earn_uploads BOOLEAN DEFAULT true,
    theme TEXT DEFAULT 'Neon Glow',
    animations_enabled BOOLEAN DEFAULT true,
    font_size TEXT DEFAULT 'medium',
    language TEXT DEFAULT 'en',
    snitch_risk INTEGER DEFAULT 0,
    profile_media_url TEXT,
    profile_media_type TEXT,
    last_login TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username TEXT,
    content TEXT,
    mode TEXT DEFAULT 'main',
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    media_url TEXT,
    media_type TEXT,
    reactions TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS badges (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    news_king INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_squads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username TEXT,
    game_name TEXT,
    uid TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    max_members INTEGER DEFAULT 5,
    wins INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS squad_members (
    squad_id INTEGER REFERENCES game_squads(id),
    user_id INTEGER REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (squad_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_squads_user_id ON game_squads(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user_id ON squad_members(user_id);
