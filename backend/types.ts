// ============ Core Domain Types ============

export interface User {
    id: number;
    email: string;
    username: string;
    password: string;
    dob: string;
    verified: number;
    xp: number;
    coins: number;
    snitch_status: string | null;
    creator_badge: number;
    tier: number;
    wins: number;
    losses: number;
    title: string | null;
    legend_status: string;
    bio: string | null;
    background_theme: string;
    spending_restrictions: number;
    auto_earn_uploads: number;
    theme: string;
    animations_enabled: number;
    font_size: string;
    language: string;
    snitch_risk: number;
    profile_media_url: string | null;
    profile_media_type: string | null;
    last_login: string | null;
    role: "user" | "moderator" | "admin";
}

export interface Post {
    id: number;
    user_id: number;
    username: string;
    content: string;
    mode: string;
    likes: number;
    created_at: string;
    media_url: string | null;
    media_type: string | null;
    reactions: string;
    actual_username?: string;
    verified?: number;
    profile_media_url?: string;
    profile_media_type?: string;
}

export interface Comment {
    id: number;
    post_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
    likes: number;
    pinned: number;
    replies?: Reply[];
}

export interface Reply {
    id: number;
    comment_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
}

export interface Like {
    id: number;
    post_id: number;
    user_id: number;
    created_at: string;
}

export interface Rant {
    id: number;
    content: string;
    category: string;
    upvotes: number;
    reactions: string;
    hugs: number;
    ask_for_advice: number;
    created_at: string;
}

export interface RantComment {
    id: number;
    rant_id: number;
    content: string;
    created_at: string;
}

export interface GameSquad {
    id: number;
    user_id: number;
    username: string;
    game_name: string;
    uid: string;
    description: string;
    status: "open" | "closed";
    max_members: number;
    wins: number;
    is_featured: number;
    created_at: string;
    actual_username?: string;
    creator_username?: string;
}

export interface SquadMember {
    squad_id: number;
    user_id: number;
    joined_at: string;
}

export interface Tournament {
    id: number;
    squad_id: number;
    title: string;
    description: string;
    game_name: string;
    status: string;
    winner_id: number | null;
    created_at: string;
    squad_game_name?: string;
    creator_username?: string;
    participants?: GameSquad[];
}

export interface HypeBattle {
    id: number;
    user_id: number;
    username: string;
    opponent_id: number | null;
    team_id: number | null;
    opponent_team_id: number | null;
    category: string;
    content: string;
    media_url: string | null;
    opponent_media_url: string | null;
    votes: number;
    opponent_votes: number;
    is_live: number;
    voting_deadline: string;
    winner_id: number | null;
    created_at: string;
    closed: number;
    tournament_id: number | null;
    actual_username?: string;
}

export interface Team {
    id: number;
    name: string;
    creator_id: number;
    created_at: string;
    creator_username?: string;
}

export interface TeamMember {
    team_id: number;
    user_id: number;
    joined_at: string;
}

export interface ShopItem {
    id: number;
    name: string;
    category: string;
    price: number;
    image_url: string;
    description: string;
    is_limited: number;
    stock: number | null;
}

export interface InventoryItem {
    id: number;
    user_id: number;
    item_id: number;
    purchased_at: string;
    name: string;
    category: string;
    image_url: string;
    description: string;
}

export interface Conversation {
    id: number;
    user1_id: number;
    user2_id: number;
    is_boosted: number;
    created_at: string;
    other_username?: string;
}

export interface Message {
    id: number;
    conversation_id: number;
    sender_id: number;
    content: string;
    media_url: string | null;
    media_type: string | null;
    created_at: string;
    is_ghost_bomb: number;
    sender_username?: string;
}

export interface Badge {
    user_id: number;
    news_king: number;
}

export interface BlockedUser {
    id: number;
    user_id: number;
    blocked_user_id: number;
    timestamp: string;
}

export interface ShowdownTournament {
    id: number;
    season: string;
    status: string;
    start_date: string;
    created_at: string;
    winner_id: number | null;
}

export interface ShowdownParticipant {
    tournament_id: number;
    user_id: number;
    status: string;
    bracket_position: number | null;
    username?: string;
}

export interface CoinFlipHistory {
    id: number;
    user_id: number;
    bet_amount: number;
    won_amount: number;
    result: string;
    created_at: string;
}

export interface DeveloperPick {
    id: number;
    user_id: number;
    title: string;
    awarded_at: string;
}

export interface ProfileBorder {
    id: number;
    user_id: number;
    border_style: string;
    awarded_at: string;
}

export interface HallOfFame {
    id: number;
    user_id: number;
    tournament_id: number;
    rank: number;
    awarded_at: string;
}

export interface PostHallOfFame {
    id: number;
    user_id: number;
    post_id: number;
    total_likes: number;
    created_at: string;
}

export interface PostShare {
    id: number;
    post_id: number;
    user_id: number;
    squad_id: number;
    created_at: string;
}

export interface PostComment {
    id: number;
    post_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
    pinned: number;
}

export interface CommentReply {
    id: number;
    comment_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
}

export interface CommentLike {
    id: number;
    comment_id: number;
    user_id: number;
    created_at: string;
}

export interface GameClip {
    id: number;
    squad_id: number;
    user_id: number;
    clip_url: string;
    description: string;
    created_at: string;
    username?: string;
}

export interface SquadMessage {
    id: number;
    squad_id: number;
    user_id: number;
    message: string;
    created_at: string;
    username?: string;
}

export interface ShowdownClip {
    id: number;
    tournament_id: number;
    user_id: number;
    username: string;
    clip_url: string;
    category: string;
    created_at: string;
}

export interface ShowdownBoost {
    id: number;
    tournament_id: number;
    battle_id: number | null;
    user_id: number;
    target_user_id: number;
    coins_spent: number;
    created_at: string;
}

export interface ShowdownVote {
    id: number;
    user_id: number;
    date_option: string;
}

export interface BattleVote {
    id: number;
    user_id: number;
    battle_id: number;
    vote_for: string;
}

// ============ Request/Response Types ============

export interface ApiError {
    message: string;
    code?: string;
}

export interface PaginationParams {
    limit: number;
    offset: number;
}

export interface RewardResult {
    xpBonus: number;
    coinBonus: number;
}

export interface LevelInfo {
    level: number;
    rank: string;
}

export interface TierInfo {
    newTier: number;
}

export interface AuthenticatedRequest {
    user: {
        id: number;
        email: string;
        verified: number;
        role: string;
    };
}

// ============ Backend Types ============

export interface RouteDependencies {
    db: any;
    io?: any;
    SECRET_KEY?: string;
}

export interface JwtPayload {
    id: number;
    email: string;
    verified: number;
    role: string;
}

export interface DbRunResult {
    lastID: number;
    changes: number;
}
