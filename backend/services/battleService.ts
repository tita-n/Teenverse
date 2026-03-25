import { db } from "../database";
import {
    getUserByEmail,
    getHypeBattles,
    getBattleById,
    createBattle,
    respondToBattle,
    incrementBattleVotes,
    closeBattle,
    getExpiredBattles,
    getBattleWins,
    hasVotedForBattle,
    castBattleVote,
    getTeams,
    createTeam,
    isTeamMember,
    addTeamMember,
    getTeamById,
    addXp,
    addCoins,
    updateUser,
    getUserById,
} from "../db";
import { AppError } from "../middleware/errorHandler";

export async function fetchBattles(filters: { category?: string; isLive?: boolean }) {
    return getHypeBattles(db, filters);
}

export async function createNewBattle(data: {
    email: string;
    category: string;
    content: string;
    opponentId: number | null;
    teamId: number | null;
    opponentTeamId: number | null;
    isLive: boolean;
    mediaUrl: string | null;
}) {
    const user = await getUserByEmail(db, data.email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const votingDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const battle = await createBattle(db, {
        userId: user.id,
        username: user.username,
        opponentId: data.opponentId,
        teamId: data.teamId,
        opponentTeamId: data.opponentTeamId,
        category: data.category,
        content: data.content,
        mediaUrl: data.mediaUrl,
        isLive: data.isLive,
        votingDeadline,
    });

    return { message: "Battle created!", battleId: battle.id };
}

export async function respondBattle(data: {
    email: string;
    battleId: number;
    content: string;
    mediaUrl: string | null;
}) {
    const user = await getUserByEmail(db, data.email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const battle = await getBattleById(db, data.battleId);
    if (!battle) throw new AppError("Battle not found", 404, "BATTLE_NOT_FOUND");
    if (battle.closed) throw new AppError("Battle is closed", 400, "BATTLE_CLOSED");
    if (battle.opponent_id !== user.id) {
        throw new AppError("You are not the opponent for this battle", 403, "NOT_OPPONENT");
    }

    await respondToBattle(db, data.battleId, data.content, data.mediaUrl);
    return { message: "Response submitted!" };
}

export async function voteOnBattle(email: string, battleId: number, voteFor: "creator" | "opponent") {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const battle = await getBattleById(db, battleId);
    if (!battle) throw new AppError("Battle not found", 404, "BATTLE_NOT_FOUND");
    if (battle.closed) throw new AppError("Battle is closed", 400, "BATTLE_CLOSED");
    if (new Date(battle.voting_deadline) < new Date()) {
        throw new AppError("Voting has ended", 400, "VOTING_ENDED");
    }

    const alreadyVoted = await hasVotedForBattle(db, user.id, battleId);
    if (alreadyVoted) {
        throw new AppError("You already voted for this battle!", 400, "ALREADY_VOTED");
    }

    await castBattleVote(db, user.id, battleId, voteFor);
    await incrementBattleVotes(db, battleId, voteFor === "creator" ? "votes" : "opponent_votes");

    return { message: "Vote cast successfully!" };
}

export async function determineWinners() {
    const battles = await getExpiredBattles(db);
    const results: { battleId: number; winnerId: number | null }[] = [];

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

        await closeBattle(db, battle.id, winnerId || battle.team_id || null);

        if (winnerId) {
            await addCoins(db, winnerId, 50);
            const winner = await getUserById(db, winnerId);
            if (winner) {
                await updateUser(db, winnerId, {
                    wins: (winner.wins || 0) + 1,
                    tier: calculateTier(winner.wins + 1, winner.losses, winner.tier),
                });
            }

            if (loserId) {
                const loser = await getUserById(db, loserId);
                if (loser) {
                    await updateUser(db, loserId, {
                        losses: (loser.losses || 0) + 1,
                        tier: calculateTier(loser.wins, loser.losses + 1, loser.tier),
                    });
                }
            }

            // Award title
            const titleMap: Record<string, string> = {
                "Rap Battle": "Rap King",
                "Dance-off": "Dance Legend",
                "Meme Creation": "Meme Master",
                "Artistic Speed Drawing": "Art Ace",
                "Beat-making Face-off": "Beat Boss",
            };
            const title = titleMap[battle.category];
            if (title) {
                await db.run(`UPDATE users SET title = NULL WHERE title = ?`, [title]);
                await db.run(`UPDATE users SET title = ? WHERE id = ?`, [title, winnerId]);
            }
        }

        results.push({ battleId: battle.id, winnerId });
    }

    return results;
}

function calculateTier(wins: number, losses: number, currentTier: number): number {
    const winRate = wins / (wins + losses || 1);
    let newTier = currentTier;

    if (wins + losses >= 5) {
        if (winRate >= 0.7 && newTier < 5) {
            newTier += 1;
        } else if (winRate < 0.3 && newTier > 1) {
            newTier -= 1;
        }
    }

    return newTier;
}

// ============ Team Services ============

export async function fetchTeams() {
    return getTeams(db);
}

export async function createNewTeam(email: string, name: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const team = await createTeam(db, name, user.id);
    return { message: "Team created!", teamId: team.id };
}

export async function joinTeamByEmail(email: string, teamId: number) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const alreadyMember = await isTeamMember(db, teamId, user.id);
    if (alreadyMember) throw new AppError("Already a member of this team", 400, "ALREADY_MEMBER");

    await addTeamMember(db, teamId, user.id);
    return { message: "Joined team successfully!" };
}

// ============ Squad Services ============

export async function fetchGameSquads() {
    return getHypeBattles(db, {}); // This will need the squad equivalents from db.ts
}

export async function getBattleUserStats(email: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const wins = await getBattleWins(db, user.id);
    return { wins };
}
