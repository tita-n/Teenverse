import express from "express";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";

const router = express.Router();

// Get all teams
router.get("/teams", async (req, res, next) => {
    try {
        const teams = await dbAll(
            "SELECT t.*, u.username as creator_username FROM teams t JOIN users u ON t.creator_id = u.id"
        );
        res.json(teams);
    } catch (err) {
        console.error("Get teams error:", err);
        next(err);
    }
});

// Create a team
router.post("/teams", async (req, res, next) => {
    try {
        const { email, name } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await dbRun("INSERT INTO teams (name, creator_id) VALUES (?, ?)", [name, user.id]);
        await dbRun("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)", [result.lastID, user.id]);

        res.json({ message: "Team created!", teamId: result.lastID });
    } catch (err) {
        console.error("Create team error:", err);
        next(err);
    }
});

// Join a team
router.post("/teams/join", async (req, res, next) => {
    try {
        const { email, teamId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const alreadyMember = await dbGet("SELECT team_id FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, user.id]);
        if (alreadyMember) return res.status(400).json({ message: "Already a member of this team" });

        await dbRun("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)", [teamId, user.id]);
        res.json({ message: "Joined team successfully!" });
    } catch (err) {
        console.error("Join team error:", err);
        next(err);
    }
});

// Get hype battles
router.get("/battles", async (req, res, next) => {
    try {
        const { category, isLive } = req.query;
        let query = "SELECT h.*, u.username as actual_username FROM hype_battles h JOIN users u ON h.user_id = u.id WHERE h.closed = 0";
        const params: any[] = [];

        if (category) {
            query += " AND h.category = ?";
            params.push(category);
        }
        if (isLive) {
            query += " AND h.is_live = ?";
            params.push(isLive === "true" ? 1 : 0);
        }

        query += " ORDER BY h.created_at DESC";
        const battles = await dbAll(query, params);
        res.json(battles);
    } catch (err) {
        console.error("Get battles error:", err);
        next(err);
    }
});

// Vote on a battle
router.post("/vote", async (req, res, next) => {
    try {
        const { email, battleId, voteFor } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!["creator", "opponent"].includes(voteFor)) {
            return res.status(400).json({ message: "Invalid vote target" });
        }

        const result = await withTransaction(async () => {
            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) throw new Error("USER_NOT_FOUND");

            const battle = await dbGet("SELECT closed, voting_deadline FROM hype_battles WHERE id = ?", [battleId]);
            if (!battle) throw new Error("BATTLE_NOT_FOUND");
            if (battle.closed) throw new Error("BATTLE_CLOSED");
            if (new Date(battle.voting_deadline) < new Date()) throw new Error("VOTING_ENDED");

            const existingVote = await dbGet("SELECT id FROM battle_votes WHERE user_id = ? AND battle_id = ?", [user.id, battleId]);
            if (existingVote) throw new Error("ALREADY_VOTED");

            await dbRun("INSERT INTO battle_votes (user_id, battle_id, vote_for) VALUES (?, ?, ?)", [user.id, battleId, voteFor]);

            const field = voteFor === "creator" ? "votes" : "opponent_votes";
            await dbRun(`UPDATE hype_battles SET ${field} = ${field} + 1 WHERE id = ?`, [battleId]);

            return { message: "Vote cast successfully!" };
        });

        res.json(result);
    } catch (err: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
            USER_NOT_FOUND: { status: 404, message: "User not found" },
            BATTLE_NOT_FOUND: { status: 404, message: "Battle not found" },
            BATTLE_CLOSED: { status: 400, message: "Battle is closed" },
            VOTING_ENDED: { status: 400, message: "Voting has ended" },
            ALREADY_VOTED: { status: 400, message: "You already voted for this battle!" },
        };

        const mapped = errorMap[err.message];
        if (mapped) {
            return res.status(mapped.status).json({ message: mapped.message });
        }

        console.error("Vote battle error:", err);
        next(err);
    }
});

// Determine winners for expired battles
router.get("/determine-winners", async (req, res, next) => {
    try {
        const battles = await dbAll(
            "SELECT id, user_id, opponent_id, team_id, opponent_team_id, votes, opponent_votes, category FROM hype_battles WHERE voting_deadline < DATETIME('now') AND closed = 0"
        );

        for (const battle of battles) {
            let winnerId: number | null = null;
            let loserId: number | null = null;

            if (battle.votes > battle.opponent_votes) {
                winnerId = battle.user_id;
                loserId = battle.opponent_id;
            } else if (battle.opponent_votes > battle.votes) {
                winnerId = battle.opponent_id;
                loserId = battle.user_id;
            }

            await dbRun("UPDATE hype_battles SET closed = 1, winner_id = ? WHERE id = ?", [winnerId || battle.team_id, battle.id]);

            if (winnerId) {
                await dbRun("UPDATE users SET coins = coins + 50, wins = wins + 1 WHERE id = ?", [winnerId]);

                // Calculate tier
                const winner = await dbGet("SELECT wins, losses, tier FROM users WHERE id = ?", [winnerId]);
                if (winner) {
                    const winRate = winner.wins / (winner.wins + winner.losses || 1);
                    let newTier = winner.tier;
                    if (winner.wins + winner.losses >= 5) {
                        if (winRate >= 0.7 && newTier < 5) newTier += 1;
                        else if (winRate < 0.3 && newTier > 1) newTier -= 1;
                    }
                    await dbRun("UPDATE users SET tier = ? WHERE id = ?", [newTier, winnerId]);
                }

                if (loserId) {
                    await dbRun("UPDATE users SET losses = losses + 1 WHERE id = ?", [loserId]);
                }

                // Award title
                const titleMap: Record<string, string> = {
                    rap: "Rap King",
                    dance: "Dance Legend",
                    comedy: "Meme Master",
                };
                const title = titleMap[battle.category];
                if (title) {
                    await dbRun("UPDATE users SET title = NULL WHERE title = ?", [title]);
                    await dbRun("UPDATE users SET title = ? WHERE id = ?", [title, winnerId]);
                }
            }
        }

        res.json({ message: "Winners determined and titles assigned!" });
    } catch (err) {
        console.error("Determine winners error:", err);
        next(err);
    }
});

export default router;
