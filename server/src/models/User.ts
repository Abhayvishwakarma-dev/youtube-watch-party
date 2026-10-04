// ============================================================
//  server/src/models/User.ts
//
//  Mongoose model for authenticated users.
//
//  Design:
//    - Passwords stored as bcryptjs hashes (never plaintext)
//    - Email and username uniquely indexed (case-insensitive)
//    - `toPublic()` returns only safe fields (no passwordHash)
//    - Static helpers: findByEmail, findByUsername, findByEmailOrUsername
//
//  Used by:
//    - AuthService          → createUser, verifyCredentials
//    - authRoutes           → /api/auth/register, /login, /me
//    - authMiddleware       → loads req.user by decoded JWT userId
// ============================================================

import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

// ---------- Constants ----------
const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MIN_USERNAME_LENGTH = 2;
const MAX_USERNAME_LENGTH = 30;

// ---------- Interfaces ----------
/**
 * Fields stored on every user document.
 * `passwordHash` is the bcrypt hash — never returned to clients.
 */
export interface UserDoc extends Document {
    _id: mongoose.Types.ObjectId;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;

    /** Compare a plaintext password against the stored hash. */
    comparePassword(plaintext: string): Promise<boolean>;

    /** Safe-to-send representation — no passwordHash. */
    toPublic(): PublicUser;
}

/** Public shape returned by the API and included in JWTs. */
export interface PublicUser {
    userId: string;
    username: string;
    email: string;
}

// ---------- Schema ----------
const UserSchema = new Schema<UserDoc>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            minlength: MIN_USERNAME_LENGTH,
            maxlength: MAX_USERNAME_LENGTH,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false, // never load by default — must ask explicitly
        },
    },
    {
        collection: "users",
        timestamps: true, // adds createdAt + updatedAt automatically
    }
);

// ---------- Pre-save hook: hash password if modified ----------
// Note: we never store plaintext. The AuthService sets `passwordHash`
// to the plaintext temporarily, then the schema hashes it.
UserSchema.pre("save", async function (next) {
    const user = this as unknown as UserDoc & { isModified: (p: string) => boolean };

    if (!user.isModified("passwordHash")) return next();

    try {
        const plaintext = user.passwordHash;
        const hash = await bcrypt.hash(plaintext, SALT_ROUNDS);
        user.passwordHash = hash;
        next();
    } catch (err) {
        next(err as Error);
    }
});

// ---------- Instance methods ----------
UserSchema.methods.comparePassword = async function (
    this: UserDoc,
    plaintext: string
): Promise<boolean> {
    if (!plaintext || typeof plaintext !== "string") return false;
    if (!this.passwordHash) return false;
    return bcrypt.compare(plaintext, this.passwordHash);
};

UserSchema.methods.toPublic = function (this: UserDoc): PublicUser {
    return {
        userId: this._id.toString(),
        username: this.username,
        email: this.email,
    };
};

// ---------- Static helpers ----------
interface UserModelStatic extends Model<UserDoc> {
    findByEmail(email: string): Promise<UserDoc | null>;
    findByUsername(username: string): Promise<UserDoc | null>;
    findByEmailOrUsername(identifier: string): Promise<UserDoc | null>;
    findByUserId(userId: string): Promise<UserDoc | null>;
    usernameExists(username: string): Promise<boolean>;
    emailExists(email: string): Promise<boolean>;
}

UserSchema.statics.findByEmail = function (
    this: Model<UserDoc>,
    email: string
): Promise<UserDoc | null> {
    return this.findOne({ email: email.toLowerCase().trim() })
        .select("+passwordHash")
        .exec();
};

UserSchema.statics.findByUsername = function (
    this: Model<UserDoc>,
    username: string
): Promise<UserDoc | null> {
    return this.findOne({ username: username.trim() })
        .select("+passwordHash")
        .exec();
};

UserSchema.statics.findByEmailOrUsername = function (
    this: Model<UserDoc>,
    identifier: string
): Promise<UserDoc | null> {
    const trimmed = identifier.trim();
    const lower = trimmed.toLowerCase();

    return this.findOne({
        $or: [{ email: lower }, { username: trimmed }],
    })
        .select("+passwordHash")
        .exec();
};

UserSchema.statics.findByUserId = function (
    this: Model<UserDoc>,
    userId: string
): Promise<UserDoc | null> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return Promise.resolve(null);
    return this.findById(userId).exec();
};

UserSchema.statics.usernameExists = async function (
    this: Model<UserDoc>,
    username: string
): Promise<boolean> {
    const count = await this.countDocuments({ username: username.trim() });
    return count > 0;
};

UserSchema.statics.emailExists = async function (
    this: Model<UserDoc>,
    email: string
): Promise<boolean> {
    const count = await this.countDocuments({ email: email.toLowerCase().trim() });
    return count > 0;
};

// ---------- Model ----------
export const User = mongoose.model<UserDoc, UserModelStatic>("User", UserSchema);

// ---------- Validation helpers (used by AuthService) ----------
export function validateUsername(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (trimmed.length < MIN_USERNAME_LENGTH) return null;
    if (trimmed.length > MAX_USERNAME_LENGTH) return null;
    if (!/^[a-zA-Z0-9_ -]+$/.test(trimmed)) return null; // letters, digits, _, space, hyphen
    return trimmed;
}

export function validateEmail(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim().toLowerCase();
    // Simple, pragmatic regex — no need for RFC 5322 here.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
    if (trimmed.length > 254) return null;
    return trimmed;
}

export function validatePassword(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    if (raw.length < MIN_PASSWORD_LENGTH) return null;
    if (raw.length > MAX_PASSWORD_LENGTH) return null;
    return raw;
}

// ---------- Expose constants ----------
export const AUTH_LIMITS = {
    SALT_ROUNDS,
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_LENGTH,
    MIN_USERNAME_LENGTH,
    MAX_USERNAME_LENGTH,
} as const;