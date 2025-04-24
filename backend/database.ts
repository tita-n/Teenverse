import sqlite3 from "sqlite3";
import path from "path";

// Initialize SQLite database
const dbPath = path.join(__dirname, "../users.db");
console.log(`[${new Date().toISOString()}] Database path: ${dbPath}`);
export const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

// Log all SQL queries for debugging
db.on("trace", (sql) => {
    console.log(`[${new Date().toISOString()}] SQL Query: ${sql}`);
});

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
            snitch_status TEXT,
            creator_badge INTEGER DEFAULT 0,
            tier INTEGER DEFAULT 1,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            title TEXT,
            legend_status TEXT DEFAULT '',
            bio TEXT, -- Added for profile settings
            background_theme TEXT DEFAULT 'default', -- Added for profile settings
            spending_restrictions BOOLEAN DEFAULT 0, -- Added for economy settings
            auto_earn_uploads BOOLEAN DEFAULT 1, -- Added for economy settings
            theme TEXT DEFAULT 'Neon Glow', -- Added for customization settings
            animations_enabled BOOLEAN DEFAULT 1, -- Added for customization settings
            font_size TEXT DEFAULT 'medium', -- Added for customization settings
            language TEXT DEFAULT 'en', -- Added for customization settings
            snitch_risk INTEGER DEFAULT 0 -- Added for privacy settings
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
db.run(`
    ALTER TABLE hype_battles ADD COLUMN opponent_media_url TEXT
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

    // Rants table (anonymous)
    db.run(`
        CREATE TABLE IF NOT EXISTS rants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT NOT NULL,
            upvotes INTEGER DEFAULT 0,
            reactions TEXT DEFAULT '{}',
            hugs INTEGER DEFAULT 0,
            ask_for_advice INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Rant Comments table (anonymous)
    db.run(`
        CREATE TABLE IF NOT EXISTS rant_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rant_id INTEGER,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(rant_id) REFERENCES rants(id)
        )
    `);

    // Shop Items table
    db.run(`
        CREATE TABLE IF NOT EXISTS shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            description TEXT,
            is_limited BOOLEAN DEFAULT 0,
            stock INTEGER DEFAULT NULL
        )
    `);

    // User Inventory table
    db.run(`
        CREATE TABLE IF NOT EXISTS user_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (item_id) REFERENCES shop_items(id)
        )
    `);

    // Conversations table (for DMs)
    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1_id INTEGER NOT NULL,
            user2_id INTEGER NOT NULL,
            is_boosted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user1_id) REFERENCES users(id),
            FOREIGN KEY(user2_id) REFERENCES users(id),
            UNIQUE(user1_id, user2_id),
            UNIQUE(user2_id, user1_id)
        )
    `);

    // Messages table (for DMs)
db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT,
        media_url TEXT,
        media_type TEXT CHECK(media_type IN ('voice', 'photo', 'video')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_ghost_bomb INTEGER DEFAULT 0,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id),
        FOREIGN KEY(sender_id) REFERENCES users(id)
    )
`);

    // Blocked Users table (for Privacy & Safety)
    db.run(`
        CREATE TABLE IF NOT EXISTS blocked_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            blocked_user_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(blocked_user_id) REFERENCES users(id)
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

    // Post Comments table
    db.run(`
        CREATE TABLE IF NOT EXISTS post_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            username TEXT,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            pinned INTEGER DEFAULT 0,
            FOREIGN KEY(post_id) REFERENCES posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Comment Replies table
    db.run(`
        CREATE TABLE IF NOT EXISTS comment_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER,
            user_id INTEGER,
            username TEXT,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(comment_id) REFERENCES post_comments(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Comment Likes table (for additional feature)
    db.run(`
        CREATE TABLE IF NOT EXISTS comment_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(comment_id) REFERENCES post_comments(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(comment_id, user_id)
        )
    `);

    // Post Shares table (for additional feature)
    db.run(`
        CREATE TABLE IF NOT EXISTS post_shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            squad_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(post_id) REFERENCES posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(squad_id) REFERENCES game_squads(id)
        )
    `);

    // Add reactions column to posts table
    db.run(`
        ALTER TABLE posts ADD COLUMN reactions TEXT DEFAULT '{}'
    `, (err) => {
        if (err && !err.message.includes("duplicate column")) {
            console.error("Error adding reactions column to posts:", err);
        }
    });

    // Comments table
    db.run(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            pinned INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Replies table
    db.run(`
        CREATE TABLE IF NOT EXISTS replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (comment_id) REFERENCES comments(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Seed shop items
    const initialItems = [
        { name: 'Sports Car', category: 'vehicle', price: 500, image_url: 'https://i.postimg.cc/QdYFWggv/image-fx.png', description: 'A sleek virtual sports car for your profile.', is_limited: 0 },
        { name: 'Motorcycle', category: 'vehicle', price: 350, image_url: 'https://i.postimg.cc/m2bkXp80/image-fx-1.png', description: 'A cool virtual bike for cruising.', is_limited: 0 },
        { name: 'Skateboard', category: 'vehicle', price: 200, image_url: 'https://i.postimg.cc/Zqy5BG5y/image-fx-3.png', description: 'Shred in style with this virtual board.', is_limited: 0 },
        { name: 'Hoverboard', category: 'vehicle', price: 300, image_url: 'https://i.postimg.cc/RhvSYqQc/image-fx-4.png', description: 'Glide into the future.', is_limited: 0 },
        { name: 'Jetpack', category: 'vehicle', price: 800, image_url: 'https://i.postimg.cc/NGxfH7Bb/image-fx-5.png', description: 'Soar above the rest.', is_limited: 0 },
        { name: 'Vintage Van', category: 'vehicle', price: 450, image_url: 'https://i.postimg.cc/wjn6pwQx/image-fx-6.png', description: 'Retro vibes on wheels.', is_limited: 0 },
        { name: 'UFO', category: 'vehicle', price: 1000, image_url: 'https://i.postimg.cc/tgP9CFB3/image-fx-7.png', description: 'Out-of-this-world transport.', is_limited: 1, stock: 20 },
        { name: 'Bear', category: 'animal', price: 300, image_url: 'https://i.postimg.cc/653w4kH5/image-fx-8.png', description: 'A cuddly virtual bear companion.', is_limited: 0 },
        { name: 'Lion', category: 'animal', price: 400, image_url: 'https://i.postimg.cc/jdFTHM96/image-fx-9.png', description: 'A majestic virtual lion to show your strength.', is_limited: 0 },
        { name: 'Wolf', category: 'animal', price: 350, image_url: 'https://i.postimg.cc/qv6Tj8VP/image-fx-10.png', description: 'A fierce virtual wolf for your squad.', is_limited: 0 },
        { name: 'Panda', category: 'animal', price: 320, image_url: 'https://i.postimg.cc/vmWddbmX/image-fx-11.png', description: 'An adorable virtual panda.', is_limited: 0 },
        { name: 'Eagle', category: 'animal', price: 380, image_url: 'https://i.postimg.cc/pTCbpCzF/image-fx-12.png', description: 'A soaring virtual eagle.', is_limited: 0 },
        { name: 'Dragon', category: 'animal', price: 900, image_url: 'https://i.postimg.cc/nrSy1LdV/image-fx-13.png', description: 'A mythical virtual dragon.', is_limited: 1, stock: 15 },
        { name: 'Unicorn', category: 'animal', price: 600, image_url: 'https://i.postimg.cc/FFPXvP9t/image-fx-14.png', description: 'A magical unicorn for your squad.', is_limited: 0 },
        { name: 'Sneakers', category: 'fashion', price: 250, image_url: 'https://i.postimg.cc/9Fr5QGMD/image-fx-15.png', description: 'Fresh kicks for your avatar.', is_limited: 0 },
        { name: 'Hoodie', category: 'fashion', price: 280, image_url: 'https://i.postimg.cc/52Chwb81/image-fx-16.png', description: 'Cozy virtual style.', is_limited: 0 },
        { name: 'Sunglasses', category: 'fashion', price: 200, image_url: 'https://i.postimg.cc/Dz3t6HcG/image-fx-17.png', description: 'Cool shades for your vibe.', is_limited: 0 },
        { name: 'Crown', category: 'fashion', price: 450, image_url: 'https://i.postimg.cc/76mdx6r1/image-fx-18.png', description: 'Rule the platform with this crown.', is_limited: 0 },
        { name: 'Cape', category: 'fashion', price: 400, image_url: 'https://i.postimg.cc/d33XDYJb/image-fx-19.png', description: 'A heroic virtual cape.', is_limited: 0 },
        { name: 'Glow-in-the-Dark Jacket', category: 'fashion', price: 550, image_url: 'https://i.postimg.cc/x8ZZz4Cc/image-fx-20.png', description: 'Light up the night.', is_limited: 0 },
        { name: 'Headphones', category: 'accessory', price: 220, image_url: 'https://i.postimg.cc/tRvwwY5p/image-fx-21.png', description: 'Jam out in style.', is_limited: 0 },
        { name: 'Smartwatch', category: 'accessory', price: 260, image_url: 'https://i.postimg.cc/BQ8k04YD/image-fx-22.png', description: 'Stay connected virtually.', is_limited: 0 },
        { name: 'Neon Sword', category: 'accessory', price: 350, image_url: 'https://i.postimg.cc/vHpj8kkK/image-fx-23.png', description: 'A glowing blade for battles.', is_limited: 0 },
        { name: 'Magic Wand', category: 'accessory', price: 300, image_url: 'https://i.postimg.cc/g287x4P2/image-fx-24.png', description: 'Cast virtual spells.', is_limited: 0 },
        { name: 'Holographic Shield', category: 'accessory', price: 420, image_url: 'https://i.postimg.cc/KYbHBLZr/image-fx-25.png', description: 'Defend in style.', is_limited: 0 },
    ];

    initialItems.forEach(item => {
        db.run(
            `INSERT OR IGNORE INTO shop_items (name, category, price, image_url, description, is_limited, stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.name, item.category, item.price, item.image_url, item.description, item.is_limited, item.stock],
            (err) => {
                if (err) console.error(`Error seeding item ${item.name}:`, err);
            }
        );
    });

    // Add index for developer_picks
    db.run("CREATE INDEX IF NOT EXISTS idx_developer_picks_user ON developer_picks(user_id)");

    // Add indices for shop tables
    db.run("CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id ON user_inventory(item_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category)");

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
    db.run("CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_comment_replies_comment ON comment_replies(comment_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id)");

    // Add indices for chat tables
    db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)");

    // Add index for blocked_users
    db.run("CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON blocked_users(user_id)");

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
