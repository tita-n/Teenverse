export interface User {
  id: number;
  email: string;
  coins: number;
}

export interface ShopItem {
  id: number;
  name: string;
  price: number;
  is_limited: number; // SQLite uses 0/1 for BOOLEAN
  stock?: number;
}
