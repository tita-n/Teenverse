import { query, queryOne, execute } from "./database";

export async function getUserById(id: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM users WHERE id = $1", [id]);
}

export async function getUserByEmail(email: string): Promise<any | undefined> {
    return queryOne("SELECT * FROM users WHERE email = $1", [email]);
}

export async function getUserByUsername(username: string): Promise<any | undefined> {
    return queryOne("SELECT * FROM users WHERE username = $1", [username]);
}

export async function createUser(data: { email: string; username: string; password: string; dob: string; role?: string }): Promise<void> {
    await execute(
        "INSERT INTO users (email, username, password, dob, verified, is_admin) VALUES ($1, $2, $3, $4, $5, $6)",
        [data.email, data.username, data.password, data.dob, 0, data.role === "admin" ? 1 : 0]
    );
}

export async function updateUser(id: number, updates: Record<string, any>): Promise<void> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
    await execute(`UPDATE users SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
}

export async function updateUserByEmail(email: string, updates: Record<string, any>): Promise<void> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
    await execute(`UPDATE users SET ${setClause} WHERE email = $${keys.length + 1}`, [...values, email]);
}

export async function getPublicUserProfile(username: string): Promise<any | undefined> {
    return queryOne(
        "SELECT id, username, verified, coins, xp, profile_media_url, profile_media_type FROM users WHERE username = $1",
        [username]
    );
}

export async function getUserCount(): Promise<number> {
    const row = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM users");
    return row?.count || 0;
}

export async function addXp(userId: number, xp: number): Promise<void> {
    await execute("UPDATE users SET xp = xp + $1 WHERE id = $2", [xp, userId]);
}

export async function addCoins(userId: number, coins: number): Promise<void> {
    await execute("UPDATE users SET coins = coins + $1 WHERE id = $2", [coins, userId]);
}

export async function subtractCoins(userId: number, coins: number): Promise<void> {
    await execute("UPDATE users SET coins = coins - $1 WHERE id = $2 AND coins >= $1", [coins, userId]);
}

export async function getCoins(userId: number): Promise<number> {
    const row = await queryOne<{ coins: number }>("SELECT coins FROM users WHERE id = $1", [userId]);
    return row?.coins || 0;
}

export async function getPostById(postId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM posts WHERE id = $1", [postId]);
}

export async function getPosts(limit: number = 10, offset: number = 0, excludeRants: boolean = false): Promise<any[]> {
    if (excludeRants) {
        return query(
            "SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type FROM posts p JOIN users u ON p.user_id = u.id WHERE p.mode != 'rant' ORDER BY p.created_at DESC LIMIT $1 OFFSET $2",
            [limit, offset]
        );
    }
    return query(
        "SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2",
        [limit, offset]
    );
}

export async function getUserPosts(userId: number): Promise<any[]> {
    return query("SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
}

export async function createPost(data: { userId: number; username: string; content: string; mode: string; mediaUrl?: string | null; mediaType?: string | null; squadId?: number | null }): Promise<void> {
    await execute(
        "INSERT INTO posts (user_id, content, mode, created_at, media_url, media_type) VALUES ($1, $2, $3, $4, $5, $6)",
        [data.userId, data.content, data.mode, new Date().toISOString(), data.mediaUrl || null, data.mediaType || null]
    );
}

export async function updatePost(postId: number, content: string): Promise<void> {
    await execute("UPDATE posts SET content = $1 WHERE id = $2", [content, postId]);
}

export async function deletePost(postId: number): Promise<void> {
    await execute("DELETE FROM posts WHERE id = $1", [postId]);
}

export async function incrementPostLikes(postId: number): Promise<void> {
    await execute("UPDATE posts SET likes = likes + 1 WHERE id = $1", [postId]);
}

export async function getPostCount(): Promise<number> {
    const row = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM posts");
    return row?.count || 0;
}

export async function getCommentsForPost(postId: number): Promise<any[]> {
    const comments = await query(
        "SELECT c.*, u.username, u.profile_media_url, u.profile_media_type FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC",
        [postId]
    );

    for (const comment of comments) {
        comment.replies = await query(
            "SELECT r.*, u.username, u.profile_media_url, u.profile_media_type FROM replies r JOIN users u ON r.user_id = u.id WHERE r.comment_id = $1 ORDER BY r.created_at ASC",
            [comment.id]
        );
    }

    return comments;
}

export async function createComment(data: { postId: number; userId: number; content: string }): Promise<void> {
    await execute(
        "INSERT INTO comments (post_id, user_id, content, created_at) VALUES ($1, $2, $3, $4)",
        [data.postId, data.userId, data.content, new Date().toISOString()]
    );
}

export async function addReply(data: { commentId: number; userId: number; content: string }): Promise<void> {
    await execute(
        "INSERT INTO replies (comment_id, user_id, content, created_at) VALUES ($1, $2, $3, $4)",
        [data.commentId, data.userId, data.content, new Date().toISOString()]
    );
}

export async function incrementCommentLikes(commentId: number): Promise<void> {
    await execute("UPDATE comments SET likes = likes + 1 WHERE id = $1", [commentId]);
}

export async function unpinAllComments(postId: number): Promise<void> {
    await execute("UPDATE comments SET pinned = 0 WHERE post_id = $1", [postId]);
}

export async function pinComment(commentId: number): Promise<void> {
    await execute("UPDATE comments SET pinned = 1 WHERE id = $1", [commentId]);
}

export async function sharePost(data: { postId: number; userId: number; squadId: number; content: string; mode: string; mediaUrl?: string | null; mediaType?: string | null }): Promise<void> {
    await execute(
        "INSERT INTO posts (user_id, content, mode, created_at, squad_id, media_url, media_type) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [data.userId, data.content, data.mode, new Date().toISOString(), data.squadId, data.mediaUrl || null, data.mediaType || null]
    );
}

export async function hasUserLikedPost(postId: number, userId: number): Promise<boolean> {
    const like = await queryOne("SELECT id FROM likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
    return !!like;
}

export async function addLike(postId: number, userId: number): Promise<void> {
    await execute("INSERT INTO likes (post_id, user_id) VALUES ($1, $2)", [postId, userId]);
    await incrementPostLikes(postId);
}

export async function getTotalUserLikes(userId: number): Promise<number> {
    const row = await queryOne<{ total: number }>("SELECT SUM(likes) as total FROM posts WHERE user_id = $1", [userId]);
    return row?.total || 0;
}

export async function getRants(category?: string): Promise<any[]> {
    let queryText = "SELECT * FROM rants";
    const params: any[] = [];

    if (category) {
        queryText += " WHERE category = $1";
        params.push(category);
    }

    queryText += " ORDER BY created_at DESC";

    const rants = await query(queryText, params);

    for (const rant of rants) {
        rant.comments = await query(
            "SELECT * FROM rant_comments WHERE rant_id = $1 ORDER BY created_at ASC",
            [rant.id]
        );
    }

    return rants;
}

export async function createRant(data: { content: string; category: string; askForAdvice: boolean }): Promise<void> {
    await execute(
        "INSERT INTO rants (content, category, ask_for_advice) VALUES ($1, $2, $3)",
        [data.content, data.category, data.askForAdvice ? 1 : 0]
    );
}

export async function incrementRantUpvotes(rantId: number): Promise<void> {
    await execute("UPDATE rants SET upvotes = upvotes + 1 WHERE id = $1", [rantId]);
}

export async function addRantReaction(rantId: number, reaction: string, currentReactions: string): Promise<void> {
    let reactions: Record<string, number> = {};
    try {
        reactions = JSON.parse(currentReactions || "{}");
    } catch {
        reactions = {};
    }
    reactions[reaction] = (reactions[reaction] || 0) + 1;
    await execute("UPDATE rants SET reactions = $1 WHERE id = $2", [JSON.stringify(reactions), rantId]);
}

export async function incrementRantHugs(rantId: number): Promise<void> {
    await execute("UPDATE rants SET hugs = hugs + 1 WHERE id = $1", [rantId]);
}

export async function createRantComment(data: { rantId: number; content: string }): Promise<void> {
    await execute("INSERT INTO rant_comments (rant_id, content) VALUES ($1, $2)", [data.rantId, data.content]);
}

export async function getGameSquads(): Promise<any[]> {
    return query(
        "SELECT g.*, u.username as actual_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.is_featured DESC, g.created_at DESC"
    );
}

export async function getSquadById(squadId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM game_squads WHERE id = $1", [squadId]);
}

export async function createGameSquad(data: { userId: number; username: string; gameName: string; uid: string; description: string }): Promise<{ id: number }> {
    const result = await execute(
        "INSERT INTO game_squads (user_id, game_name, uid, description, status, max_members, wins, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [data.userId, data.gameName, data.uid, data.description, "open", 5, 0, new Date()]
    );
    await execute(
        "INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES ($1, $2, $3)",
        [result.lastID, data.userId, new Date()]
    );
    return { id: result.lastID };
}

export async function getSquadMemberCount(squadId: number): Promise<number> {
    const row = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM squad_members WHERE squad_id = $1", [squadId]);
    return row?.count || 0;
}

export async function isSquadMember(squadId: number, userId: number): Promise<boolean> {
    const row = await queryOne("SELECT squad_id FROM squad_members WHERE squad_id = $1 AND user_id = $2", [squadId, userId]);
    return !!row;
}

export async function addSquadMember(squadId: number, userId: number): Promise<void> {
    await execute("INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES ($1, $2, $3)", [squadId, userId, new Date()]);
}

export async function updateSquadStatus(squadId: number, status: "open" | "closed"): Promise<void> {
    await execute("UPDATE game_squads SET status = $1 WHERE id = $2", [status, squadId]);
}

export async function featureSquad(squadId: number, featured: boolean): Promise<void> {
    await execute("UPDATE game_squads SET is_featured = $1 WHERE id = $2", [featured ? 1 : 0, squadId]);
}

export async function incrementSquadWins(squadId: number): Promise<void> {
    await execute("UPDATE game_squads SET wins = wins + 1 WHERE id = $1", [squadId]);
}

export async function getSquadLeaderboard(): Promise<any[]> {
    return query(
        "SELECT g.*, u.username as creator_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.wins DESC LIMIT 10"
    );
}

export async function getSquadCount(): Promise<number> {
    const row = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM game_squads");
    return row?.count || 0;
}

export async function getPopularGames(): Promise<any[]> {
    return query("SELECT game_name, COUNT(*) as count FROM game_squads GROUP BY game_name ORDER BY count DESC LIMIT 5");
}

export async function getSquadMessages(squadId: number): Promise<any[]> {
    return query(
        "SELECT sm.*, u.username FROM squad_messages sm JOIN users u ON sm.user_id = u.id WHERE sm.squad_id = $1 ORDER BY sm.created_at ASC",
        [squadId]
    );
}

export async function createSquadMessage(squadId: number, userId: number, message: string): Promise<void> {
    await execute("INSERT INTO squad_messages (squad_id, user_id, message) VALUES ($1, $2, $3)", [squadId, userId, message]);
}

export async function getGameClips(squadId: number): Promise<any[]> {
    return query(
        "SELECT gc.*, u.username FROM game_clips gc JOIN users u ON gc.user_id = u.id WHERE gc.squad_id = $1 ORDER BY gc.created_at DESC",
        [squadId]
    );
}

export async function createGameClip(data: { squadId: number; userId: number; clipUrl: string; description: string }): Promise<void> {
    await execute(
        "INSERT INTO game_clips (squad_id, user_id, clip_url, description) VALUES ($1, $2, $3, $4)",
        [data.squadId, data.userId, data.clipUrl, data.description]
    );
}

export async function getTeams(): Promise<any[]> {
    return query("SELECT t.*, u.username as creator_username FROM teams t JOIN users u ON t.creator_id = u.id");
}

export async function createTeam(name: string, creatorId: number): Promise<{ id: number }> {
    const result = await execute("INSERT INTO teams (name, creator_id) VALUES ($1, $2)", [name, creatorId]);
    await execute("INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)", [result.lastID, creatorId]);
    return { id: result.lastID };
}

export async function isTeamMember(teamId: number, userId: number): Promise<boolean> {
    const row = await queryOne("SELECT team_id FROM team_members WHERE team_id = $1 AND user_id = $2", [teamId, userId]);
    return !!row;
}

export async function addTeamMember(teamId: number, userId: number): Promise<void> {
    await execute("INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)", [teamId, userId]);
}

export async function getTeamById(teamId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM teams WHERE id = $1", [teamId]);
}

export async function getHypeBattles(filters: { category?: string; isLive?: boolean }): Promise<any[]> {
    let queryText = "SELECT h.*, u.username as actual_username FROM hype_battles h JOIN users u ON h.user_id = u.id WHERE h.closed = 0";
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.category) {
        queryText += ` AND h.category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
    }
    if (filters.isLive !== undefined) {
        queryText += ` AND h.is_live = $${paramIndex}`;
        params.push(filters.isLive ? 1 : 0);
    }

    queryText += " ORDER BY h.created_at DESC";
    return query(queryText, params);
}

export async function getBattleById(battleId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM hype_battles WHERE id = $1", [battleId]);
}

export async function createBattle(data: {
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
    const result = await execute(
        "INSERT INTO hype_battles (user_id, opponent_id, team_id, opponent_team_id, category, content, media_url, is_live, voting_deadline) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [data.userId, data.opponentId, data.teamId, data.opponentTeamId, data.category, data.content, data.mediaUrl, data.isLive ? 1 : 0, data.votingDeadline]
    );
    return { id: result.lastID };
}

export async function respondToBattle(battleId: number, content: string, mediaUrl: string | null): Promise<void> {
    await execute("UPDATE hype_battles SET content = $1, opponent_media_url = $2 WHERE id = $3", [content, mediaUrl, battleId]);
}

export async function incrementBattleVotes(battleId: number, field: "votes" | "opponent_votes"): Promise<void> {
    await execute(`UPDATE hype_battles SET ${field} = ${field} + 1 WHERE id = $1`, [battleId]);
}

export async function closeBattle(battleId: number, winnerId: number | null): Promise<void> {
    await execute("UPDATE hype_battles SET closed = 1, winner_id = $1 WHERE id = $2", [winnerId, battleId]);
}

export async function getExpiredBattles(): Promise<any[]> {
    return query(
        "SELECT id, user_id, opponent_id, team_id, opponent_team_id, votes, opponent_votes, category FROM hype_battles WHERE voting_deadline < NOW() AND closed = 0"
    );
}

export async function getBattleWins(userId: number): Promise<number> {
    const row = await queryOne<{ wins: number }>("SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = $1 AND closed = 1", [userId]);
    return row?.wins || 0;
}

export async function hasVotedForBattle(userId: number, battleId: number): Promise<boolean> {
    const row = await queryOne("SELECT id FROM battle_votes WHERE user_id = $1 AND battle_id = $2", [userId, battleId]);
    return !!row;
}

export async function castBattleVote(userId: number, battleId: number, voteFor: string): Promise<void> {
    await execute("INSERT INTO battle_votes (user_id, battle_id, vote_for) VALUES ($1, $2, $3)", [userId, battleId, voteFor]);
}

export async function hasVotedForShowdown(userId: number): Promise<boolean> {
    const row = await queryOne("SELECT id FROM showdown_votes WHERE user_id = $1", [userId]);
    return !!row;
}

export async function castShowdownVote(userId: number, dateOption: string): Promise<void> {
    await execute("INSERT INTO showdown_votes (user_id, date_option) VALUES ($1, $2)", [userId, dateOption]);
}

export async function getTournaments(): Promise<any[]> {
    const tournaments = await query(
        "SELECT t.*, g.game_name as squad_game_name, g.uid as creator_username FROM tournaments t JOIN game_squads g ON t.squad_id = g.id ORDER BY t.created_at DESC"
    );

    for (const tournament of tournaments) {
        tournament.participants = await query(
            "SELECT g.id, g.game_name, g.uid FROM tournament_participants tp JOIN game_squads g ON tp.squad_id = g.id WHERE tp.tournament_id = $1",
            [tournament.id]
        );
    }

    return tournaments;
}

export async function createTournament(data: { squadId: number; title: string; description: string; gameName: string }): Promise<void> {
    await execute(
        "INSERT INTO tournaments (squad_id, title, description, game_name) VALUES ($1, $2, $3, $4)",
        [data.squadId, data.title, data.description, data.gameName]
    );
}

export async function updateTournament(tournamentId: number, updates: Record<string, any>): Promise<void> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    await execute(`UPDATE tournaments SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, tournamentId]);
}

export async function joinTournament(tournamentId: number, squadId: number): Promise<void> {
    await execute("INSERT INTO tournament_participants (tournament_id, squad_id) VALUES ($1, $2)", [tournamentId, squadId]);
}

export async function hasJoinedTournament(tournamentId: number, squadId: number): Promise<boolean> {
    const row = await queryOne("SELECT id FROM tournament_participants WHERE tournament_id = $1 AND squad_id = $2", [tournamentId, squadId]);
    return !!row;
}

export async function getCurrentShowdownTournament(): Promise<any | undefined> {
    return queryOne("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
}

export async function addShowdownParticipant(tournamentId: number, userId: number, status: string): Promise<void> {
    await execute("INSERT INTO showdown_participants (tournament_id, user_id, status) VALUES ($1, $2, $3)", [tournamentId, userId, status]);
}

export async function getShowdownParticipant(tournamentId: number, userId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM showdown_participants WHERE tournament_id = $1 AND user_id = $2", [tournamentId, userId]);
}

export async function getShowdownBracket(tournamentId: number): Promise<any[]> {
    return query(
        "SELECT sp.*, u.username FROM showdown_participants sp JOIN users u ON sp.user_id = u.id WHERE sp.tournament_id = $1 AND sp.status = 'active'",
        [tournamentId]
    );
}

export async function getShopItems(category?: string): Promise<any[]> {
    if (category && category !== "all") {
        return query("SELECT * FROM shop_items WHERE category = $1", [category]);
    }
    return query("SELECT * FROM shop_items");
}

export async function getShopItemById(itemId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM shop_items WHERE id = $1", [itemId]);
}

export async function purchaseItem(userId: number, itemId: number): Promise<void> {
    await execute("INSERT INTO user_inventory (user_id, item_id) VALUES ($1, $2)", [userId, itemId]);
}

export async function decrementStock(itemId: number): Promise<void> {
    await execute("UPDATE shop_items SET stock = stock - 1 WHERE id = $1 AND stock IS NOT NULL", [itemId]);
}

export async function getConversations(userId: number): Promise<any[]> {
    return query(
        `SELECT c.*, 
                CASE 
                    WHEN c.user1_id = $1 THEN u2.username 
                    WHEN c.user2_id = $1 THEN u1.username 
                END as other_username
        FROM conversations c
        LEFT JOIN users u1 ON c.user1_id = u1.id
        LEFT JOIN users u2 ON c.user2_id = u2.id
        WHERE c.user1_id = $1 OR c.user2_id = $1
        ORDER BY c.is_boosted DESC, c.created_at DESC`,
        [userId]
    );
}

export async function getConversation(conversationId: number, userId: number): Promise<any | undefined> {
    return queryOne("SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)", [conversationId, userId]);
}

export async function findConversation(userId1: number, userId2: number): Promise<any | undefined> {
    return queryOne(
        "SELECT * FROM conversations WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)",
        [userId1, userId2]
    );
}

export async function createConversation(userId1: number, userId2: number): Promise<void> {
    await execute(
        "INSERT INTO conversations (user1_id, user2_id, created_at, is_boosted) VALUES ($1, $2, $3, $4)",
        [userId1, userId2, new Date().toISOString(), 0]
    );
}

export async function getMessages(conversationId: number): Promise<any[]> {
    return query(
        "SELECT m.*, u.username as sender_username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = $1 ORDER BY m.created_at ASC",
        [conversationId]
    );
}

export async function getLatestMessage(conversationId: number): Promise<any | undefined> {
    return queryOne("SELECT content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1", [conversationId]);
}

export async function createMessage(data: {
    conversationId: number;
    senderId: number;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    isGhostBomb?: boolean;
}): Promise<void> {
    await execute(
        "INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, created_at, is_ghost_bomb) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [data.conversationId, data.senderId, data.content, data.mediaUrl || null, data.mediaType || null, new Date().toISOString(), data.isGhostBomb ? 1 : 0]
    );
}

export async function boostConversation(conversationId: number): Promise<void> {
    await execute("UPDATE conversations SET is_boosted = 1 WHERE id = $1", [conversationId]);
}

export async function getBlockList(userId: number): Promise<any[]> {
    return query(
        `SELECT u.username, u.id as blocked_user_id FROM blocked_users b JOIN users u ON b.blocked_user_id = u.id WHERE b.user_id = $1`,
        [userId]
    );
}

export async function isBlocked(userId: number, blockedUserId: number): Promise<boolean> {
    const row = await queryOne("SELECT * FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2", [userId, blockedUserId]);
    return !!row;
}

export async function blockUser(userId: number, blockedUserId: number): Promise<void> {
    await execute("INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)", [userId, blockedUserId]);
}

export async function unblockUser(userId: number, blockedUserId: number): Promise<void> {
    await execute("DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2", [userId, blockedUserId]);
}

export async function getAllUsers(): Promise<any[]> {
    return query("SELECT id, xp FROM users");
}

export async function getWeeklyXP(userId: number): Promise<number> {
    const row = await queryOne<{ weekly_xp: number }>(
        "SELECT SUM(p.xp) as weekly_xp FROM posts p WHERE p.user_id = $1 AND p.created_at >= NOW() - INTERVAL '7 days'",
        [userId]
    );
    return row?.weekly_xp || 0;
}

export async function updateSnitchStatus(userId: number, status: string): Promise<void> {
    await execute("UPDATE users SET snitch_status = $1 WHERE id = $2", [status, userId]);
}

export async function setNewsKingBadge(userId: number): Promise<void> {
    await execute(
        "INSERT INTO badges (user_id, news_king) VALUES ($1, 1) ON CONFLICT(user_id) DO UPDATE SET news_king = 1",
        [userId]
    );
}

export async function setDeveloperPick(userId: number, title: string): Promise<void> {
    await execute("INSERT INTO developer_picks (user_id, title) VALUES ($1, $2) ON CONFLICT(user_id) DO NOTHING", [userId, title]);
}

export async function getAnalytics(): Promise<{ totalUsers: number; totalSquads: number; totalPosts: number; popularGames: any[] }> {
    const [totalUsers, totalSquads, totalPosts, popularGames] = await Promise.all([
        getUserCount(),
        getSquadCount(),
        getPostCount(),
        getPopularGames(),
    ]);

    return { totalUsers, totalSquads, totalPosts, popularGames };
}

export async function cleanupExpiredUndercoverPosts(): Promise<void> {
    await execute(`
        DELETE FROM posts 
        WHERE mode = 'undercover' 
        AND likes < 50 
        AND created_at < NOW() - INTERVAL '1 day'
    `);
}

export async function clearAllUsers(): Promise<void> {
    await execute("DELETE FROM users");
}
