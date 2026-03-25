import express from "express";
import { dbGet, dbAll, dbRun } from "../database";

const router = express.Router();

// Get all game squads
router.get("/", async (req, res, next) => {
    try {
        const squads = await dbAll(
            "SELECT g.*, u.username as actual_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.is_featured DESC, g.created_at DESC"
        );
        res.json(squads);
    } catch (err) {
        console.error("Get game squads error:", err);
        next(err);
    }
});

// Create a game squad
router.post("/", async (req, res, next) => {
    try {
        const { email, gameName, uid, description } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id, username, xp, coins, role FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await dbRun(
            "INSERT INTO game_squads (user_id, username, game_name, uid, description, status, max_members, wins, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [user.id, user.username, gameName, uid, description, "open", 5, 0, new Date()]
        );

        await dbRun("INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)", [result.lastID, user.id, new Date()]);

        let xpBonus = 10;
        let coinBonus = 10;
        if (user.role === "admin") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;
        await dbRun("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id]);

        res.json({ message: `Game squad created! +${xpBonus} XP and +${coinBonus} coins`, squadId: result.lastID, newXP, newCoins });
    } catch (err) {
        console.error("Create game squad error:", err);
        next(err);
    }
});

// Join a squad
router.post("/join", async (req, res, next) => {
    try {
        const { email, squadId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const squad = await dbGet("SELECT status, max_members FROM game_squads WHERE id = ?", [squadId]);
        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.status === "closed") return res.status(400).json({ message: "Squad is closed to new members" });

        const memberCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM squad_members WHERE squad_id = ?", [squadId]);
        if ((memberCount?.count || 0) >= squad.max_members) {
            return res.status(400).json({ message: "Squad is full" });
        }

        const alreadyMember = await dbGet("SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?", [squadId, user.id]);
        if (alreadyMember) return res.status(400).json({ message: "You are already a member of this squad" });

        await dbRun("INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)", [squadId, user.id, new Date()]);
        res.json({ message: "Joined squad successfully!" });
    } catch (err) {
        console.error("Join squad error:", err);
        next(err);
    }
});

// Manage squad status (admin only)
router.post("/manage-status", async (req, res, next) => {
    try {
        const { email, squadId, newStatus } = req.body;
        if (req.user.email !== email || req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admins can manage squad status" });
        }

        if (!["open", "closed"].includes(newStatus)) {
            return res.status(400).json({ message: "Invalid status. Must be 'open' or 'closed'." });
        }

        const squad = await dbGet("SELECT id FROM game_squads WHERE id = ?", [squadId]);
        if (!squad) return res.status(404).json({ message: "Squad not found" });

        await dbRun("UPDATE game_squads SET status = ? WHERE id = ?", [newStatus, squadId]);
        res.json({ message: `Squad status updated to ${newStatus}!` });
    } catch (err) {
        console.error("Manage squad status error:", err);
        next(err);
    }
});

// Feature a squad (admin only)
router.post("/feature", async (req, res, next) => {
    try {
        const { email, squadId, feature } = req.body;
        if (req.user.email !== email || req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admins can feature squads" });
        }

        const squad = await dbGet("SELECT id FROM game_squads WHERE id = ?", [squadId]);
        if (!squad) return res.status(404).json({ message: "Squad not found" });

        await dbRun("UPDATE game_squads SET is_featured = ? WHERE id = ?", [feature ? 1 : 0, squadId]);
        res.json({ message: `Squad ${feature ? "featured" : "unfeatured"} successfully!` });
    } catch (err) {
        console.error("Feature squad error:", err);
        next(err);
    }
});

// Get squad leaderboard
router.get("/leaderboard", async (req, res, next) => {
    try {
        const leaderboard = await dbAll(
            "SELECT g.*, u.username as creator_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.wins DESC LIMIT 10"
        );
        res.json(leaderboard);
    } catch (err) {
        console.error("Get leaderboard error:", err);
        next(err);
    }
});

// Report a win
router.post("/report-win", async (req, res, next) => {
    try {
        const { email, squadId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id, xp, coins, role FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const squad = await dbGet("SELECT user_id FROM game_squads WHERE id = ?", [squadId]);
        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.user_id !== user.id) return res.status(403).json({ message: "Only the squad creator can report a win" });

        await dbRun("UPDATE game_squads SET wins = wins + 1 WHERE id = ?", [squadId]);

        let xpBonus = 5;
        let coinBonus = 5;
        if (user.role === "admin") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;
        await dbRun("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id]);

        res.json({ message: `Win reported successfully! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        console.error("Report win error:", err);
        next(err);
    }
});

// Get squad messages
router.get("/:squadId/messages", async (req, res, next) => {
    try {
        const squadId = parseInt(req.params.squadId);
        const userId = req.user.id;

        const membership = await dbGet("SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?", [squadId, userId]);
        if (!membership) {
            return res.status(403).json({ message: "You are not a member of this squad" });
        }

        const messages = await dbAll(
            "SELECT sm.*, u.username FROM squad_messages sm JOIN users u ON sm.user_id = u.id WHERE sm.squad_id = ? ORDER BY sm.created_at ASC",
            [squadId]
        );

        res.json(messages);
    } catch (err) {
        console.error("Get squad messages error:", err);
        next(err);
    }
});

// Send a squad message
router.post("/:squadId/messages", async (req, res, next) => {
    try {
        const squadId = parseInt(req.params.squadId);
        const { email, message } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMember = await dbGet("SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?", [squadId, user.id]);
        const isCreator = await dbGet("SELECT id FROM game_squads WHERE id = ? AND user_id = ?", [squadId, user.id]);
        if (!isMember && !isCreator) return res.status(403).json({ message: "You must be a member of this squad to send messages" });

        await dbRun("INSERT INTO squad_messages (squad_id, user_id, message) VALUES (?, ?, ?)", [squadId, user.id, message]);
        res.json({ message: "Message sent successfully!" });
    } catch (err) {
        console.error("Send squad message error:", err);
        next(err);
    }
});

// Get game clips
router.get("/:squadId/clips", async (req, res, next) => {
    try {
        const squadId = parseInt(req.params.squadId);
        const clips = await dbAll(
            "SELECT gc.*, u.username FROM game_clips gc JOIN users u ON gc.user_id = u.id WHERE gc.squad_id = ? ORDER BY gc.created_at DESC",
            [squadId]
        );
        res.json(clips);
    } catch (err) {
        console.error("Get clips error:", err);
        next(err);
    }
});

export default router;
