import express from "express";
import { dbGet, dbAll, dbRun } from "../database";

const router = express.Router();

// Get all tournaments
router.get("/", async (req, res, next) => {
    try {
        const tournaments = await dbAll(
            "SELECT t.*, g.game_name as squad_game_name, g.username as creator_username FROM tournaments t JOIN game_squads g ON t.squad_id = g.id ORDER BY t.created_at DESC"
        );

        for (const tournament of tournaments) {
            tournament.participants = await dbAll(
                "SELECT g.id, g.game_name, g.username FROM tournament_participants tp JOIN game_squads g ON tp.squad_id = g.id WHERE tp.tournament_id = ?",
                [tournament.id]
            );
        }

        res.json(tournaments);
    } catch (err) {
        console.error("Get tournaments error:", err);
        next(err);
    }
});

// Create a tournament
router.post("/", async (req, res, next) => {
    try {
        const { email, squadId, title, description, gameName } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const squad = await dbGet("SELECT user_id FROM game_squads WHERE id = ?", [squadId]);
        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.user_id !== user.id) return res.status(403).json({ message: "Only the squad creator can create a tournament" });

        await dbRun(
            "INSERT INTO tournaments (squad_id, title, description, game_name) VALUES (?, ?, ?, ?)",
            [squadId, title, description, gameName]
        );

        res.json({ message: "Tournament created successfully!" });
    } catch (err) {
        console.error("Create tournament error:", err);
        next(err);
    }
});

// Join a tournament
router.post("/join", async (req, res, next) => {
    try {
        const { email, tournamentId, squadId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const squad = await dbGet("SELECT user_id FROM game_squads WHERE id = ?", [squadId]);
        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.user_id !== user.id) return res.status(403).json({ message: "Only the squad creator can join a tournament" });

        const tournament = await dbGet("SELECT status, squad_id FROM tournaments WHERE id = ?", [tournamentId]);
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        if (tournament.status !== "open") return res.status(400).json({ message: "Tournament is not open for joining" });
        if (tournament.squad_id === squadId) return res.status(400).json({ message: "You cannot join your own tournament" });

        const alreadyJoined = await dbGet("SELECT id FROM tournament_participants WHERE tournament_id = ? AND squad_id = ?", [tournamentId, squadId]);
        if (alreadyJoined) return res.status(400).json({ message: "Your squad is already in this tournament" });

        await dbRun("INSERT INTO tournament_participants (tournament_id, squad_id) VALUES (?, ?)", [tournamentId, squadId]);
        res.json({ message: "Joined tournament successfully!" });
    } catch (err) {
        console.error("Join tournament error:", err);
        next(err);
    }
});

// Declare winner
router.post("/declare-winner", async (req, res, next) => {
    try {
        const { email, tournamentId, winnerId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id, xp, coins, role FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const tournament = await dbGet("SELECT squad_id, status FROM tournaments WHERE id = ?", [tournamentId]);
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        if (tournament.status === "completed") return res.status(400).json({ message: "Tournament is already completed" });

        const creatorSquad = await dbGet("SELECT user_id FROM game_squads WHERE id = ?", [tournament.squad_id]);
        if (creatorSquad.user_id !== user.id) return res.status(403).json({ message: "Only the tournament creator can declare a winner" });

        await dbRun("UPDATE tournaments SET status = 'completed', winner_id = ? WHERE id = ?", [winnerId, tournamentId]);
        await dbRun("UPDATE game_squads SET wins = wins + 1 WHERE id = ?", [winnerId]);

        let xpBonus = 5;
        let coinBonus = 5;
        if (user.role === "admin") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;
        await dbRun("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id]);

        res.json({ message: `Winner declared successfully! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        console.error("Declare winner error:", err);
        next(err);
    }
});

export default router;
