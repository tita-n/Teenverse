import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

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
  const [category, setCategory] = useState<string>("all");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchItems = async () => {
      if (!user || !token) return;
      try {
        const res = await axios.get("/api/shop/items", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(res.data);
      } catch (err) {
        setMessage("Error fetching shop items: " + (err.response?.data?.message || err.message));
      }
    };

    const fetchData = async () => {
      setLoading(true);
      await fetchItems();
      setLoading(false);
    };

    if (user && token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  const addToCart = (item: ShopItem) => {
    setCart([...cart, item]);
  };

  const purchaseItems = async () => {
    if (!user || !token) {
      setMessage("Please log in to purchase items.");
      return;
    }
    try {
      for (const item of cart) {
        await axios.post(
          "/api/shop/purchase",
          { email: user.email, itemId: item.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setMessage("Purchase successful!");
      setCart([]);
    } catch (err) {
      setMessage("Purchase failed: " + (err.response?.data?.message || err.message));
    }
  };

  const filteredItems = category === "all" ? items : items.filter((item) => item.category === category);

  if (!user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-500 text-xl">Please log in to access the shop.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-800 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 animate-pulse">
            Teenverse Shop
          </h1>
          <p className="text-center text-green-600 mb-6">{message}</p>

          <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Browse Items</h2>
            <div className="mb-4 flex items-center">
              <label className="mr-2 text-lg font-semibold text-gray-800">
                Filter by Category:
              </label>
              <select
                className="border p-3 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All</option>
                <option value="vehicle">Vehicles</option>
                <option value="animal">Animals</option>
                <option value="fashion">Fashion</option>
                <option value="accessory">Accessories</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border rounded-lg p-4 shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition duration-300"
                >
                  <div className="relative w-full h-40 mb-2">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-contain rounded animate-fade-in"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/200';
                        console.error(`Failed to load image for ${item.name}: ${item.image_url}`);
                      }}
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800">{item.name}</h2>
                  <p className="text-gray-600">{item.description}</p>
                  <p className="text-lg font-bold text-indigo-600">
                    Price: {item.price} Coins
                  </p>
                  {item.is_limited ? (
                    <p className="text-red-500 font-semibold animate-bounce">
                      Limited: {item.stock} left!
                    </p>
                  ) : null}
                  <button
                    className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200 transform hover:scale-105"
                    onClick={() => addToCart(item)}
                  >
                    Add to Cart
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-600 col-span-full text-center">
                No items available in this category.
              </p>
            )}
          </div>

          {cart.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-lg animate-slide-up">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Cart</h2>
              <ul className="mb-4">
                {cart.map((item, index) => (
                  <li key={index} className="flex justify-between py-1">
                    <span>{item.name}</span>
                    <span>{item.price} Coins</span>
                  </li>
                ))}
              </ul>
              <p className="font-bold text-lg text-gray-800">
                Total: {cart.reduce((sum, item) => sum + item.price, 0)} Coins
              </p>
              <button
                className="mt-4 w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 transform hover:scale-105"
                onClick={purchaseItems}
              >
                Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}