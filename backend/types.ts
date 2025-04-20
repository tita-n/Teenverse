export interface User {
  id: number;
  email: string;
  coins: number;
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
  purchased_at: string; // SQLite TIMESTAMP
  name: string;
  category: string;
  image_url: string;
  description: string;
}