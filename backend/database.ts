import sqlite3 from "sqlite3";
import path from "path";
import { backupDatabase, restoreDatabase } from "./backup";

const dbPath = path.join(__dirname, "../users.db");
console.log(`[${new Date().toISOString()}] Database path: ${dbPath}`);

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`[${new Date().toISOString()}] Error opening database:`, err.message);
  } else {
    console.log(`[${new Date().toISOString()}] Connected to SQLite database.`);
  }
});

db.on("trace", (sql) => {
  console.log(`[${new Date().toISOString()}] SQL Query: ${sql}`);
});

restoreDatabase().then(() => {
  console.log(`[${new Date().toISOString()}] Database restore completed`);
}).catch((err) => {
  console.error(`[${new Date().toISOString()}] Restore database error:`, err.message);
  console.log(`[${new Date().toISOString()}] Continuing with local users.db`);
});

setInterval(backupDatabase, 24 * 60 * 60 * 1000);
setTimeout(backupDatabase, 5 * 60 * 1000);

// ==================== Transaction Helpers ====================

export function beginTransaction(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run("BEGIN IMMEDIATE", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function commitTransaction(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run("COMMIT", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function rollbackTransaction(): Promise<void> {
  return new Promise((resolve) => {
    db.run("ROLLBACK", () => resolve());
  });
}

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await beginTransaction();
  try {
    const result = await fn();
    await commitTransaction();
    return result;
  } catch (err) {
    await rollbackTransaction();
    throw err;
  }
}

// ==================== Query Helpers ====================

export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function dbRun(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// ==================== Schema Creation ====================

db.serialize(() => {
  // ===== Performance Pragmas =====
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA cache_size = -32000");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA busy_timeout = 5000");

  // ===== Users Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      dob TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0 NOT NULL,
      coins INTEGER DEFAULT 0 NOT NULL,
      snitch_status TEXT,
      creator_badge INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      tier INTEGER DEFAULT 1 NOT NULL,
      wins INTEGER DEFAULT 0 NOT NULL,
      losses INTEGER DEFAULT 0 NOT NULL,
      title TEXT,
      legend_status TEXT DEFAULT '',
      bio TEXT,
      background_theme TEXT DEFAULT 'default',
      spending_restrictions INTEGER DEFAULT 0,
      auto_earn_uploads INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'Neon Glow',
      animations_enabled INTEGER DEFAULT 1,
      font_size TEXT DEFAULT 'medium',
      language TEXT DEFAULT 'en',
      snitch_risk INTEGER DEFAULT 0,
      profile_media_url TEXT,
      profile_media_type TEXT,
      last_login TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ===== Badges Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS badges (
      user_id INTEGER PRIMARY KEY NOT NULL,
      news_king INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Posts Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT,
      mode TEXT DEFAULT 'main',
      likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      media_url TEXT,
      media_type TEXT,
      reactions TEXT DEFAULT '{}',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Likes Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    )
  `);

  // ===== Comments Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      pinned INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Replies Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Comment Likes Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(comment_id, user_id)
    )
  `);

  // ===== Post Shares Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS post_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      squad_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(squad_id) REFERENCES game_squads(id) ON DELETE CASCADE
    )
  `);

  // ===== Conversations Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1_id INTEGER NOT NULL,
      user2_id INTEGER NOT NULL,
      is_boosted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(user2_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user1_id, user2_id),
      CHECK(user1_id < user2_id)
    )
  `);

  // ===== Messages Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      media_url TEXT,
      media_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_ghost_bomb INTEGER DEFAULT 0,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Blocked Users Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      blocked_user_id INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, blocked_user_id),
      CHECK(user_id != blocked_user_id)
    )
  `);

  // ===== Game Squads Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS game_squads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      uid TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      max_members INTEGER DEFAULT 5,
      wins INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Squad Members Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS squad_members (
      squad_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (squad_id, user_id),
      FOREIGN KEY(squad_id) REFERENCES game_squads(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Squad Messages Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS squad_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(squad_id) REFERENCES game_squads(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Game Clips Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS game_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      clip_url TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(squad_id) REFERENCES game_squads(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Tournaments Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squad_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      game_name TEXT,
      status TEXT DEFAULT 'open',
      winner_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(squad_id) REFERENCES game_squads(id) ON DELETE CASCADE,
      FOREIGN KEY(winner_id) REFERENCES game_squads(id) ON DELETE SET NULL
    )
  `);

  // ===== Tournament Participants Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS tournament_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      squad_id INTEGER NOT NULL,
      FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY(squad_id) REFERENCES game_squads(id) ON DELETE CASCADE,
      UNIQUE(tournament_id, squad_id)
    )
  `);

  // ===== Teams Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Team Members Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (team_id, user_id),
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Hype Battles Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS hype_battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opponent_id INTEGER,
      team_id INTEGER,
      opponent_team_id INTEGER,
      category TEXT NOT NULL,
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
      opponent_media_url TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(opponent_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE SET NULL,
      FOREIGN KEY(opponent_team_id) REFERENCES teams(id) ON DELETE SET NULL,
      FOREIGN KEY(winner_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id) ON DELETE SET NULL
    )
  `);

  // ===== Battle Votes Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS battle_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      battle_id INTEGER NOT NULL,
      vote_for TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(battle_id) REFERENCES hype_battles(id) ON DELETE CASCADE,
      UNIQUE(user_id, battle_id)
    )
  `);

  // ===== Showdown Tournaments Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season TEXT,
      status TEXT,
      start_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      winner_id INTEGER,
      FOREIGN KEY(winner_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // ===== Showdown Participants Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_participants (
      tournament_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT,
      bracket_position INTEGER,
      FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (tournament_id, user_id)
    )
  `);

  // ===== Showdown Votes Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date_option TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `);

  // ===== Showdown Schedule Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ===== Showdown Clips Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      clip_url TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, tournament_id, category)
    )
  `);

  // ===== Showdown Clip Votes Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_clip_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clip_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(clip_id) REFERENCES showdown_clips(id) ON DELETE CASCADE,
      UNIQUE(user_id, category)
    )
  `);

  // ===== Showdown Boosts Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_boosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      battle_id INTEGER,
      user_id INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      coins_spent INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY(battle_id) REFERENCES hype_battles(id) ON DELETE SET NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Coin Flip History Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS coin_flip_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bet_amount INTEGER NOT NULL,
      won_amount INTEGER NOT NULL,
      result TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Profile Borders Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS profile_borders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      border_style TEXT NOT NULL,
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ===== Hall of Fame Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      rank INTEGER,
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id) ON DELETE CASCADE
    )
  `);

  // ===== Post Hall of Fame Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS post_hall_of_fame (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      total_likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `);

  // ===== Developer Picks Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS developer_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `);

  // ===== Rants Table =====
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

  // ===== Rant Comments Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS rant_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rant_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(rant_id) REFERENCES rants(id) ON DELETE CASCADE
    )
  `);

  // ===== Shop Items Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      description TEXT,
      is_limited INTEGER DEFAULT 0,
      stock INTEGER DEFAULT NULL
    )
  `);

  // ===== User Inventory Table =====
  db.run(`
    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES shop_items(id) ON DELETE CASCADE
    )
  `);

  // ===== Performance Indexes =====

  // Core user lookups
  db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
  db.run("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)");

  // Posts indexes - critical for feed queries
  db.run("CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_posts_mode ON posts(mode)");
  db.run("CREATE INDEX IF NOT EXISTS idx_posts_mode_created ON posts(mode, created_at DESC)");
  db.run("CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC)");

  // Comments indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC)");
  db.run("CREATE INDEX IF NOT EXISTS idx_replies_comment_id ON replies(comment_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)");

  // Like indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)");

  // DM indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC)");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)");

  // Squad indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_squad_messages_squad ON squad_messages(squad_id, created_at ASC)");
  db.run("CREATE INDEX IF NOT EXISTS idx_game_clips_squad ON game_clips(squad_id, created_at DESC)");
  db.run("CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id)");

  // Showdown/tournament indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_showdown_participants_tournament ON showdown_participants(tournament_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_showdown_participants_user ON showdown_participants(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_showdown_boosts_tournament ON showdown_boosts(tournament_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_hall_of_fame_user ON hall_of_fame(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_hype_battles_tournament ON hype_battles(tournament_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_hype_battles_user_closed ON hype_battles(user_id, closed)");
  db.run("CREATE INDEX IF NOT EXISTS idx_hype_battles_deadline ON hype_battles(voting_deadline, closed)");
  db.run("CREATE INDEX IF NOT EXISTS idx_showdown_clips_tournament ON showdown_clips(tournament_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_showdown_clip_votes_user ON showdown_clip_votes(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_battle_votes_user_battle ON battle_votes(user_id, battle_id)");

  // Rant indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_rants_category ON rants(category)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rant_comments_rant ON rant_comments(rant_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_post_hall_of_fame_user ON post_hall_of_fame(user_id)");

  // Shop indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_developer_picks_user ON developer_picks(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id ON user_inventory(item_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category)");

  // Blocked users
  db.run("CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON blocked_users(user_id)");

  // ===== Seed Shop Items =====
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
        if (err) console.error(`[${new Date().toISOString()}] Error seeding item ${item.name}:`, err);
      }
    );
  });

  // ===== Creator Badge Setup =====
  const creatorEmail = process.env.ADMIN_EMAIL || 'restorationmichael3@gmail.com';
  db.get(
    "SELECT id, username FROM users WHERE email = ?",
    [creatorEmail],
    (err, user: any) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] Error fetching user for creator badge:`, err);
        return;
      }
      if (user) {
        db.run(
          `UPDATE users SET creator_badge = 'Platform Creator', is_admin = 1 WHERE id = ?`,
          [user.id],
          (err) => {
            if (err) console.error(`[${new Date().toISOString()}] Error setting creator badge:`, err);
            else console.log(`[${new Date().toISOString()}] Creator badge and admin set for ${creatorEmail}`);
          }
        );

        db.run(
          `INSERT OR IGNORE INTO developer_picks (user_id, title) VALUES (?, ?)`,
          [user.id, "PrimeArchitect"],
          (err) => {
            if (err) console.error(`[${new Date().toISOString()}] Error adding to developer_picks:`, err);
            else console.log(`[${new Date().toISOString()}] Added ${user.username} as PrimeArchitect to developer_picks`);
          }
        );
      }
    }
  );

  // ===== Initial Showdown Tournament =====
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  db.run(
    "INSERT OR IGNORE INTO showdown_tournaments (season, status, start_date) VALUES (?, ?, ?)",
    [`Season ${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`, "open", nextMonth.toISOString().split("T")[0]],
    (err) => {
      if (err) console.error(`[${new Date().toISOString()}] Error initializing showdown tournament:`, err);
    }
  );
});

// Close database and backup on process exit
process.on("SIGINT", async () => {
  await backupDatabase();
  db.close((err) => {
    if (err) {
      console.error(`[${new Date().toISOString()}] Error closing database:`, err.message);
    }
    console.log(`[${new Date().toISOString()}] Database connection closed.`);
    process.exit(0);
  });
});
