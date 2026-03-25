import bcrypt from "bcryptjs";
import { db } from "../database";
import {
    getUserByEmail,
    getUserByUsername,
    createUser,
    updateUserByEmail,
    getPublicUserProfile,
    addXp,
    addCoins,
    subtractCoins,
    getCoins,
    getUserById,
} from "../db";
import { AppError } from "../middleware/errorHandler";
import { generateToken } from "../middleware/auth";
import { JwtPayload } from "../types";

export async function registerUser(data: { email: string; username: string; password: string; dob: string }) {
    // Check existing user
    const existingEmail = await getUserByEmail(db, data.email);
    if (existingEmail) {
        throw new AppError("Email already exists", 400, "EMAIL_EXISTS");
    }

    const existingUsername = await getUserByUsername(db, data.username);
    if (existingUsername) {
        throw new AppError("Username already taken", 400, "USERNAME_TAKEN");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    await createUser(db, {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        dob: data.dob,
    });

    return { message: "Registered successfully!" };
}

export async function loginUser(email: string, password: string) {
    const user = await getUserByEmail(db, email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const payload: JwtPayload = {
        id: user.id,
        email: user.email,
        verified: user.verified,
        role: user.role || "user",
    };

    const token = generateToken(payload);

    return {
        token,
        message: "Login successful",
        username: user.username,
        id: user.id,
    };
}

export async function getCurrentUser(email: string) {
    const user = await getPublicUserProfile(db, (await getUserByEmail(db, email))?.username || email);
    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    return user;
}

export async function getUserStats(email: string) {
    const user = await getUserByEmail(db, email);
    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const { level, rank } = calculateLevel(user.xp);
    return { xp: user.xp, level, rank };
}

export async function getSnitchStatus(email: string) {
    const user = await getUserByEmail(db, email);
    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    return { snitchStatus: user.snitch_status || "clean" };
}

export async function claimDailyLogin(email: string) {
    const user = await getUserByEmail(db, email);
    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const today = new Date().toISOString().split("T")[0];

    if (user.last_login !== today) {
        const newXP = user.xp + 10;
        await updateUserByEmail(db, email, { xp: newXP, last_login: today });
        return { message: "+10 XP for daily login!", newXP };
    }

    return { message: "Already claimed XP today!" };
}

export async function awardPostRewards(user: any): Promise<{ xpBonus: number; coinBonus: number; newXP: number; newCoins: number }> {
    let xpBonus = 5;
    let coinBonus = 5;
    if (user.role === "admin") {
        xpBonus += 5;
        coinBonus += 5;
    }

    const newXP = user.xp + xpBonus;
    const newCoins = user.coins + coinBonus;

    await addXp(db, user.id, xpBonus);
    await addCoins(db, user.id, coinBonus);

    return { xpBonus, coinBonus, newXP, newCoins };
}

export function calculateLevel(xp: number): { level: number; rank: string } {
    let level = Math.floor(xp / 10) + 1;
    if (level > 100) level = 100;

    let rank = "Newbie";
    if (level >= 11) rank = "Rising Star";
    if (level >= 26) rank = "Clout Lord";
    if (level >= 51) rank = "Elite";
    if (level >= 76) rank = "Titan";
    if (level >= 100) rank = "Shadow Rank";

    return { level, rank };
}

export async function verifyUser(username: string, verify: boolean) {
    const user = await getUserByUsername(db, username);
    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    await updateUserByEmail(db, user.email, { verified: verify ? 1 : 0 });
    return { message: `User ${username} ${verify ? "verified" : "unverified"} successfully` };
}
