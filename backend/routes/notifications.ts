import express from "express";
import { db } from "../database";

const router = express.Router();

// Helper to fetch notifications for a user
const getNotifications = (userId: number): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            [userId],
            (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            }
        );
    });
};

// Helper to count unread notifications
const countUnreadNotifications = (userId: number): Promise<number> => {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
            [userId],
            (err, row: any) => {
                if (err) reject(err);
                resolve(row.count);
            }
        );
    });
};

// GET: Fetch notifications for the user
router.get("/", async (req, res) => {
    try {
        const notifications = await getNotifications(req.user.id);
        const unreadCount = await countUnreadNotifications(req.user.id);
        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Mark a notification as read
router.post("/read/:id", async (req, res) => {
    try {
        const notificationId = req.params.id;
        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
                [notificationId, req.user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        res.json({ message: "Notification marked as read" });
    } catch (err) {
        console.error("Error marking notification as read:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Mark all notifications as read
router.post("/read-all", async (req, res) => {
    try {
        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
                [req.user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        console.error("Error marking all notifications as read:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// DELETE: Delete a notification
router.delete("/:id", async (req, res) => {
    try {
        const notificationId = req.params.id;
        await new Promise<void>((resolve, reject) => {
            db.run(
                "DELETE FROM notifications WHERE id = ? AND user_id = ?",
                [notificationId, req.user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        res.json({ message: "Notification deleted" });
    } catch (err) {
        console.error("Error deleting notification:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;