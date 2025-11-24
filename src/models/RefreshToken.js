const mongoose = require('mongoose');
const { Schema } = mongoose;

const refreshTokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 604800 // Auto-delete document after 7 days (in seconds)
    }
});

// Index for automatic cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient queries
refreshTokenSchema.index({ userId: 1, token: 1 });

// Static method to clean up expired tokens
refreshTokenSchema.statics.cleanupExpiredTokens = async function() {
    return this.deleteMany({ expiresAt: { $lt: Date.now() } });
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);