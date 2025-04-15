import sqlite3 from "sqlite3";
import path from "path";

// Initialize SQLite database
export const db = new sqlite3.Database(
    path.join(__dirname, "../users.db"),
    (err) => {
        if (err) {
            console.error("Error opening database:", err.message);
        } else {
            console.log("Connected to SQLite database.");
        }
    }
);

// Create tables if they don't exist
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            dob TEXT NOT NULL,
            verified INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            coins INTEGER DEFAULT 0,
            last_login TEXT,
            snitch_status TEXT,
            creator_badge INTEGER DEFAULT 0,
            tier INTEGER DEFAULT 1,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            title TEXT
        )
    `);

    // Posts table
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            content TEXT,
            mode TEXT DEFAULT 'main',
            likes INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Likes table
    db.run(`
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(post_id) REFERENCES posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(post_id, user_id)
        )
    `);

    // Badges table
    db.run(`
        CREATE TABLE IF NOT EXISTS badges (
            user_id INTEGER PRIMARY KEY,
            news_king INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Game Squads table
    db.run(`
        CREATE TABLE IF NOT EXISTS game_squads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            game_name TEXT,
            uid TEXT,
            description TEXT,
            status TEXT DEFAULT 'open',
            max_members INTEGER DEFAULT 5,
            wins INTEGER DEFAULT 0,
            is_featured INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Squad Members table
    db.run(`
        CREATE TABLE IF NOT EXISTS squad_members (
            squad_id INTEGER,
            user_id INTEGER,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (squad_id, user_id),
            FOREIGN KEY(squad_id) REFERENCES game_squads(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Tournaments table
    db.run(`
        CREATE TABLE IF NOT EXISTS tournaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER,
            title TEXT,
            description TEXT,
            game_name TEXT,
            status TEXT DEFAULT 'open',
            winner_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(squad_id) REFERENCES game_squads(id),
            FOREIGN KEY(winner_id) REFERENCES game_squads(id)
        )
    `);

    // Tournament Participants table
    db.run(`
        CREATE TABLE IF NOT EXISTS tournament_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER,
            squad_id INTEGER,
            FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
            FOREIGN KEY(squad_id) REFERENCES game_squads(id),
            UNIQUE(tournament_id, squad_id)
        )
    `);

    // Game Clips table
    db.run(`
        CREATE TABLE IF NOT EXISTS game_clips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER,
            user_id INTEGER,
            clip_url TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(squad_id) REFERENCES game_squads(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Squad Messages table
    db.run(`
        CREATE TABLE IF NOT EXISTS squad_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            squad_id INTEGER,
            user_id INTEGER,
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(squad_id) REFERENCES game_squads(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Teams table for Hype Battles
    db.run(`
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            creator_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(creator_id) REFERENCES users(id)
        )
    `);

    // Team Members table for Hype Battles
    db.run(`
        CREATE TABLE IF NOT EXISTS team_members (
            team_id INTEGER,
            user_id INTEGER,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (team_id, user_id),
            FOREIGN KEY(team_id) REFERENCES teams(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Hype Battles table
    db.run(`
        CREATE TABLE IF NOT EXISTS hype_battles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            opponent_id INTEGER,
            team_id INTEGER,
            opponent_team_id INTEGER,
            category TEXT,
            content TEXT,
            media_url TEXT,
            votes INTEGER DEFAULT 0,
            opponent_votes INTEGER DEFAULT 0,
            is_live INTEGER DEFAULT 0,
            voting_deadline TIMESTAMP,
            winner_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(opponent_id) REFERENCES users(id),
            FOREIGN KEY(team_id) REFERENCES teams(id),
            FOREIGN KEY(opponent_team_id) REFERENCES teams(id),
            FOREIGN KEY(winner_id) REFERENCES users(id)
        )
    `);

    // Battle Votes table
    db.run(`
        CREATE TABLE IF NOT EXISTS battle_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            battle_id INTEGER,
            vote_for TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(battle_id) REFERENCES hype_battles(id),
            UNIQUE(user_id, battle_id)
        )
    `);

    // Showdown Votes table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date_option TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(user_id)
        )
    `);

    // Scheduled Battles table
    db.run(`
        CREATE TABLE IF NOT EXISTS scheduled_battles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT
        )
    `);

    // Coin Flip History table
    db.run(`
        CREATE TABLE IF NOT EXISTS coin_flip_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bet_amount INTEGER,
            won_amount INTEGER,
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Hall of Fame table
    db.run(`
        CREATE TABLE IF NOT EXISTS hall_of_fame (
            user_id INTEGER PRIMARY KEY,
            post_id INTEGER,
            total_likes INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES posts(id)
        )
    `);
});

// Close database on process exit
process.on("SIGINT", () => {
    db.close((err) => {
        if (err) {
            console.error("Error closing database:", err.message);
        }
        console.log("Database connection closed.");
        process.exit(0);
    });
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
