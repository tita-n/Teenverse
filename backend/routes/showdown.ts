import express from "express";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";

export default function showdownRoutes(io: any) {
    const router = express.Router();

    // Vote for showdown date
    router.post("/vote-showdown", async (req, res, next) => {
        try {
            const { email, dateOption } = req.body;
            if (req.user.email !== email) {
                return res.status(403).json({ message: "Unauthorized" });
            }

            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const existingVote = await dbGet("SELECT id FROM showdown_votes WHERE user_id = ?", [user.id]);
            if (existingVote) {
                return res.status(400).json({ message: "You have already voted!" });
            }

            await dbRun("INSERT INTO showdown_votes (user_id, date_option) VALUES (?, ?)", [user.id, dateOption]);
            res.json({ message: "Vote recorded!" });
        } catch (err) {
            console.error("Vote showdown error:", err);
            next(err);
        }
    });

    // Determine showdown date from votes
    router.get("/determine-showdown-date", async (req, res, next) => {
        try {
            const result = await dbGet<{ date_option: string; votes: number }>(
                "SELECT date_option, COUNT(*) as votes FROM showdown_votes GROUP BY date_option ORDER BY votes DESC LIMIT 1"
            );

            if (result) {
                await dbRun("INSERT INTO showdown_schedule (date) VALUES (?)", [result.date_option]);
                res.json({ message: `Next battle scheduled for ${result.date_option}!` });
            } else {
                res.json({ message: "No votes yet." });
            }
        } catch (err) {
            console.error("Determine showdown date error:", err);
            next(err);
        }
    });

    // Get showdown date
    router.get("/showdown-date", async (req, res, next) => {
        try {
            const schedule = await dbGet("SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1");
            if (!schedule) {
                return res.status(404).json({ message: "No showdown date scheduled yet" });
            }
            res.json({ date: schedule.date });
        } catch (err) {
            console.error("Showdown date error:", err);
            next(err);
        }
    });

    // POST qualify - invite to showdown
    router.post("/ultimate-showdown/qualify", async (req, res, next) => {
        try {
            const { email } = req.body;
            if (req.user.email !== email) {
                return res.status(403).json({ message: "Unauthorized" });
            }

            const user = await dbGet("SELECT id, username, wins, tier FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const battleWins = await dbGet<{ wins: number }>(
                "SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1",
                [user.id]
            );

            if ((battleWins?.wins || 0) < 3) {
                return res.status(400).json({ message: "You need at least 3 Hype Battle wins to qualify" });
            }

            const existingParticipant = await dbGet("SELECT * FROM showdown_participants WHERE user_id = ?", [user.id]);
            if (existingParticipant) {
                return res.status(400).json({ message: "You are already invited to the Ultimate Showdown" });
            }

            const currentTournament = await dbGet("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
            if (!currentTournament) {
                return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
            }

            await dbRun(
                "INSERT INTO showdown_participants (tournament_id, user_id, status) VALUES (?, ?, ?)",
                [currentTournament.id, user.id, "invited"]
            );

            res.json({ message: "You have been invited to the Ultimate Showdown!" });
        } catch (err) {
            console.error("Qualify error:", err);
            next(err);
        }
    });

    // GET qualify - check qualification status
    router.get("/ultimate-showdown/qualify", async (req, res, next) => {
        try {
            const user = await dbGet("SELECT * FROM users WHERE email = ?", [req.user.email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const battleWins = await dbGet<{ wins: number }>(
                "SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1",
                [user.id]
            );

            const wins = battleWins?.wins || 0;
            const canParticipate = wins >= 3;

            const currentTournament = await dbGet("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
            if (!currentTournament) {
                return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
            }

            const participant = await dbGet(
                "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ?",
                [currentTournament.id, user.id]
            );

            res.json({
                canView: true,
                canParticipate,
                alreadyJoined: !!participant,
                tournamentId: currentTournament.id,
                wins,
            });
        } catch (err) {
            console.error("Qualify error:", err);
            next(err);
        }
    });

    // GET bracket
    router.get("/ultimate-showdown/bracket", async (req, res, next) => {
        try {
            const tournament = await dbGet("SELECT * FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
            if (!tournament) {
                return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
            }

            const participants = await dbAll(
                "SELECT sp.*, u.username FROM showdown_participants sp JOIN users u ON sp.user_id = u.id WHERE sp.tournament_id = ? AND sp.status = 'active'",
                [tournament.id]
            );

            res.json({ tournament, participants });
        } catch (err) {
            console.error("Bracket fetch error:", err);
            next(err);
        }
    });

    // POST start-live (admin only)
    router.post("/ultimate-showdown/start-live", async (req, res, next) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Only the platform creator can start the live event" });
            }

            const { tournamentId } = req.body;
            const tournament = await dbGet("SELECT status, start_date FROM showdown_tournaments WHERE id = ?", [tournamentId]);
            if (!tournament) return res.status(404).json({ message: "Tournament not found" });
            if (tournament.status !== "open") return res.status(400).json({ message: "Tournament is not open" });
            if (new Date(tournament.start_date) > new Date()) return res.status(400).json({ message: "Tournament has not started yet" });

            await dbRun("UPDATE showdown_tournaments SET status = 'live' WHERE id = ?", [tournamentId]);
            io.emit("showdown_live_start", { tournamentId });
            res.json({ message: "Live event started!" });
        } catch (err) {
            console.error("Start live error:", err);
            next(err);
        }
    });

    // POST boost
    router.post("/ultimate-showdown/boost", async (req, res, next) => {
        try {
            const { email, tournamentId, targetUserId, coins } = req.body;
            if (req.user.email !== email) {
                return res.status(403).json({ message: "Unauthorized" });
            }

            const result = await withTransaction(async () => {
                const user = await dbGet<{ id: number; coins: number }>("SELECT id, coins FROM users WHERE email = ?", [email]);
                if (!user) throw new Error("USER_NOT_FOUND");
                if (user.coins < coins) throw new Error("INSUFFICIENT_COINS");

                await dbRun("UPDATE users SET coins = coins - ? WHERE id = ?", [coins, user.id]);
                await dbRun(
                    "INSERT INTO showdown_boosts (tournament_id, user_id, target_user_id, coins_spent) VALUES (?, ?, ?, ?)",
                    [tournamentId, user.id, targetUserId, coins]
                );

                return { newCoins: user.coins - coins };
            });

            io.emit("showdown_boost_update", { tournamentId, targetUserId, coins });
            res.json({ message: `Boosted ${coins} coins!`, newCoins: result.newCoins });
        } catch (err: any) {
            const errorMap: Record<string, { status: number; message: string }> = {
                USER_NOT_FOUND: { status: 404, message: "User not found" },
                INSUFFICIENT_COINS: { status: 400, message: "Insufficient coins" },
            };
            const mapped = errorMap[err.message];
            if (mapped) return res.status(mapped.status).json({ message: mapped.message });
            next(err);
        }
    });

    // POST end showdown (admin only)
    router.post("/ultimate-showdown/end", async (req, res, next) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Only the platform creator can end the event" });
            }

            const { tournamentId, winnerId } = req.body;
            const tournament = await dbGet("SELECT status FROM showdown_tournaments WHERE id = ?", [tournamentId]);
            if (!tournament) return res.status(404).json({ message: "Tournament not found" });
            if (tournament.status !== "live") return res.status(400).json({ message: "Tournament is not live" });

            await withTransaction(async () => {
                await dbRun("UPDATE showdown_tournaments SET status = 'completed', winner_id = ? WHERE id = ?", [winnerId, tournamentId]);
                await dbRun("INSERT OR IGNORE INTO profile_borders (user_id, border_style) VALUES (?, ?)", [winnerId, "LegendaryGold"]);
                await dbRun("UPDATE users SET coins = coins + 1000, legend_status = 'Ultimate Champion' WHERE id = ?", [winnerId]);
                await dbRun("INSERT OR IGNORE INTO hall_of_fame (user_id, tournament_id, rank) VALUES (?, ?, 1)", [winnerId, tournamentId]);
            });

            io.emit("showdown_end", { tournamentId, winnerId });
            res.json({ message: "Ultimate Showdown completed!" });
        } catch (err) {
            console.error("End showdown error:", err);
            next(err);
        }
    });

    // POST submit-clip
    router.post("/submit-clip", async (req, res, next) => {
        try {
            const { email, clipUrl, category } = req.body;
            if (req.user.email !== email) {
                return res.status(403).json({ message: "Unauthorized" });
            }

            const user = await dbGet("SELECT id, username FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const battleWins = await dbGet<{ wins: number }>(
                "SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1",
                [user.id]
            );

            if ((battleWins?.wins || 0) < 3) {
                return res.status(400).json({ message: "You need at least 3 Hype Battle wins to submit a clip" });
            }

            const currentTournament = await dbGet("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
            if (!currentTournament) {
                return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
            }

            const isParticipant = await dbGet(
                "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ? AND status = 'active'",
                [currentTournament.id, user.id]
            );
            if (!isParticipant) {
                return res.status(400).json({ message: "You are not an active participant" });
            }

            // Check if today is the showdown day
            const schedule = await dbGet("SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1");
            if (!schedule) {
                return res.status(400).json({ message: "Showdown date not set" });
            }
            const today = new Date().toISOString().split("T")[0];
            if (today !== schedule.date) {
                return res.status(400).json({ message: "You can only submit clips on the showdown day" });
            }

            // Check existing clip
            const existingClip = await dbGet(
                "SELECT * FROM showdown_clips WHERE user_id = ? AND tournament_id = ? AND category = ?",
                [user.id, currentTournament.id, category]
            );
            if (existingClip) {
                return res.status(400).json({ message: "You have already submitted a clip in this category" });
            }

            await dbRun(
                "INSERT INTO showdown_clips (tournament_id, user_id, username, clip_url, category) VALUES (?, ?, ?, ?, ?)",
                [currentTournament.id, user.id, user.username, clipUrl, category]
            );

            const newClip = await dbGet(
                "SELECT id, user_id, username, clip_url as url, category FROM showdown_clips WHERE user_id = ? AND tournament_id = ? AND category = ?",
                [user.id, currentTournament.id, category]
            );

            io.emit("showdown_clip_update", { clip: newClip });
            res.json({ message: "Clip submitted successfully!" });
        } catch (err) {
            console.error("Submit clip error:", err);
            next(err);
        }
    });

    // GET showdown-clips
    router.get("/showdown-clips", async (req, res, next) => {
        try {
            const currentTournament = await dbGet("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
            if (!currentTournament) {
                return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
            }

            const clips = await dbAll(
                "SELECT id, user_id, username, clip_url as url, category FROM showdown_clips WHERE tournament_id = ?",
                [currentTournament.id]
            );

            res.json({ clips });
        } catch (err) {
            console.error("Fetch clips error:", err);
            next(err);
        }
    });

    // POST vote-clip
    router.post("/vote-clip", async (req, res, next) => {
        try {
            const { email, clipId, category } = req.body;
            if (req.user.email !== email) {
                return res.status(403).json({ message: "Unauthorized" });
            }

            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            // Check if today is the showdown day
            const schedule = await dbGet("SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1");
            if (!schedule) {
                return res.status(400).json({ message: "Showdown date not set" });
            }
            const today = new Date().toISOString().split("T")[0];
            if (today !== schedule.date) {
                return res.status(400).json({ message: "You can only vote on the showdown day" });
            }

            // Check if user is a participant (participants can't vote)
            const currentTournament = await dbGet("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1");
            if (!currentTournament) {
                return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
            }

            const isParticipant = await dbGet(
                "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ? AND status = 'active'",
                [currentTournament.id, user.id]
            );
            if (isParticipant) {
                return res.status(400).json({ message: "Participants cannot vote in the Ultimate Showdown" });
            }

            // Check if clip exists
            const clip = await dbGet("SELECT id FROM showdown_clips WHERE id = ?", [clipId]);
            if (!clip) {
                return res.status(404).json({ message: "Clip not found" });
            }

            // Check if user already voted in this category
            const existingVote = await dbGet(
                "SELECT id FROM showdown_clip_votes WHERE user_id = ? AND category = ?",
                [user.id, category]
            );
            if (existingVote) {
                return res.status(400).json({ message: "You have already voted in this category" });
            }

            await dbRun("INSERT INTO showdown_clip_votes (user_id, clip_id, category) VALUES (?, ?, ?)", [user.id, clipId, category]);
            res.json({ message: "Vote submitted successfully!" });
        } catch (err) {
            console.error("Vote clip error:", err);
            next(err);
        }
    });

    // GET user-vote-status
    router.get("/user-vote-status", async (req, res, next) => {
        try {
            const user = await dbGet("SELECT id FROM users WHERE email = ?", [req.user.email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const votes = await dbAll("SELECT category FROM showdown_clip_votes WHERE user_id = ?", [user.id]);
            const hasVoted: Record<string, boolean> = {};
            for (const vote of votes) {
                hasVoted[vote.category] = true;
            }

            res.json({ hasVoted });
        } catch (err) {
            console.error("Vote status error:", err);
            next(err);
        }
    });

    return router;
}
