import { AppError } from "./errorHandler";

// Validation helper functions
export function validateRequired(body: Record<string, any>, fields: string[]): void {
    for (const field of fields) {
        if (body[field] === undefined || body[field] === null || body[field] === "") {
            throw new AppError(`Field '${field}' is required`, 400, "VALIDATION_ERROR");
        }
    }
}

export function validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new AppError("Invalid email format", 400, "VALIDATION_ERROR");
    }
}

export function validateDOB(dob: string): void {
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dob)) {
        throw new AppError("Invalid date of birth format. Use YYYY-MM-DD.", 400, "VALIDATION_ERROR");
    }

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 13 || age > 19) {
        throw new AppError("Users must be between 13 and 19 years old", 400, "AGE_RESTRICTION");
    }
}

export function validateUsername(username: string): void {
    if (username.length < 3 || username.length > 20) {
        throw new AppError("Username must be between 3 and 20 characters", 400, "VALIDATION_ERROR");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new AppError("Username can only contain letters, numbers, and underscores", 400, "VALIDATION_ERROR");
    }
}

export function validatePassword(password: string): void {
    if (password.length < 6) {
        throw new AppError("Password must be at least 6 characters", 400, "VALIDATION_ERROR");
    }
}

export function validateCategory(category: string, validCategories: string[]): void {
    if (!validCategories.includes(category)) {
        throw new AppError(`Invalid category. Must be one of: ${validCategories.join(", ")}`, 400, "VALIDATION_ERROR");
    }
}

export function validateVoteTarget(voteFor: string): void {
    if (!["creator", "opponent"].includes(voteFor)) {
        throw new AppError("Invalid vote target. Must be 'creator' or 'opponent'", 400, "VALIDATION_ERROR");
    }
}

export function validateBattleStatus(status: string): void {
    if (!["open", "closed"].includes(status)) {
        throw new AppError("Invalid status. Must be 'open' or 'closed'", 400, "VALIDATION_ERROR");
    }
}

export function validatePositiveInteger(value: any, fieldName: string): number {
    const num = typeof value === "string" ? parseInt(value) : value;
    if (isNaN(num) || num <= 0) {
        throw new AppError(`${fieldName} must be a positive integer`, 400, "VALIDATION_ERROR");
    }
    return num;
}

export function validateReaction(reaction: string): void {
    const validReactions = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];
    if (!validReactions.includes(reaction)) {
        throw new AppError("Invalid reaction", 400, "VALIDATION_ERROR");
    }
}

export function validateRantCategory(category: string): void {
    const validCategories = [
        "School Life",
        "Family Drama",
        "Relationship Wahala",
        "Self-Doubt & Mental Struggles",
        "Fake Friends",
        "Pressure & Anxiety",
        "Just Need to Vent",
    ];
    validateCategory(category, validCategories);
}

export function validateBattleCategory(category: string): void {
    const validCategories = ["dance", "rap", "comedy", "other"];
    validateCategory(category, validCategories);
}
