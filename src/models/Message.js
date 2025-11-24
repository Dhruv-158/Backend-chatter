const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    receiver: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'document', 'audio', 'link'],
        default: 'text',
        required: true
    },
    // Text content
    content: {
        type: String,
        trim: true
    },
    // File/Media information
    fileUrl: {
        type: String,
        trim: true
    },
    fileName: {
        type: String,
        trim: true
    },
    fileSize: {
        type: Number // In bytes
    },
    mimeType: {
        type: String,
        trim: true
    },
    thumbnailUrl: {
        type: String,
        trim: true
    },
    duration: {
        type: Number // For audio/video in seconds
    },
    // Link preview metadata
    linkMetadata: {
        url: String,
        title: String,
        description: String,
        image: String,
        domain: String
    },
    // Message status
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for better query performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ receiver: 1, isRead: 1 });

// Static method to generate conversation ID (sorted to ensure consistency)
messageSchema.statics.generateConversationId = function(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
};

// Instance method to mark as read
messageSchema.methods.markAsRead = async function() {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
};

// Instance method to soft delete
messageSchema.methods.softDelete = async function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return await this.save();
};

module.exports = mongoose.model('Message', messageSchema);
