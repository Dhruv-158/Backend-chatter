const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    username: { 
        type: String, 
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: { 
        type: String, 
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false // Don't include password by default in queries
    },
    profilePicture: { 
        type: String, 
        default: '',
        trim: true
    },
    bio: { 
        type: String, 
        default: '',
        maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    role: {
        type: String,
        enum: ['user'],
        default: 'user'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: null
    },
    lastSeen: {
        type: Date,
        default: null
    },
    friends: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: { 
        type: Date, 
        default: Date.now,
        immutable: true
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true, // Automatically manage createdAt and updatedAt
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ friends: 1 }); // ✅ NEW: Index for friends array queries

// Virtual for user's full profile URL (example)
userSchema.virtual('profileUrl').get(function() {
    return `/users/${this._id}`;
});

// ✅ NEW: Virtual for friend count
userSchema.virtual('friendCount').get(function() {
    return this.friends ? this.friends.length : 0;
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Instance method to check if account is active
userSchema.methods.isAccountActive = function() {
    return this.isActive && this.isVerified;
};

// Static method to find active users
userSchema.statics.findActiveUsers = function() {
    return this.find({ isActive: true, isVerified: true });
};

module.exports = mongoose.model('User', userSchema);