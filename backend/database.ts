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
            title TEXT,
            legend_status TEXT DEFAULT ''
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
            tournament_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(opponent_id) REFERENCES users(id),
            FOREIGN KEY(team_id) REFERENCES teams(id),
            FOREIGN KEY(opponent_team_id) REFERENCES teams(id),
            FOREIGN KEY(winner_id) REFERENCES users(id),
            FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id)
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

    // Showdown Schedule table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Showdown Clips table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_clips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            clip_url TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tournament_id) REFERENCES showdown_tournaments(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, tournament_id, category)
        )
    `);

    // Showdown Clip Votes table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_clip_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            clip_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (clip_id) REFERENCES showdown_clips(id),
            UNIQUE(user_id, category)
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

    // Showdown Tournaments table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_tournaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT,
            status TEXT,
            start_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            winner_id INTEGER,
            FOREIGN KEY (winner_id) REFERENCES users(id)
        )
    `);

    // Showdown Participants table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_participants (
            tournament_id INTEGER,
            user_id INTEGER,
            status TEXT,
            bracket_position INTEGER,
            FOREIGN KEY (tournament_id) REFERENCES showdown_tournaments(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            PRIMARY KEY (tournament_id, user_id)
        )
    `);

    // Showdown Boosts table
    db.run(`
        CREATE TABLE IF NOT EXISTS showdown_boosts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER,
            battle_id INTEGER,
            user_id INTEGER,
            target_user_id INTEGER,
            coins_spent INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tournament_id) REFERENCES showdown_tournaments(id),
            FOREIGN KEY (battle_id) REFERENCES hype_battles(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (target_user_id) REFERENCES users(id)
        )
    `);

    // Profile Borders table
    db.run(`
        CREATE TABLE IF NOT EXISTS profile_borders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            border_style TEXT,
            awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Hall of Fame table
    db.run(`
        CREATE TABLE IF NOT EXISTS hall_of_fame (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            tournament_id INTEGER,
            rank INTEGER,
            awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (tournament_id) REFERENCES showdown_tournaments(id)
        )
    `);

    // Post Hall of Fame table
    db.run(`
        CREATE TABLE IF NOT EXISTS post_hall_of_fame (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            total_likes INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            UNIQUE(user_id)
        )
    `);

    // Developer Picks table
    db.run(`
        CREATE TABLE IF NOT EXISTS developer_picks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(user_id)
        )
    `);

        // New table for Rants (anonymous)
    db.run(`
        CREATE TABLE IF NOT EXISTS rants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT NOT NULL,
            upvotes INTEGER DEFAULT 0,
            reactions TEXT DEFAULT '{}', -- JSON string to store reaction counts
            hugs INTEGER DEFAULT 0,
            ask_for_advice INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // New table for Rant Comments (anonymous)
    db.run(`
        CREATE TABLE IF NOT EXISTS rant_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rant_id INTEGER,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(rant_id) REFERENCES rants(id)
        )
    `);
     
    // Add columns to users for special privileges
    db.run(`
        ALTER TABLE users ADD COLUMN is_moderator INTEGER DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes("duplicate column")) {
            console.error("Error adding is_moderator column:", err);
        }
    });

    db.run(`
        ALTER TABLE users ADD COLUMN verified_status INTEGER DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes("duplicate column")) {
            console.error("Error adding verified_status column:", err);
        }
    });

    db.run(`
        ALTER TABLE users ADD COLUMN early_access INTEGER DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes("duplicate column")) {
            console.error("Error adding early_access column:", err);
        }
    });

    // Add index for developer_picks
    db.run("CREATE INDEX IF NOT EXISTS idx_developer_picks_user ON developer_picks(user_id)");

    // Set creator_badge and add to developer_picks for restorationmichael3@gmail.com
    db.get(
        "SELECT id, username FROM users WHERE email = ?",
        ["restorationmichael3@gmail.com"],
        (err, user: any) => {
            if (err) {
                console.error("Error fetching user for creator badge:", err);
                return;
            }
            if (user) {
                db.run(
                    `UPDATE users SET creator_badge = 'Platform Creator' WHERE id = ?`,
                    [user.id],
                    (err) => {
                        if (err) console.error("Error setting creator badge:", err);
                        else console.log("Creator badge set for restorationmichael3@gmail.com");
                    }
                );

                db.run(
                    `INSERT OR IGNORE INTO developer_picks (user_id, title) VALUES (?, ?)`,
                    [user.id, "PrimeArchitect"],
                    (err) => {
                        if (err) console.error("Error adding to developer_picks:", err);
                        else console.log(`Added ${user.username} as PrimeArchitect to developer_picks`);
                    }
                );
            } else {
                console.log("User with email restorationmichael3@gmail.com not found for creator setup");
            }
        }
    );
});

// Add indices for performance
db.run("CREATE INDEX IF NOT EXISTS idx_showdown_participants_tournament ON showdown_participants(tournament_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_showdown_boosts_tournament ON showdown_boosts(tournament_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_hall_of_fame_user ON hall_of_fame(user_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_hype_battles_tournament ON hype_battles(tournament_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_showdown_clips_tournament ON showdown_clips(tournament_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_showdown_clip_votes_user ON showdown_clip_votes(user_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_rants_category ON rants(category)");
db.run("CREATE INDEX IF NOT EXISTS idx_rant_comments_rant ON rant_comments(rant_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_post_hall_of_fame_user ON post_hall_of_fame(user_id)");

// Initial setup for the next Ultimate Showdown
const nextMonth = new Date();
nextMonth.setMonth(nextMonth.getMonth() + 1);
nextMonth.setDate(1);
db.run(
    "INSERT OR IGNORE INTO showdown_tournaments (season, status, start_date) VALUES (?, ?, ?)",
    [`Season ${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`, "open", nextMonth.toISOString().split("T")[0]],
    (err) => {
        if (err) console.error("Error initializing showdown tournament:", err);
    }
);

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
