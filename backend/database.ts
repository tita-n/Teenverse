import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error(`[${new Date().toISOString()}] Unexpected database error:`, err);
});

export const db = pool;

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] SQL Query: ${text} | Duration: ${duration}ms`);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | undefined> {
  const results = await query<T>(text, params);
  return results[0];
}

export async function execute(text: string, params?: any[]): Promise<{ lastID: number; changes: number }> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] SQL Execute: ${text} | Duration: ${duration}ms`);
  return {
    lastID: result.rows[0]?.id || 0,
    changes: result.rowCount || 0
  };
}

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return queryOne<T>(sql, params);
}

export async function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return query<T>(sql, params);
}

export async function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  const result = await execute(sql, params);
  const idResult = await queryOne<{ id: number }>("SELECT LASTVAL() as id");
  return {
    lastID: idResult?.id || 0,
    changes: result.changes
  };
}

export async function initializeDatabase(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Initializing PostgreSQL database...`);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      dob TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0 NOT NULL,
      coins INTEGER DEFAULT 0 NOT NULL,
      snitch_status TEXT,
      creator_badge TEXT DEFAULT '',
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS badges (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      news_king INTEGER DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      mode TEXT DEFAULT 'main',
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      media_url TEXT,
      media_type TEXT,
      reactions JSONB DEFAULT '{}'::jsonb
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      pinned INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comment_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS post_shares (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      squad_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_boosted INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user1_id, user2_id),
      CHECK(user1_id < user2_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      media_url TEXT,
      media_type TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_ghost_bomb INTEGER DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, blocked_user_id),
      CHECK(user_id != blocked_user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS game_squads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_name TEXT NOT NULL,
      uid TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      max_members INTEGER DEFAULT 5,
      wins INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS squad_members (
      squad_id INTEGER NOT NULL REFERENCES game_squads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (squad_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS squad_messages (
      id SERIAL PRIMARY KEY,
      squad_id INTEGER NOT NULL REFERENCES game_squads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS game_clips (
      id SERIAL PRIMARY KEY,
      squad_id INTEGER NOT NULL REFERENCES game_squads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      clip_url TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id SERIAL PRIMARY KEY,
      squad_id INTEGER NOT NULL REFERENCES game_squads(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      game_name TEXT,
      status TEXT DEFAULT 'open',
      winner_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tournament_participants (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      squad_id INTEGER NOT NULL REFERENCES game_squads(id) ON DELETE CASCADE,
      UNIQUE(tournament_id, squad_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (team_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS hype_battles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opponent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      opponent_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      content TEXT,
      media_url TEXT,
      votes INTEGER DEFAULT 0,
      opponent_votes INTEGER DEFAULT 0,
      is_live INTEGER DEFAULT 0,
      voting_deadline TIMESTAMP,
      winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed INTEGER DEFAULT 0,
      tournament_id INTEGER,
      opponent_media_url TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS battle_votes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      battle_id INTEGER NOT NULL REFERENCES hype_battles(id) ON DELETE CASCADE,
      vote_for TEXT NOT NULL,
      UNIQUE(user_id, battle_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_tournaments (
      id SERIAL PRIMARY KEY,
      season TEXT,
      status TEXT,
      start_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_participants (
      tournament_id INTEGER NOT NULL REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT,
      bracket_position INTEGER,
      PRIMARY KEY (tournament_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_votes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_option TEXT NOT NULL,
      UNIQUE(user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_schedule (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_clips (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      clip_url TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tournament_id, category)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_clip_votes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      clip_id INTEGER NOT NULL REFERENCES showdown_clips(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS showdown_boosts (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      battle_id INTEGER REFERENCES hype_battles(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coins_spent INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS coin_flip_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bet_amount INTEGER NOT NULL,
      won_amount INTEGER NOT NULL,
      result TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS profile_borders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      border_style TEXT NOT NULL,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tournament_id INTEGER NOT NULL REFERENCES showdown_tournaments(id) ON DELETE CASCADE,
      rank INTEGER,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS post_hall_of_fame (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      total_likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS developer_picks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS rants (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      upvotes INTEGER DEFAULT 0,
      reactions JSONB DEFAULT '{}'::jsonb,
      hugs INTEGER DEFAULT 0,
      ask_for_advice INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS rant_comments (
      id SERIAL PRIMARY KEY,
      rant_id INTEGER NOT NULL REFERENCES rants(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      description TEXT,
      is_limited INTEGER DEFAULT 0,
      stock INTEGER DEFAULT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_inventory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_mode ON posts(mode)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_mode_created ON posts(mode, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_replies_comment_id ON replies(comment_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_squad_messages_squad ON squad_messages(squad_id, created_at ASC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_game_clips_squad ON game_clips(squad_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_showdown_participants_tournament ON showdown_participants(tournament_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_showdown_participants_user ON showdown_participants(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_showdown_boosts_tournament ON showdown_boosts(tournament_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_hall_of_fame_user ON hall_of_fame(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_hype_battles_tournament ON hype_battles(tournament_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_hype_battles_user_closed ON hype_battles(user_id, closed)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_hype_battles_deadline ON hype_battles(voting_deadline, closed)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_showdown_clips_tournament ON showdown_clips(tournament_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_showdown_clip_votes_user ON showdown_clip_votes(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_battle_votes_user_battle ON battle_votes(user_id, battle_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rants_category ON rants(category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_rant_comments_rant ON rant_comments(rant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_post_hall_of_fame_user ON post_hall_of_fame(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_developer_picks_user ON developer_picks(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id ON user_inventory(item_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON blocked_users(user_id)`);

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

  for (const item of initialItems) {
    await query(
      `INSERT INTO shop_items (name, category, price, image_url, description, is_limited, stock) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [item.name, item.category, item.price, item.image_url, item.description, item.is_limited, item.stock || null]
    );
  }

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  
  await query(
    `INSERT INTO showdown_tournaments (season, status, start_date) 
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [`Season ${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`, "open", nextMonth.toISOString().split("T")[0]]
  );

  console.log(`[${new Date().toISOString()}] PostgreSQL database initialized successfully.`);
}

process.on("SIGINT", async () => {
  await pool.end();
  console.log(`[${new Date().toISOString()}] Database pool closed.`);
  process.exit(0);
});
