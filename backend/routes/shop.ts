import express from "express";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";

const router = express.Router();

// Get shop items
router.get("/items", async (req, res, next) => {
    try {
        const { category } = req.query;
        let items;
        if (category && category !== "all") {
            items = await dbAll("SELECT * FROM shop_items WHERE category = ?", [category]);
        } else {
            items = await dbAll("SELECT * FROM shop_items");
        }
        res.json(items);
    } catch (err) {
        console.error("Get shop items error:", err);
        next(err);
    }
});

// Purchase an item
router.post("/purchase", async (req, res, next) => {
    try {
        const { email, itemId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const result = await withTransaction(async () => {
            const user = await dbGet("SELECT id, coins, spending_restrictions FROM users WHERE email = ?", [email]);
            if (!user) throw new Error("USER_NOT_FOUND");

            if (user.spending_restrictions) {
                throw new Error("SPENDING_RESTRICTED");
            }

            const item = await dbGet("SELECT * FROM shop_items WHERE id = ?", [itemId]);
            if (!item) throw new Error("ITEM_NOT_FOUND");

            if (user.coins < item.price) {
                throw new Error("INSUFFICIENT_COINS");
            }

            if (item.is_limited && item.stock !== null) {
                if (item.stock <= 0) {
                    throw new Error("OUT_OF_STOCK");
                }
                await dbRun("UPDATE shop_items SET stock = stock - 1 WHERE id = ?", [itemId]);
            }

            await dbRun("UPDATE users SET coins = coins - ? WHERE id = ?", [item.price, user.id]);
            await dbRun("INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)", [user.id, itemId]);

            return { message: `Purchased ${item.name} for ${item.price} coins!`, newCoins: user.coins - item.price };
        });

        res.json(result);
    } catch (err: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
            USER_NOT_FOUND: { status: 404, message: "User not found" },
            ITEM_NOT_FOUND: { status: 404, message: "Item not found" },
            INSUFFICIENT_COINS: { status: 400, message: "Insufficient coins" },
            OUT_OF_STOCK: { status: 400, message: "Item is out of stock" },
            SPENDING_RESTRICTED: { status: 400, message: "Spending is restricted" },
        };

        const mapped = errorMap[err.message];
        if (mapped) {
            return res.status(mapped.status).json({ message: mapped.message });
        }

        console.error("Purchase error:", err);
        next(err);
    }
});

// Get user inventory
router.get("/inventory", async (req, res, next) => {
    try {
        const user = await dbGet("SELECT id FROM users WHERE email = ?", [req.user.email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const inventory = await dbAll(
            `SELECT ui.id, ui.purchased_at, si.name, si.category, si.image_url, si.description
             FROM user_inventory ui
             JOIN shop_items si ON ui.item_id = si.id
             WHERE ui.user_id = ?
             ORDER BY ui.purchased_at DESC`,
            [user.id]
        );

        res.json(inventory);
    } catch (err) {
        console.error("Get inventory error:", err);
        next(err);
    }
});

export default router;
