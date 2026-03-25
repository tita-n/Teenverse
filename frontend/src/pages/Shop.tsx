import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";

interface ShopItem {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string;
  description: string;
  is_limited: number;
  stock?: number;
}

export default function Shop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [cart, setCart] = useState<ShopItem[]>([]);
  const [category, setCategory] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const { user, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    axios.get("/api/shop/items", withAuth(token))
      .then((res) => setItems(res.data))
      .catch((err) => { console.error("Error fetching items:", err); setMessage("Error loading shop items."); })
      .finally(() => setLoading(false));
  }, [user, token]);

  const addToCart = (item: ShopItem) => setCart([...cart, item]);
  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  const purchaseItems = async () => {
    if (!user || !token || cart.length === 0) return;
    try {
      setPurchasing(true);
      for (const item of cart) {
        await axios.post("/api/shop/purchase", { email: user.email, itemId: item.id }, withAuth(token));
      }
      setMessage("Purchase successful!");
      setCart([]);
    } catch (err: any) {
      setMessage("Purchase failed: " + (err.response?.data?.message || err.message));
    } finally {
      setPurchasing(false);
    }
  };

  const filteredItems = category === "all" ? items : items.filter((item) => item.category === category);
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading shop..." />;

  return (
    <Layout maxWidth="4xl">
      <div className="mb-6">
        <h1 className="text-h1">TeenVerse Shop</h1>
        <p className="text-tx-secondary mt-1">Spend your coins on awesome items</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") || message.includes("failed") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-tx-secondary">Filter:</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="all">All Items</option>
            <option value="vehicle">Vehicles</option>
            <option value="animal">Animals</option>
            <option value="fashion">Fashion</option>
            <option value="accessory">Accessories</option>
          </select>
        </div>
      </div>

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {filteredItems.map((item) => (
            <Card key={item.id} hover className="overflow-hidden">
              <div className="aspect-square bg-surface-muted relative">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-contain p-4"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/200?text=No+Image"; }}
                />
                {item.is_limited ? (
                  <span className="absolute top-3 right-3 badge badge-danger animate-pulse">
                    {item.stock} left!
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-tx-primary mb-1">{item.name}</h3>
                <p className="text-sm text-tx-secondary mb-3 line-clamp-2">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-600">{item.price} Coins</span>
                  <Button size="sm" onClick={() => addToCart(item)}>
                    Add to Cart
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No items available"
          message="Check back later for new items!"
          icon={<ShoppingBag className="w-8 h-8 text-tx-muted" />}
        />
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <div className="card p-6 sticky bottom-4 shadow-lg border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-tx-primary flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand-500" />
              Cart ({cart.length} items)
            </h2>
          </div>
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {cart.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-surface-muted rounded-lg">
                <span className="text-sm text-tx-primary">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-brand-600 font-medium">{item.price}</span>
                  <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-surface-border">
            <span className="font-semibold text-tx-primary">Total: {cartTotal} Coins</span>
            <Button onClick={purchaseItems} loading={purchasing}>
              Checkout
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
