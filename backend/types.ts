export interface User {
    id: number;
    email: string;
    coins: number;
    username?: string;
    verified?: number;
}

export interface ShopItem {
    id: number;
    name: string;
    price: number;
    is_limited: number;
    stock?: number;
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

export interface Post {
    id: number;
    user_id: number;
    content: string;
    mode: string;
    created_at: string;
    squad_id?: number;
    likes: number;
    reactions?: string;
    actual_username?: string;
    verified?: number;
}

export interface Comment {
    id: number;
    post_id: number;
    user_id: number;
    content: string;
    created_at: string;
    likes: number;
    pinned: number;
    username?: string;
    replies?: Reply[];
}

export interface Reply {
    id: number;
    comment_id: number;
    user_id: number;
    content: string;
    created_at: string;
    username?: string;
}

export interface Conversation {
    id: number;
    user1_id: number;
    user2_id: number;
    is_boosted: number;
    created_at: string;
}

export interface Message {
    id: number;
    conversation_id: number;
    sender_id: number;
    content?: string | null;
    media_url?: string | null;
    media_type?: "voice" | "photo" | "video" | null;
    created_at: string;
    is_ghost_bomb: number;
    sender_username?: string;
}

export interface RouteDependencies {
    db: any;
    io?: any;
    SECRET_KEY?: string;
    }
