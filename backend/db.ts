import { Database } from "sqlite3";
import path from "path";

// Generic query helpers
export function dbGet<T = any>(db: Database, sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row as T | null);
        });
    });
}

export function dbAll<T = any>(db: Database, sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as T[]);
        });
    });
}

export function dbRun(db: Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

// ============ User Queries ============

export async function getUserById(db: Database, id: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM users WHERE id = ?", [id]);
}

export async function getUserByEmail(db: Database, email: string): Promise<any | null> {
    return dbGet(db, "SELECT * FROM users WHERE email = ?", [email]);
}

export async function getUserByUsername(db: Database, username: string): Promise<any | null> {
    return dbGet(db, "SELECT * FROM users WHERE username = ?", [username]);
}

export async function createUser(db: Database, data: { email: string; username: string; password: string; dob: string; role?: string }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO users (email, username, password, dob, verified, role) VALUES (?, ?, ?, ?, ?, ?)",
        [data.email, data.username, data.password, data.dob, 0, data.role || "user"]
    );
}

export async function updateUser(db: Database, id: number, updates: Record<string, any>): Promise<void> {
    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    const values = [...Object.values(updates), id];
    await dbRun(db, `UPDATE users SET ${fields} WHERE id = ?`, values);
}

export async function updateUserByEmail(db: Database, email: string, updates: Record<string, any>): Promise<void> {
    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    const values = [...Object.values(updates), email];
    await dbRun(db, `UPDATE users SET ${fields} WHERE email = ?`, values);
}

export async function getPublicUserProfile(db: Database, username: string): Promise<any | null> {
    return dbGet(
        db,
        "SELECT id, username, verified, coins, xp, profile_media_url, profile_media_type FROM users WHERE username = ?",
        [username]
    );
}

export async function getUserCount(db: Database): Promise<number> {
    const row = await dbGet<{ count: number }>(db, "SELECT COUNT(*) as count FROM users");
    return row?.count || 0;
}

export async function addXp(db: Database, userId: number, xp: number): Promise<void> {
    await dbRun(db, "UPDATE users SET xp = xp + ? WHERE id = ?", [xp, userId]);
}

export async function addCoins(db: Database, userId: number, coins: number): Promise<void> {
    await dbRun(db, "UPDATE users SET coins = coins + ? WHERE id = ?", [coins, userId]);
}

export async function subtractCoins(db: Database, userId: number, coins: number): Promise<void> {
    await dbRun(db, "UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?", [coins, userId, coins]);
}

export async function getCoins(db: Database, userId: number): Promise<number> {
    const row = await dbGet<{ coins: number }>(db, "SELECT coins FROM users WHERE id = ?", [userId]);
    return row?.coins || 0;
}

// ============ Post Queries ============

export async function getPostById(db: Database, postId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM posts WHERE id = ?", [postId]);
}

export async function getPosts(db: Database, limit: number = 10, offset: number = 0, excludeRants: boolean = false): Promise<any[]> {
    if (excludeRants) {
        return dbAll(
            db,
            "SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type FROM posts p JOIN users u ON p.user_id = u.id WHERE p.mode != 'rant' ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
    }
    return dbAll(
        db,
        "SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
    );
}

export async function getUserPosts(db: Database, userId: number): Promise<any[]> {
    return dbAll(db, "SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC", [userId]);
}

export async function createPost(db: Database, data: { userId: number; username: string; content: string; mode: string; mediaUrl?: string | null; mediaType?: string | null; squadId?: number | null }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO posts (user_id, username, content, mode, created_at, media_url, media_type, squad_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [data.userId, data.username, data.content, data.mode, new Date().toISOString(), data.mediaUrl || null, data.mediaType || null, data.squadId || null]
    );
}

export async function updatePost(db: Database, postId: number, content: string): Promise<void> {
    await dbRun(db, "UPDATE posts SET content = ? WHERE id = ?", [content, postId]);
}

export async function deletePost(db: Database, postId: number): Promise<void> {
    await dbRun(db, "DELETE FROM posts WHERE id = ?", [postId]);
}

export async function incrementPostLikes(db: Database, postId: number): Promise<void> {
    await dbRun(db, "UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId]);
}

export async function getPostCount(db: Database): Promise<number> {
    const row = await dbGet<{ count: number }>(db, "SELECT COUNT(*) as count FROM posts");
    return row?.count || 0;
}

// ============ Comment Queries ============

export async function getCommentsForPost(db: Database, postId: number): Promise<any[]> {
    const comments = await dbAll(
        db,
        "SELECT c.*, u.username, u.profile_media_url, u.profile_media_type FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC",
        [postId]
    );

    for (const comment of comments) {
        comment.replies = await dbAll(
            db,
            "SELECT r.*, u.username, u.profile_media_url, u.profile_media_type FROM replies r JOIN users u ON r.user_id = u.id WHERE r.comment_id = ? ORDER BY r.created_at ASC",
            [comment.id]
        );
    }

    return comments;
}

export async function createComment(db: Database, data: { postId: number; userId: number; content: string }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
        [data.postId, data.userId, data.content, new Date().toISOString()]
    );
}

export async function addReply(db: Database, data: { commentId: number; userId: number; content: string }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO replies (comment_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
        [data.commentId, data.userId, data.content, new Date().toISOString()]
    );
}

export async function incrementCommentLikes(db: Database, commentId: number): Promise<void> {
    await dbRun(db, "UPDATE comments SET likes = likes + 1 WHERE id = ?", [commentId]);
}

export async function unpinAllComments(db: Database, postId: number): Promise<void> {
    await dbRun(db, "UPDATE comments SET pinned = 0 WHERE post_id = ?", [postId]);
}

export async function pinComment(db: Database, commentId: number): Promise<void> {
    await dbRun(db, "UPDATE comments SET pinned = 1 WHERE id = ?", [commentId]);
}

export async function sharePost(db: Database, data: { postId: number; userId: number; squadId: number; content: string; mode: string; mediaUrl?: string | null; mediaType?: string | null }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO posts (user_id, content, mode, created_at, squad_id, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [data.userId, data.content, data.mode, new Date().toISOString(), data.squadId, data.mediaUrl || null, data.mediaType || null]
    );
}

// ============ Like Queries ============

export async function hasUserLikedPost(db: Database, postId: number, userId: number): Promise<boolean> {
    const like = await dbGet(db, "SELECT id FROM likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
    return !!like;
}

export async function addLike(db: Database, postId: number, userId: number): Promise<void> {
    await dbRun(db, "INSERT INTO likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
    await incrementPostLikes(db, postId);
}

export async function getTotalUserLikes(db: Database, userId: number): Promise<number> {
    const row = await dbGet<{ total: number }>(db, "SELECT SUM(likes) as total FROM posts WHERE user_id = ?", [userId]);
    return row?.total || 0;
}

// ============ Rant Queries ============

export async function getRants(db: Database, category?: string): Promise<any[]> {
    let query = "SELECT * FROM rants";
    const params: any[] = [];

    if (category) {
        query += " WHERE category = ?";
        params.push(category);
    }

    query += " ORDER BY created_at DESC";

    const rants = await dbAll(db, query, params);

    for (const rant of rants) {
        rant.comments = await dbAll(
            db,
            "SELECT * FROM rant_comments WHERE rant_id = ? ORDER BY created_at ASC",
            [rant.id]
        );
    }

    return rants;
}

export async function createRant(db: Database, data: { content: string; category: string; askForAdvice: boolean }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO rants (content, category, ask_for_advice) VALUES (?, ?, ?)",
        [data.content, data.category, data.askForAdvice ? 1 : 0]
    );
}

export async function incrementRantUpvotes(db: Database, rantId: number): Promise<void> {
    await dbRun(db, "UPDATE rants SET upvotes = upvotes + 1 WHERE id = ?", [rantId]);
}

export async function addRantReaction(db: Database, rantId: number, reaction: string, currentReactions: string): Promise<void> {
    let reactions: Record<string, number> = {};
    try {
        reactions = JSON.parse(currentReactions || "{}");
    } catch {
        reactions = {};
    }
    reactions[reaction] = (reactions[reaction] || 0) + 1;
    await dbRun(db, "UPDATE rants SET reactions = ? WHERE id = ?", [JSON.stringify(reactions), rantId]);
}

export async function incrementRantHugs(db: Database, rantId: number): Promise<void> {
    await dbRun(db, "UPDATE rants SET hugs = hugs + 1 WHERE id = ?", [rantId]);
}

export async function createRantComment(db: Database, data: { rantId: number; content: string }): Promise<void> {
    await dbRun(db, "INSERT INTO rant_comments (rant_id, content) VALUES (?, ?)", [data.rantId, data.content]);
}

// ============ Game Squad Queries ============

export async function getGameSquads(db: Database): Promise<any[]> {
    return dbAll(
        db,
        "SELECT g.*, u.username as actual_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.is_featured DESC, g.created_at DESC"
    );
}

export async function getSquadById(db: Database, squadId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM game_squads WHERE id = ?", [squadId]);
}

export async function createGameSquad(db: Database, data: { userId: number; username: string; gameName: string; uid: string; description: string }): Promise<{ id: number }> {
    const result = await dbRun(
        db,
        "INSERT INTO game_squads (user_id, username, game_name, uid, description, status, max_members, wins, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [data.userId, data.username, data.gameName, data.uid, data.description, "open", 5, 0, new Date()]
    );
    await dbRun(
        db,
        "INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)",
        [result.lastID, data.userId, new Date()]
    );
    return { id: result.lastID };
}

export async function getSquadMemberCount(db: Database, squadId: number): Promise<number> {
    const row = await dbGet<{ count: number }>(db, "SELECT COUNT(*) as count FROM squad_members WHERE squad_id = ?", [squadId]);
    return row?.count || 0;
}

export async function isSquadMember(db: Database, squadId: number, userId: number): Promise<boolean> {
    const row = await dbGet(db, "SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?", [squadId, userId]);
    return !!row;
}

export async function addSquadMember(db: Database, squadId: number, userId: number): Promise<void> {
    await dbRun(db, "INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)", [squadId, userId, new Date()]);
}

export async function updateSquadStatus(db: Database, squadId: number, status: "open" | "closed"): Promise<void> {
    await dbRun(db, "UPDATE game_squads SET status = ? WHERE id = ?", [status, squadId]);
}

export async function featureSquad(db: Database, squadId: number, featured: boolean): Promise<void> {
    await dbRun(db, "UPDATE game_squads SET is_featured = ? WHERE id = ?", [featured ? 1 : 0, squadId]);
}

export async function incrementSquadWins(db: Database, squadId: number): Promise<void> {
    await dbRun(db, "UPDATE game_squads SET wins = wins + 1 WHERE id = ?", [squadId]);
}

export async function getSquadLeaderboard(db: Database): Promise<any[]> {
    return dbAll(
        db,
        "SELECT g.*, u.username as creator_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.wins DESC LIMIT 10"
    );
}

export async function getSquadCount(db: Database): Promise<number> {
    const row = await dbGet<{ count: number }>(db, "SELECT COUNT(*) as count FROM game_squads");
    return row?.count || 0;
}

export async function getPopularGames(db: Database): Promise<any[]> {
    return dbAll(db, "SELECT game_name, COUNT(*) as count FROM game_squads GROUP BY game_name ORDER BY count DESC LIMIT 5");
}

// ============ Squad Messages ============

export async function getSquadMessages(db: Database, squadId: number): Promise<any[]> {
    return dbAll(
        db,
        "SELECT sm.*, u.username FROM squad_messages sm JOIN users u ON sm.user_id = u.id WHERE sm.squad_id = ? ORDER BY sm.created_at ASC",
        [squadId]
    );
}

export async function createSquadMessage(db: Database, squadId: number, userId: number, message: string): Promise<void> {
    await dbRun(db, "INSERT INTO squad_messages (squad_id, user_id, message) VALUES (?, ?, ?)", [squadId, userId, message]);
}

// ============ Game Clips ============

export async function getGameClips(db: Database, squadId: number): Promise<any[]> {
    return dbAll(
        db,
        "SELECT gc.*, u.username FROM game_clips gc JOIN users u ON gc.user_id = u.id WHERE gc.squad_id = ? ORDER BY gc.created_at DESC",
        [squadId]
    );
}

export async function createGameClip(db: Database, data: { squadId: number; userId: number; clipUrl: string; description: string }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO game_clips (squad_id, user_id, clip_url, description) VALUES (?, ?, ?, ?)",
        [data.squadId, data.userId, data.clipUrl, data.description]
    );
}

// ============ Team Queries ============

export async function getTeams(db: Database): Promise<any[]> {
    return dbAll(db, "SELECT t.*, u.username as creator_username FROM teams t JOIN users u ON t.creator_id = u.id");
}

export async function createTeam(db: Database, name: string, creatorId: number): Promise<{ id: number }> {
    const result = await dbRun(db, "INSERT INTO teams (name, creator_id) VALUES (?, ?)", [name, creatorId]);
    await dbRun(db, "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)", [result.lastID, creatorId]);
    return { id: result.lastID };
}

export async function isTeamMember(db: Database, teamId: number, userId: number): Promise<boolean> {
    const row = await dbGet(db, "SELECT team_id FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);
    return !!row;
}

export async function addTeamMember(db: Database, teamId: number, userId: number): Promise<void> {
    await dbRun(db, "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)", [teamId, userId]);
}

export async function getTeamById(db: Database, teamId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM teams WHERE id = ?", [teamId]);
}

// ============ Hype Battle Queries ============

export async function getHypeBattles(db: Database, filters: { category?: string; isLive?: boolean }): Promise<any[]> {
    let query = "SELECT h.*, u.username as actual_username FROM hype_battles h JOIN users u ON h.user_id = u.id WHERE h.closed = 0";
    const params: any[] = [];

    if (filters.category) {
        query += " AND h.category = ?";
        params.push(filters.category);
    }
    if (filters.isLive !== undefined) {
        query += " AND h.is_live = ?";
        params.push(filters.isLive ? 1 : 0);
    }

    query += " ORDER BY h.created_at DESC";
    return dbAll(db, query, params);
}

export async function getBattleById(db: Database, battleId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM hype_battles WHERE id = ?", [battleId]);
}

export async function createBattle(db: Database, data: {
    userId: number;
    username: string;
    opponentId: number | null;
    teamId: number | null;
    opponentTeamId: number | null;
    category: string;
    content: string;
    mediaUrl: string | null;
    isLive: boolean;
    votingDeadline: string;
}): Promise<{ id: number }> {
    const result = await dbRun(
        db,
        "INSERT INTO hype_battles (user_id, username, opponent_id, team_id, opponent_team_id, category, content, media_url, is_live, voting_deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [data.userId, data.username, data.opponentId, data.teamId, data.opponentTeamId, data.category, data.content, data.mediaUrl, data.isLive ? 1 : 0, data.votingDeadline]
    );
    return { id: result.lastID };
}

export async function respondToBattle(db: Database, battleId: number, content: string, mediaUrl: string | null): Promise<void> {
    await dbRun(db, "UPDATE hype_battles SET content = ?, opponent_media_url = ? WHERE id = ?", [content, mediaUrl, battleId]);
}

export async function incrementBattleVotes(db: Database, battleId: number, field: "votes" | "opponent_votes"): Promise<void> {
    await dbRun(db, `UPDATE hype_battles SET ${field} = ${field} + 1 WHERE id = ?`, [battleId]);
}

export async function closeBattle(db: Database, battleId: number, winnerId: number | null): Promise<void> {
    await dbRun(db, "UPDATE hype_battles SET closed = 1, winner_id = ? WHERE id = ?", [winnerId, battleId]);
}

export async function getExpiredBattles(db: Database): Promise<any[]> {
    return dbAll(
        db,
        "SELECT id, user_id, opponent_id, team_id, opponent_team_id, votes, opponent_votes, category FROM hype_battles WHERE voting_deadline < DATETIME('now') AND closed = 0"
    );
}

export async function getBattleWins(db: Database, userId: number): Promise<number> {
    const row = await dbGet<{ wins: number }>(db, "SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1", [userId]);
    return row?.wins || 0;
}

// ============ Voting Queries ============

export async function hasVotedForBattle(db: Database, userId: number, battleId: number): Promise<boolean> {
    const row = await dbGet(db, "SELECT id FROM battle_votes WHERE user_id = ? AND battle_id = ?", [userId, battleId]);
    return !!row;
}

export async function castBattleVote(db: Database, userId: number, battleId: number, voteFor: string): Promise<void> {
    await dbRun(db, "INSERT INTO battle_votes (user_id, battle_id, vote_for) VALUES (?, ?, ?)", [userId, battleId, voteFor]);
}

export async function hasVotedForShowdown(db: Database, userId: number): Promise<boolean> {
    const row = await dbGet(db, "SELECT id FROM showdown_votes WHERE user_id = ?", [userId]);
    return !!row;
}

export async function castShowdownVote(db: Database, userId: number, dateOption: string): Promise<void> {
    await dbRun(db, "INSERT INTO showdown_votes (user_id, date_option) VALUES (?, ?)", [userId, dateOption]);
}

// ============ Tournament Queries ============

export async function getTournaments(db: Database): Promise<any[]> {
    const tournaments = await dbAll(
        db,
        "SELECT t.*, g.game_name as squad_game_name, g.username as creator_username FROM tournaments t JOIN game_squads g ON t.squad_id = g.id ORDER BY t.created_at DESC"
    );

    for (const tournament of tournaments) {
        tournament.participants = await dbAll(
            db,
            "SELECT g.id, g.game_name, g.username FROM tournament_participants tp JOIN game_squads g ON tp.squad_id = g.id WHERE tp.tournament_id = ?",
            [tournament.id]
        );
    }

    return tournaments;
}

export async function createTournament(db: Database, data: { squadId: number; title: string; description: string; gameName: string }): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO tournaments (squad_id, title, description, game_name) VALUES (?, ?, ?, ?)",
        [data.squadId, data.title, data.description, data.gameName]
    );
}

export async function updateTournament(db: Database, tournamentId: number, updates: Record<string, any>): Promise<void> {
    const fields = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    await dbRun(db, `UPDATE tournaments SET ${fields} WHERE id = ?`, [...Object.values(updates), tournamentId]);
}

export async function joinTournament(db: Database, tournamentId: number, squadId: number): Promise<void> {
    await dbRun(db, "INSERT INTO tournament_participants (tournament_id, squad_id) VALUES (?, ?)", [tournamentId, squadId]);
}

export async function hasJoinedTournament(db: Database, tournamentId: number, squadId: number): Promise<boolean> {
    const row = await dbGet(db, "SELECT id FROM tournament_participants WHERE tournament_id = ? AND squad_id = ?", [tournamentId, squadId]);
    return !!row;
}

// ============ Showdown Queries ============

export async function getCurrentShowdownTournament(db: Database): Promise<any | null> {
    return dbGet(db, "SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
}

export async function addShowdownParticipant(db: Database, tournamentId: number, userId: number, status: string): Promise<void> {
    await dbRun(db, "INSERT INTO showdown_participants (tournament_id, user_id, status) VALUES (?, ?, ?)", [tournamentId, userId, status]);
}

export async function getShowdownParticipant(db: Database, tournamentId: number, userId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ?", [tournamentId, userId]);
}

export async function getShowdownBracket(db: Database, tournamentId: number): Promise<any[]> {
    return dbAll(
        db,
        "SELECT sp.*, u.username FROM showdown_participants sp JOIN users u ON sp.user_id = u.id WHERE sp.tournament_id = ? AND sp.status = 'active'",
        [tournamentId]
    );
}

// ============ Shop Queries ============

export async function getShopItems(db: Database, category?: string): Promise<any[]> {
    if (category && category !== "all") {
        return dbAll(db, "SELECT * FROM shop_items WHERE category = ?", [category]);
    }
    return dbAll(db, "SELECT * FROM shop_items");
}

export async function getShopItemById(db: Database, itemId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM shop_items WHERE id = ?", [itemId]);
}

export async function purchaseItem(db: Database, userId: number, itemId: number): Promise<void> {
    await dbRun(db, "INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)", [userId, itemId]);
}

export async function decrementStock(db: Database, itemId: number): Promise<void> {
    await dbRun(db, "UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock IS NOT NULL", [itemId]);
}

// ============ DM/Conversation Queries ============

export async function getConversations(db: Database, userId: number): Promise<any[]> {
    return dbAll(
        db,
        `SELECT c.*, 
                CASE 
                    WHEN c.user1_id = ? THEN u2.username 
                    WHEN c.user2_id = ? THEN u1.username 
                END as other_username
        FROM conversations c
        LEFT JOIN users u1 ON c.user1_id = u1.id
        LEFT JOIN users u2 ON c.user2_id = u2.id
        WHERE c.user1_id = ? OR c.user2_id = ?
        ORDER BY c.is_boosted DESC, c.created_at DESC`,
        [userId, userId, userId, userId]
    );
}

export async function getConversation(db: Database, conversationId: number, userId: number): Promise<any | null> {
    return dbGet(db, "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)", [conversationId, userId, userId]);
}

export async function findConversation(db: Database, userId1: number, userId2: number): Promise<any | null> {
    return dbGet(
        db,
        "SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [userId1, userId2, userId2, userId1]
    );
}

export async function createConversation(db: Database, userId1: number, userId2: number): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO conversations (user1_id, user2_id, created_at, is_boosted) VALUES (?, ?, ?, ?)",
        [userId1, userId2, new Date().toISOString(), 0]
    );
}

export async function getMessages(db: Database, conversationId: number): Promise<any[]> {
    return dbAll(
        db,
        "SELECT m.*, u.username as sender_username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = ? ORDER BY m.created_at ASC",
        [conversationId]
    );
}

export async function getLatestMessage(db: Database, conversationId: number): Promise<any | null> {
    return dbGet(db, "SELECT content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1", [conversationId]);
}

export async function createMessage(db: Database, data: {
    conversationId: number;
    senderId: number;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    isGhostBomb?: boolean;
}): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, created_at, is_ghost_bomb) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [data.conversationId, data.senderId, data.content, data.mediaUrl || null, data.mediaType || null, new Date().toISOString(), data.isGhostBomb ? 1 : 0]
    );
}

export async function boostConversation(db: Database, conversationId: number): Promise<void> {
    await dbRun(db, "UPDATE conversations SET is_boosted = 1 WHERE id = ?", [conversationId]);
}

// ============ Privacy/Block Queries ============

export async function getBlockList(db: Database, userId: number): Promise<any[]> {
    return dbAll(
        db,
        `SELECT u.username, u.id as blocked_user_id FROM blocked_users b JOIN users u ON b.blocked_user_id = u.id WHERE b.user_id = ?`,
        [userId]
    );
}

export async function isBlocked(db: Database, userId: number, blockedUserId: number): Promise<boolean> {
    const row = await dbGet(db, "SELECT * FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?", [userId, blockedUserId]);
    return !!row;
}

export async function blockUser(db: Database, userId: number, blockedUserId: number): Promise<void> {
    await dbRun(db, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)", [userId, blockedUserId]);
}

export async function unblockUser(db: Database, userId: number, blockedUserId: number): Promise<void> {
    await dbRun(db, "DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?", [userId, blockedUserId]);
}

// ============ Snitch Status ============

export async function getAllUsers(db: Database): Promise<any[]> {
    return dbAll(db, "SELECT id, xp FROM users");
}

export async function getWeeklyXP(db: Database, userId: number): Promise<number> {
    const row = await dbGet<{ weekly_xp: number }>(
        db,
        "SELECT SUM(xp) as weekly_xp FROM posts WHERE user_id = ? AND created_at >= datetime('now', '-7 days')",
        [userId]
    );
    return row?.weekly_xp || 0;
}

export async function updateSnitchStatus(db: Database, userId: number, status: string): Promise<void> {
    await dbRun(db, "UPDATE users SET snitch_status = ? WHERE id = ?", [status, userId]);
}

// ============ Badges ============

export async function setNewsKingBadge(db: Database, userId: number): Promise<void> {
    await dbRun(
        db,
        "INSERT INTO badges (user_id, news_king) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET news_king = 1",
        [userId]
    );
}

// ============ Developer Picks ============

export async function setDeveloperPick(db: Database, userId: number, title: string): Promise<void> {
    await dbRun(db, "INSERT OR IGNORE INTO developer_picks (user_id, title) VALUES (?, ?)", [userId, title]);
}

// ============ Analytics ============

export async function getAnalytics(db: Database): Promise<{ totalUsers: number; totalSquads: number; totalPosts: number; popularGames: any[] }> {
    const [totalUsers, totalSquads, totalPosts, popularGames] = await Promise.all([
        getUserCount(db),
        getSquadCount(db),
        getPostCount(db),
        getPopularGames(db),
    ]);

    return { totalUsers, totalSquads, totalPosts, popularGames };
}

// ============ Cleanup ============

export async function cleanupExpiredUndercoverPosts(db: Database): Promise<void> {
    await dbRun(db, `
        DELETE FROM posts 
        WHERE mode = 'undercover' 
        AND likes < 50 
        AND created_at < DATETIME('now', '-1 day')
    `);
}

export async function clearAllUsers(db: Database): Promise<void> {
    await dbRun(db, "DELETE FROM users");
}
