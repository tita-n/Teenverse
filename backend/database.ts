import sqlite3 from "sqlite3";

export const db = new sqlite3.Database("users.db", (err) => {
    if (err) console.error("Database connection error:", err);
});

// Users table (added creator_badge column)
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password TEXT,
    dob TEXT,
    verified INTEGER,
    coins INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    last_login TEXT DEFAULT NULL,
    snitch_status TEXT DEFAULT 'clean',
    title TEXT DEFAULT NULL,
    creator_badge TEXT DEFAULT NULL -- New column for special badge
)`, (err) => {
    if (err) console.error("Error creating users table:", err);
});

// Posts table
db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    content TEXT,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating posts table:", err);
});

// Likes table
db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating likes table:", err);
});

// Badges table
db.run(`CREATE TABLE IF NOT EXISTS badges (
    user_id INTEGER PRIMARY KEY,
    news_king BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating badges table:", err);
});

// Coin flip history table
db.run(`CREATE TABLE IF NOT EXISTS coin_flip_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    bet_amount INTEGER,
    won_amount INTEGER,
    result TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating coin flip history table:", err);
});

// Hype battles table
db.run(`CREATE TABLE IF NOT EXISTS hype_battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    content TEXT,
    votes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating hype battles table:", err);
});

// Battle votes table
db.run(`CREATE TABLE IF NOT EXISTS battle_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    battle_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(battle_id) REFERENCES hype_battles(id)
)`, (err) => {
    if (err) console.error("Error creating battle votes table:", err);
});

// Showdown votes table
db.run(`CREATE TABLE IF NOT EXISTS showdown_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date_option TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating showdown votes table:", err);
});

// Scheduled battles table
db.run(`CREATE TABLE IF NOT EXISTS scheduled_battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT
)`, (err) => {
    if (err) console.error("Error creating scheduled battles table:", err);
});

// Update game_squads table to include is_featured column
db.run(`CREATE TABLE IF NOT EXISTS game_squads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    game_name TEXT,
    uid TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'open', -- 'open' or 'closed'
    max_members INTEGER DEFAULT 5, -- Default max members
    wins INTEGER DEFAULT 0, -- Track wins for leaderboards
    is_featured INTEGER DEFAULT 0, -- New column: 1 if featured, 0 if not
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating game squads table:", err);
});

// Create squad_members table to track squad memberships
db.run(`CREATE TABLE IF NOT EXISTS squad_members (
    squad_id INTEGER,
    user_id INTEGER,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (squad_id, user_id),
    FOREIGN KEY(squad_id) REFERENCES game_squads(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating squad members table:", err);
});

// Create tournaments table
db.run(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    squad_id INTEGER,
    title TEXT,
    description TEXT,
    game_name TEXT,
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'completed'
    winner_id INTEGER, -- References the winning squad_id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(squad_id) REFERENCES game_squads(id),
    FOREIGN KEY(winner_id) REFERENCES game_squads(id)
)`, (err) => {
    if (err) console.error("Error creating tournaments table:", err);
});

// Create tournament_participants table
db.run(`CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER,
    squad_id INTEGER,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, squad_id),
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY(squad_id) REFERENCES game_squads(id)
)`, (err) => {
    if (err) console.error("Error creating tournament participants table:", err);
});

// Create game_clips table
db.run(`CREATE TABLE IF NOT EXISTS game_clips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    squad_id INTEGER,
    user_id INTEGER,
    clip_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(squad_id) REFERENCES game_squads(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating game clips table:", err);
});

// Create squad_messages table
db.run(`CREATE TABLE IF NOT EXISTS squad_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    squad_id INTEGER,
    user_id INTEGER,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(squad_id) REFERENCES game_squads(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating squad messages table:", err);
});

// Hall of Fame table
db.run(`CREATE TABLE IF NOT EXISTS hall_of_fame (
    user_id INTEGER PRIMARY KEY,
    total_likes INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`, (err) => {
    if (err) console.error("Error creating hall of fame table:", err);
});

// Set the creator_badge for restorationmichael3@gmail.com
db.run(
    `UPDATE users SET creator_badge = 'Platform Creator' WHERE email = ?`,
    ["restorationmichael3@gmail.com"],
    (err) => {
        if (err) console.error("Error setting creator badge:", err);
        else console.log("Creator badge set for restorationmichael3@gmail.com");
    }
);
