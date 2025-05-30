import sqlite3 from "sqlite3";
import path from "path";
import { backupDatabase, restoreDatabase } from "./backup";

// Initialize SQLite database
const dbPath = path.join(__dirname, "../users.db");
console.log(`[${new Date().toISOString()}] Database path: ${dbPath}`);

// Initialize db synchronously
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`[${new Date().toISOString()}] Error opening database:`, err.message);
  } else {
    console.log(`[${new Date().toISOString()}] Connected to SQLite database.`);
  }
});

// Log all SQL queries for debugging
db.on("trace", (sql) => {
  console.log(`[${new Date().toISOString()}] SQL Query: ${sql}`);
});

// Restore database once on startup
restoreDatabase().then(() => {
  console.log(`[${new Date().toISOString()}] Database restore completed`);
}).catch((err) => {
  console.error(`[${new Date().toISOString()}] Restore database error:`, err.message);
  console.log(`[${new Date().toISOString()}] Continuing with local users.db`);
});

// Periodic backup every 24 hours
setInterval(backupDatabase, 24 * 60 * 60 * 1000);
// First backup after 5 minutes
setTimeout(backupDatabase, 5 * 60 * 1000);

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
      bio TEXT,
      background_theme TEXT DEFAULT 'default',
      spending_restrictions BOOLEAN DEFAULT 0,
      auto_earn_uploads BOOLEAN DEFAULT 1,
      theme TEXT DEFAULT 'Neon Glow',
      animations_enabled BOOLEAN DEFAULT 1,
      font_size TEXT DEFAULT 'medium',
      language TEXT DEFAULT 'en',
      snitch_risk INTEGER DEFAULT 0,
      profile_media_url TEXT,
      profile_media_type TEXT
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating users table:`, err.message);
  });

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
      media_url TEXT,
      media_type TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating posts table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating likes table:`, err.message);
  });

  // Badges table
  db.run(`
    CREATE TABLE IF NOT EXISTS badges (
      user_id INTEGER PRIMARY KEY,
      news_king INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating badges table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating game_squads table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating squad_members table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating tournaments table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating tournament_participants table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating game_clips table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating squad_messages table:`, err.message);
  });

  // Teams table for Hype Battles
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      creator_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creator_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating teams table:`, err.message);
  });

  // Team Members table
  db.run(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER,
      user_id INTEGER,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (team_id, user_id),
      FOREIGN KEY(team_id) REFERENCES teams(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating team_members table:`, err.message);
  });

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
      opponent_media_url TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(opponent_id) REFERENCES users(id),
      FOREIGN KEY(team_id) REFERENCES teams(id),
      FOREIGN KEY(opponent_team_id) REFERENCES teams(id),
      FOREIGN KEY(winner_id) REFERENCES users(id),
      FOREIGN KEY(tournament_id) REFERENCES showdown_tournaments(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating hype_battles table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating battle_votes table:`, err.message);
  });

  // Showdown Votes table
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      date_option TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_votes table:`, err.message);
  });

  // Showdown Schedule table
  db.run(`
    CREATE TABLE IF NOT EXISTS showdown_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_schedule table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_clips table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_clip_votes table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating coin_flip_history table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_tournaments table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_participants table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating showdown_boosts table:`, err.message);
  });

  // Profile Borders table
  db.run(`
    CREATE TABLE IF NOT EXISTS profile_borders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      border_style TEXT,
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating profile_borders table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating hall_of_fame table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating post_hall_of_fame table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating developer_picks table:`, err.message);
  });

  // Rants table
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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating rants table:`, err.message);
  });

  // Rant Comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS rant_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rant_id INTEGER,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(rant_id) REFERENCES rants(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating rant_comments table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating shop_items table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating user_inventory table:`, err.message);
  });

  // Conversations table
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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating conversations table:`, err.message);
  });

  // Messages table
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
      FOREIGN KEY(conversation_id) REFERENCES conversations(id),
      FOREIGN KEY(sender_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating messages table:`, err.message);
  });

  // Blocked Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      blocked_user_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(blocked_user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating blocked_users table:`, err.message);
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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating post_comments table:`, err.message);
  });

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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating comment_replies table:`, err.message);
  });

  // Comment Likes table
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
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating comment_likes table:`, err.message);
  });

  // Post Shares table
  db.run(`
    CREATE TABLE IF NOT EXISTS post_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      user_id INTEGER,
      squad_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN_KEY(squad_id) REFERENCES game_squads(id)
    )
  `, (err) => {
    if (err) console.error(`[${new Date().toISOString()}] Error creating post_shares table:`, err.message);
  });

  // Comments table
  id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    likes INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) console.error(`[${new Date().toISOString()}] Error creating comments table:`, err.message);
});

// Replies table
db.run(`
  CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`, (err) => {
    console.error(`[${new Date().toISOString()}] Error creating replies table:`, err.message);
});

// Add reactions column to posts table
db.run(`
  ALTER TABLE posts ADD COLUMN reactions TEXT DEFAULT '{}'
`, (err) => {
  if (err && !err.message.includes("duplicate column")) {
    console.error(`[${new Date().toISOString()}] Error adding reactions column to posts:`, err.message);
  }
});

// Seed shop items
const initialItems = [
  { name: 'Sports Car', category: 'vehicle', price: 500, image_url: 'https://i.postimg.cc/QdYqFWggv/image.png', description: 'A sleek virtual sports car for your profile.', is_limited: 0 },
  { name: 'Motorcycle', category: 'vehicle', price: 350, image_url: 'https://i.postimg.cc/m2bkXp80/image.png', description: 'A cool virtual bike for your avatar.', is_limited: false },
  { name: 'Skateboard', category: 'vehicle', price: 200, image_url: 'https://i.postimg.cc/Zqy5BG5y/image.png', description: 'Shred in style with this virtual board.', is_limited: false },
  { name: 'Hoverboard', category: 'vehicle', price: 300, image_url: 'https://i.postimg.cc/Rhv8SYq/image.png', description: 'Glide into the future.', is_limited: false },
  { name: 'Jetpack', category: 'vehicle', price: 800, image_url: 'https://i.postimg.cc/NGxfH7Bb/image.png', description: 'Soar above the rest.', is_limited: false },
  { name: 'Vintage Van', category: 'vehicle', price: 450, image_url: 'https://i.postimg.cc/wjn6pw/image.png', description: 'Retro vibes on wheels.', is_limited: false },
  { name: 'UFO', category: 'vehicle', price: 1000, image_url: 'https://i.postimg.cc/tgP9CFB3/image.png', is_limited: true, stock: 20 },
  { name: 'Bear', category: 'animal', price: 300, image_url: 'https://i.postimg.cc/653w4kH5/image.png', description: 'A cuddly virtual bear companion.', is_limited: false },
  { name: 'Lion', category: 'animal', price: 400, image_url: 'https://i.postimg.cc/jdFTHM96/image.png', description: 'A majestic virtual lion to show your strength.', is_limited: false },
  { name: 'Wolf', category: 'animal', price: 350, image_url: 'https://i.postimg.cc/qv6Tj8VP/image.png', description: 'A fierce virtual wolf for your squad.', is_limited: false },
  { name: 'Panda', category: 'animal', price: 320, image_url: 'https://i.postimg.cc/vmWddbmX/image.png', description: 'An adorable virtual panda.', is_limited: false },
  { name: 'Eagle', category: 'animal', price: 380, image_url: 'https://i.postimg.cc/pTCbpCzF/image.png', description: 'A soaring virtual eagle.', is_limited: false },
  { name: 'Dragon', category: 'animal', price: 900, image_url: 'https://i.postimg.cc/nrSy1LdV/image.png', description: 'A mythical virtual dragon.', is_limited: true, stock: 15 },
  { name: 'Unicorn', category: 'animal', price: 600, image_url: 'https://i.postimg.cc/FFPXvP9t/image.png', description: 'A magical unicorn for your squad.', is_limited: false },
  { name: 'Sneakers', category: 'fashion', price: 250, image_url: 'https://i.postimg.cc/9Fr5QGMD/image.png', description: 'Fresh kicks for your avatar.', is_limited: false },
  { name: 'Hoodie', category: 'fashion', price: 280, image_url: 'https://i.postimg.cc/52Chwb81/image.png', description: 'Cozy virtual style.', is_limited: false },
  { name: 'Sunglasses', category: 'fashion', price: 200, image_url: 'https://i.postimg.cc/Dz3t6HcG/image.png', description: 'Cool shades for your vibe.', is_limited: false },
  { name: 'Crown', category: 'fashion', price: 450, image_url: 'https://i.postimg.cc/76mdx6r1/image.png', description: 'Rule the platform with this crown.', is_limited: false },
  { name: 'Cape', category: 'fashion', price: 400, image_url: 'https://i.postimg.cc/d33XDYJb/image.png', description: 'A heroic virtual cape.', is_limited: false },
  { name: 'Glow-in-the-Dark Jacket', category: 'fashion', price: 550, image_url: 'https://i.postimg.cc/x8ZZz4Cc/image.png', description: 'Light up the night.', is_limited: false },
  { name: 'Headphones', category: 'accessory', price: 220, image_url: 'https://i.postimg.cc/tRvwwY5p/image.png', description: 'Jam out in style.', is_limited: false },
  { name: 'Smartwatch', category: 'accessory', price: 260, image_url: 'https://i.postimg.cc/BQ8k04YD/image.png', description: 'Stay connected virtually.', is_limited: false },
  { name: 'Neon Sword', category: 'accessory', price: 350, image_url: 'https://i.postimg.cc/vHpj8kkK/image.png', description: 'A glowing blade for battles.', is_limited: false },
  { name: 'Magic Wand', category: 'accessory', price: 300, image_url: 'https://i.postimg.cc/g287x4P2/image.png', description: 'Cast virtual spells.', is_limited: false },
  { name: 'Holographic Shield', category: 'accessory', price: 420, image_url: 'https://i.postimg.cc/KYbHBLZr/image.png', description: 'Defend in style.', is_limited: false },
];

initialItems.forEach(item => {
  db.run(
    `INSERT OR IGNORE INTO shop_items (name, category, price, image_url, description, is_limited, stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [item.name, item.category, item.price, item.image_url, item.description, item.is_limited, item.stock],
    (err) => {
      if (err) console.error(`[${new Date().toISOString()}] Error seeding item ${item.name}:`, err.message);
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
      console.error(`[${new Date().toISOString()}] Error fetching user for creator badge:`, err.message);
      return;
    }
    if (user) {
      db.run(
        `UPDATE users SET creator_badge = 'Platform Creator' WHERE id = ?`,
        [user.id],
        (err) => {
          if (err) console.error(`[${new Date().toISOString()}] Error setting creator badge:`, err.message);
          else console.log(`[${new Date().toISOString()}] Creator badge set for restorationmichael3@gmail.com`);
        }
      );

      db.run(
        `INSERT OR IGNORE INTO developer_picks (user_id, title) VALUES (?, ?)`,
        [user.id, "PrimeArchitect"],
        (err) => {
          if (err) console.error(`[${new Date().toISOString()}] Error adding to developer_picks:`, err.message);
          else console.log(`[${new Date().toISOString()}] Added ${user.username} as PrimeArchitect to developer_picks`);
        }
      );
    } else {
      console.log(`[${new Date().toISOString()}] User with email restorationmichael3@gmail.com not found for creator setup`);
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
    if (err) console.error(`[${new Date().toISOString()}] Error initializing showdown tournament:`, err.message);
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