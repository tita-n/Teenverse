import express from "express";
import { dbGet, dbAll, dbRun } from "../database";

export default function showdownRoutes(io: any) {
    const router = express.Router();

    // ============ SHOWDOWN TOURNAMENTS ============

    // Get all tournaments
    router.get("/", async (req, res, next) => {
        try {
            const tournaments = await dbAll(`
                SELECT st.*, u.username as winner_username
                FROM showdown_tournaments st
                LEFT JOIN users u ON st.winner_id = u.id
                ORDER BY st.created_at DESC
                LIMIT 20
            `);
            res.json(tournaments);
        } catch (err) {
            console.error("Get tournaments error:", err);
            next(err);
        }
    });

    // Get single tournament with participants
    router.get("/:id", async (req, res, next) => {
        try {
            const tournament = await dbGet(`
                SELECT st.*, u.username as winner_username
                FROM showdown_tournaments st
                LEFT JOIN users u ON st.winner_id = u.id
                WHERE st.id = ?
            `, [req.params.id]);

            if (!tournament) return res.status(404).json({ message: "Tournament not found" });

            const participants = await dbAll(`
                SELECT sp.*, u.username, u.profile_media_url, u.verified
                FROM showdown_participants sp
                JOIN users u ON sp.user_id = u.id
                WHERE sp.tournament_id = ?
                ORDER BY sp.votes DESC
            `, [req.params.id]);

            res.json({ ...tournament, participants });
        } catch (err) {
            console.error("Get tournament error:", err);
            next(err);
        }
    });

    // Create a new tournament
    router.post("/", async (req, res, next) => {
        try {
            const { email, title, description, bracketSize = 16, category, registrationDeadline, roundDuration = 24, rewardCoins = 1000 } = req.body;

            if (!email || !title || !category) {
                return res.status(400).json({ message: "Title and category required" });
            }

            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            let totalRounds = 1;
            if (bracketSize === 8) totalRounds = 3;
            else if (bracketSize === 16) totalRounds = 4;
            else if (bracketSize === 32) totalRounds = 5;

            const deadline = registrationDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const result = await dbRun(`
                INSERT INTO showdown_tournaments (title, description, bracket_size, category, status, registration_deadline, round_duration_hours, total_rounds, reward_coins)
                VALUES (?, ?, ?, ?, 'registration', ?, ?, ?, ?)
            `, [title, description || "", bracketSize, category, deadline.toISOString(), roundDuration, totalRounds, rewardCoins]);

            res.json({ message: "Tournament created!", tournamentId: result.lastID });
        } catch (err) {
            console.error("Create tournament error:", err);
            next(err);
        }
    });

    // Join a tournament
    router.post("/:id/join", async (req, res, next) => {
        try {
            const { email, mediaUrl, mediaType, content } = req.body;
            const tournamentId = req.params.id;

            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const tournament = await dbGet("SELECT * FROM showdown_tournaments WHERE id = ?", [tournamentId]);
            if (!tournament) return res.status(404).json({ message: "Tournament not found" });

            if (tournament.status !== "registration") {
                return res.status(400).json({ message: "Registration is closed" });
            }

            const existing = await dbGet(
                "SELECT 1 FROM showdown_participants WHERE tournament_id = ? AND user_id = ?",
                [tournamentId, user.id]
            );
            if (existing) return res.status(400).json({ message: "Already joined" });

            const participantCount = await dbGet("SELECT COUNT(*) as count FROM showdown_participants WHERE tournament_id = ?", [tournamentId]);
            if (participantCount && participantCount.count >= tournament.bracket_size) {
                return res.status(400).json({ message: "Tournament is full" });
            }

            await dbRun(`
                INSERT INTO showdown_participants (tournament_id, user_id, media_url, media_type, content, submitted_at, votes)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            `, [tournamentId, user.id, mediaUrl || "", mediaType || "", content || "", new Date().toISOString()]);

            // Emit to all connected clients
            if (io) {
                io.emit("showdown_participant_joined", { tournamentId, userId: user.id });
            }

            res.json({ message: "Joined tournament!" });
        } catch (err) {
            console.error("Join tournament error:", err);
            next(err);
        }
    });

    // Start tournament
    router.post("/:id/start", async (req, res, next) => {
        try {
            const tournamentId = req.params.id;

            const tournament = await dbGet("SELECT * FROM showdown_tournaments WHERE id = ?", [tournamentId]);
            if (!tournament) return res.status(404).json({ message: "Tournament not found" });

            if (tournament.status !== "registration") {
                return res.status(400).json({ message: "Tournament already started" });
            }

            const participants = await dbAll(
                "SELECT id, user_id FROM showdown_participants WHERE tournament_id = ?",
                [tournamentId]
            );

            if (participants.length < 2) return res.status(400).json({ message: "Need at least 2 participants" });

            const shuffled = participants.sort(() => Math.random() - 0.5);

            const roundResult = await dbRun(`
                INSERT INTO showdown_rounds (tournament_id, round_number, status)
                VALUES (?, 1, 'voting')
            `, [tournamentId]);

            const roundId = roundResult.lastID;

            for (let i = 0; i < shuffled.length; i += 2) {
                if (i + 1 < shuffled.length) {
                    await dbRun(`
                        INSERT INTO showdown_battles (round_id, participant1_id, participant2_id, status)
                        VALUES (?, ?, ?, 'live')
                    `, [roundId, shuffled[i].id, shuffled[i + 1].id]);
                } else {
                    await dbRun(`UPDATE showdown_participants SET status = 'winner' WHERE id = ?`, [shuffled[i].id]);
                }
            }

            const votingDeadline = new Date();
            votingDeadline.setHours(votingDeadline.getHours() + tournament.round_duration_hours);

            await dbRun(`UPDATE showdown_rounds SET voting_deadline = ? WHERE id = ?`, [votingDeadline.toISOString(), roundId]);
            await dbRun(`UPDATE showdown_tournaments SET status = 'live', current_round = 1 WHERE id = ?`, [tournamentId]);

            if (io) {
                io.emit("showdown_live_start", { tournamentId });
            }

            res.json({ message: "Tournament started!" });
        } catch (err) {
            console.error("Start tournament error:", err);
            next(err);
        }
    });

    // Get current round
    router.get("/:id/rounds", async (req, res, next) => {
        try {
            const tournamentId = req.params.id;
            
            const rounds = await dbAll(`
                SELECT * FROM showdown_rounds 
                WHERE tournament_id = ?
                ORDER BY round_number
            `, [tournamentId]);

            res.json(rounds);
        } catch (err) {
            console.error("Get rounds error:", err);
            next(err);
        }
    });

    // Get round battles
    router.get("/:id/rounds/:roundNumber", async (req, res, next) => {
        try {
            const { id: tournamentId, roundNumber } = req.params;

            const roundData = await dbGet(`
                SELECT * FROM showdown_rounds 
                WHERE tournament_id = ? AND round_number = ?
            `, [tournamentId, roundNumber]);

            if (!roundData) return res.status(404).json({ message: "Round not found" });

            const battles = await dbAll(`
                SELECT sb.*, 
                       p1.user_id as p1_user_id, u1.username as p1_username, p1.media_url as p1_media,
                       p2.user_id as p2_user_id, u2.username as p2_username, p2.media_url as p2_media
                FROM showdown_battles sb
                LEFT JOIN showdown_participants p1 ON sb.participant1_id = p1.id
                LEFT JOIN showdown_participants p2 ON sb.participant2_id = p2.id
                LEFT JOIN users u1 ON p1.user_id = u1.id
                LEFT JOIN users u2 ON p2.user_id = u2.id
                WHERE sb.round_id = ?
            `, [roundData.id]);

            res.json({ round: roundData, battles });
        } catch (err) {
            console.error("Get round error:", err);
            next(err);
        }
    });

    // Vote for participant
    router.post("/:id/vote", async (req, res, next) => {
        try {
            const { email, participantId } = req.body;
            const tournamentId = req.params.id;

            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            await dbRun("UPDATE showdown_participants SET votes = votes + 1 WHERE id = ?", [participantId]);

            if (io) {
                io.emit("showdown_vote_update", { tournamentId, participantId });
            }

            res.json({ message: "Vote recorded!" });
        } catch (err) {
            console.error("Vote error:", err);
            next(err);
        }
    });

    // Submit clip (keep original)
    router.post("/submit-clip", async (req, res, next) => {
        // Original implementation kept for compatibility
        try {
            res.json({ message: "Use tournament join endpoint instead" });
        } catch (err) {
            next(err);
        }
    });

    return router;
}