import express from "express";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";

const router = express.Router();

// ============ TEAMS (keep existing) ============

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

        const isMember = await dbGet("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, user.id]);
        if (isMember) return res.status(400).json({ message: "Already a member" });

        await dbRun("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)", [teamId, user.id]);
        res.json({ message: "Joined team!" });
    } catch (err) {
        console.error("Join team error:", err);
        next(err);
    }
});

// ============ NEW HYPE BATTLES API ============

const VALID_CATEGORIES = ["Dance", "Rap", "Singing", "Comedy", "Art", "Fitness", "General"];
const BATTLE_DURATION_HOURS = 24;
const DEFAULT_REWARD_COINS = 100;

// Get all hype battles (exclude completed)
router.get("/hype-battles", async (req, res, next) => {
    try {
        const battles = await dbAll(`
            SELECT hb.*, 
                   u1.username as challenger_username, u1.profile_media_url as challenger_profile,
                   u2.username as opponent_username, u2.profile_media_url as opponent_profile
            FROM hype_battles hb
            LEFT JOIN users u1 ON hb.challenger_id = u1.id
            LEFT JOIN users u2 ON hb.opponent_id = u2.id
            ORDER BY hb.created_at DESC
            LIMIT 50
        `);
        res.json(battles);
    } catch (err) {
        console.error("Get battles error:", err);
        next(err);
    }
});

// Get single battle with details
router.get("/hype-battles/:id", async (req, res, next) => {
    try {
        const battle = await dbGet(`
            SELECT hb.*, 
                   u1.username as challenger_username, u1.profile_media_url as challenger_profile, u1.verified as challenger_verified,
                   u2.username as opponent_username, u2.profile_media_url as opponent_profile, u2.verified as opponent_verified
            FROM hype_battles hb
            LEFT JOIN users u1 ON hb.challenger_id = u1.id
            LEFT JOIN users u2 ON hb.opponent_id = u2.id
            WHERE hb.id = ?
        `, [req.params.id]);
        
        if (!battle) return res.status(404).json({ message: "Battle not found" });
        res.json(battle);
    } catch (err) {
        console.error("Get battle error:", err);
        next(err);
    }
});

// Create a new battle challenge
router.post("/hype-battles", async (req, res, next) => {
    try {
        const { email, title, description, category, opponentUsername, mediaUrl, mediaType, content, challengeType = "open" } = req.body;
        
        if (!email || !title || !category || !mediaUrl) {
            return res.status(400).json({ message: "Title, category, and media are required" });
        }

        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: "Invalid category" });
        }

        const challenger = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!challenger) return res.status(404).json({ message: "User not found" });

        let opponentId = null;
        if (opponentUsername) {
            const opponent = await dbGet("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", [opponentUsername]);
            if (opponent) opponentId = opponent.id;
        }

        const result = await dbRun(`
            INSERT INTO hype_battles (title, description, category, challenge_type, challenger_id, challenger_media_url, challenger_media_type, challenger_content, challenger_submitted_at, challenger_votes, opponent_id, status, voting_hours, reward_coins)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?)
        `, [title, description, category, challengeType, challenger.id, mediaUrl, mediaType, content, new Date().toISOString(), opponentId, BATTLE_DURATION_HOURS, DEFAULT_REWARD_COINS]);

        res.json({ message: "Battle created!", battleId: result.lastID });
    } catch (err) {
        console.error("Create battle error:", err);
        next(err);
    }
});

// Submit response to a battle (opponent submits their entry)
router.post("/hype-battles/:id/submit", async (req, res, next) => {
    try {
        const { email, mediaUrl, mediaType, content } = req.body;
        const battleId = req.params.id;

        const user = await dbGet("SELECT id, username FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const battle = await dbGet("SELECT * FROM hype_battles WHERE id = ?", [battleId]);
        if (!battle) return res.status(404).json({ message: "Battle not found" });

        // Check if user is the challenger or opponent
        if (battle.challenger_id !== user.id && battle.opponent_id !== user.id) {
            return res.status(403).json({ message: "Not invited to this battle" });
        }

        // Check if already submitted
        if (battle.opponent_id === user.id && battle.opponent_submitted_at) {
            return res.status(400).json({ message: "Already submitted" });
        }

        // Update with opponent's submission
        const votingDeadline = new Date();
        votingDeadline.setHours(votingDeadline.getHours() + battle.voting_hours);

        await dbRun(`
            UPDATE hype_battles 
            SET opponent_id = ?, opponent_media_url = ?, opponent_media_type = ?, opponent_content = ?, 
                opponent_submitted_at = ?, status = 'live', voting_deadline = ?
            WHERE id = ?
        `, [user.id, mediaUrl, mediaType, content, new Date().toISOString(), votingDeadline.toISOString(), battleId]);

        // Notify via socket would be handled here if io is passed

        res.json({ message: "Entry submitted! Battle is now live!" });
    } catch (err) {
        console.error("Submit battle error:", err);
        next(err);
    }
});

// Vote for a battle
router.post("/hype-battles/:id/vote", async (req, res, next) => {
    try {
        const { email, voteFor } = req.body; // voteFor = "challenger" or "opponent"
        const battleId = req.params.id;

        if (!voteFor || !["challenger", "opponent"].includes(voteFor)) {
            return res.status(400).json({ message: "Invalid vote - must be 'challenger' or 'opponent'" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if already voted
        const existingVote = await dbGet(
            "SELECT 1 FROM battle_votes WHERE user_id = ? AND battle_id = ?",
            [user.id, battleId]
        );
        if (existingVote) {
            return res.status(400).json({ message: "Already voted" });
        }

        // Record the vote
        await dbRun(
            "INSERT INTO battle_votes (user_id, battle_id, vote_for) VALUES (?, ?, ?)",
            [user.id, battleId, voteFor]
        );

        // Update vote count
        if (voteFor === "challenger") {
            await dbRun("UPDATE hype_battles SET challenger_votes = challenger_votes + 1 WHERE id = ?", [battleId]);
        } else {
            await dbRun("UPDATE hype_battles SET opponent_votes = opponent_votes + 1 WHERE id = ?", [battleId]);
        }

        res.json({ message: "Vote recorded!" });
    } catch (err) {
        console.error("Vote error:", err);
        next(err);
    }
});

// Get user's vote for a battle
router.get("/hype-battles/:id/my-vote", async (req, res, next) => {
    try {
        const { email } = req.query;
        const battleId = req.params.id;

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email as string]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const vote = await dbGet(
            "SELECT vote_for FROM battle_votes WHERE user_id = ? AND battle_id = ?",
            [user.id, battleId]
        );

        res.json({ vote: vote?.vote_for || null });
    } catch (err) {
        console.error("Get vote error:", err);
        next(err);
    }
});

// Check battle status and determine winner if expired
router.post("/hype-battles/:id/check-status", async (req, res, next) => {
    try {
        const battleId = req.params.id;

        const battle = await dbGet("SELECT * FROM hype_battles WHERE id = ?", [battleId]);
        if (!battle) return res.status(404).json({ message: "Battle not found" });

        if (battle.status === "completed") {
            return res.json({ message: "Battle already completed", winner_id: battle.winner_id });
        }

        // Check if voting deadline has passed
        if (battle.voting_deadline && new Date() > new Date(battle.voting_deadline) && battle.status === "live") {
            let winnerId = null;
            
            if (battle.challenger_votes > battle.opponent_votes) {
                winnerId = battle.challenger_id;
            } else if (battle.opponent_votes > battle.challenger_votes) {
                winnerId = battle.opponent_id;
            }
            // Tie = no winner

            await dbRun(`
                UPDATE hype_battles SET status = 'completed', winner_id = ? WHERE id = ?
            `, [winnerId, battleId]);

            // Award coins to winner
            if (winnerId) {
                await dbRun("UPDATE users SET coins = coins + ? WHERE id = ?", [battle.reward_coins, winnerId]);
                await dbRun("UPDATE users SET xp = xp + 50 WHERE id = ?", [winnerId]); // Bonus XP
            }

            return res.json({ message: "Battle completed", winner_id: winnerId });
        }

        res.json({ status: battle.status, voting_deadline: battle.voting_deadline });
    } catch (err) {
        console.error("Check status error:", err);
        next(err);
    }
});

export default router;