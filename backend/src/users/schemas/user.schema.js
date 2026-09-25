"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = exports.User = exports.LinkedAccountSchema = exports.LinkedAccount = exports.PLAN_CREDITS = exports.AuthProvider = exports.UserPlan = exports.UserRole = void 0;
var mongoose_1 = require("@nestjs/mongoose");
var mongoose_2 = require("mongoose");
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserPlan;
(function (UserPlan) {
    UserPlan["FREE"] = "free";
    UserPlan["PRO"] = "pro";
    UserPlan["BUSINESS"] = "business";
})(UserPlan || (exports.UserPlan = UserPlan = {}));
// Add new providers here ONLY — no other schema changes needed to support a new one
var AuthProvider;
(function (AuthProvider) {
    AuthProvider["LOCAL"] = "local";
    AuthProvider["GOOGLE"] = "google";
    AuthProvider["FACEBOOK"] = "facebook";
    AuthProvider["APPLE"] = "apple";
    AuthProvider["GITHUB"] = "github";
})(AuthProvider || (exports.AuthProvider = AuthProvider = {}));
exports.PLAN_CREDITS = (_a = {},
    _a[UserPlan.FREE] = 5,
    _a[UserPlan.PRO] = 50,
    _a[UserPlan.BUSINESS] = 200,
    _a);
// One linked external account — a user can have many of these, one per provider
var LinkedAccount = function () {
    var _classDecorators = [(0, mongoose_1.Schema)({ _id: false })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _provider_decorators;
    var _provider_initializers = [];
    var _provider_extraInitializers = [];
    var _providerId_decorators;
    var _providerId_initializers = [];
    var _providerId_extraInitializers = [];
    var _linkedAt_decorators;
    var _linkedAt_initializers = [];
    var _linkedAt_extraInitializers = [];
    var LinkedAccount = _classThis = /** @class */ (function () {
        function LinkedAccount_1() {
            this.provider = __runInitializers(this, _provider_initializers, void 0);
            this.providerId = (__runInitializers(this, _provider_extraInitializers), __runInitializers(this, _providerId_initializers, void 0)); // the stable ID that provider gives us (Google's "sub", Facebook's "id", etc.)
            this.linkedAt = (__runInitializers(this, _providerId_extraInitializers), __runInitializers(this, _linkedAt_initializers, void 0));
            __runInitializers(this, _linkedAt_extraInitializers);
        }
        return LinkedAccount_1;
    }());
    __setFunctionName(_classThis, "LinkedAccount");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _provider_decorators = [(0, mongoose_1.Prop)({ required: true, enum: AuthProvider })];
        _providerId_decorators = [(0, mongoose_1.Prop)({ required: true })];
        _linkedAt_decorators = [(0, mongoose_1.Prop)({ default: function () { return new Date(); } })];
        __esDecorate(null, null, _provider_decorators, { kind: "field", name: "provider", static: false, private: false, access: { has: function (obj) { return "provider" in obj; }, get: function (obj) { return obj.provider; }, set: function (obj, value) { obj.provider = value; } }, metadata: _metadata }, _provider_initializers, _provider_extraInitializers);
        __esDecorate(null, null, _providerId_decorators, { kind: "field", name: "providerId", static: false, private: false, access: { has: function (obj) { return "providerId" in obj; }, get: function (obj) { return obj.providerId; }, set: function (obj, value) { obj.providerId = value; } }, metadata: _metadata }, _providerId_initializers, _providerId_extraInitializers);
        __esDecorate(null, null, _linkedAt_decorators, { kind: "field", name: "linkedAt", static: false, private: false, access: { has: function (obj) { return "linkedAt" in obj; }, get: function (obj) { return obj.linkedAt; }, set: function (obj, value) { obj.linkedAt = value; } }, metadata: _metadata }, _linkedAt_initializers, _linkedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LinkedAccount = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LinkedAccount = _classThis;
}();
exports.LinkedAccount = LinkedAccount;
exports.LinkedAccountSchema = mongoose_1.SchemaFactory.createForClass(LinkedAccount);
var User = function () {
    var _classDecorators = [(0, mongoose_1.Schema)({ timestamps: true })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _password_decorators;
    var _password_initializers = [];
    var _password_extraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _avatarUrl_decorators;
    var _avatarUrl_initializers = [];
    var _avatarUrl_extraInitializers = [];
    var _emailVerified_decorators;
    var _emailVerified_initializers = [];
    var _emailVerified_extraInitializers = [];
    var _role_decorators;
    var _role_initializers = [];
    var _role_extraInitializers = [];
    var _linkedAccounts_decorators;
    var _linkedAccounts_initializers = [];
    var _linkedAccounts_extraInitializers = [];
    var _plan_decorators;
    var _plan_initializers = [];
    var _plan_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _isWelcomed_decorators;
    var _isWelcomed_initializers = [];
    var _isWelcomed_extraInitializers = [];
    var _creditsBalance_decorators;
    var _creditsBalance_initializers = [];
    var _creditsBalance_extraInitializers = [];
    var _totalCreditsUsed_decorators;
    var _totalCreditsUsed_initializers = [];
    var _totalCreditsUsed_extraInitializers = [];
    var _creditsResetAt_decorators;
    var _creditsResetAt_initializers = [];
    var _creditsResetAt_extraInitializers = [];
    var _lastLoginAt_decorators;
    var _lastLoginAt_initializers = [];
    var _lastLoginAt_extraInitializers = [];
    var _refreshTokenHash_decorators;
    var _refreshTokenHash_initializers = [];
    var _refreshTokenHash_extraInitializers = [];
    var _otpCode_decorators;
    var _otpCode_initializers = [];
    var _otpCode_extraInitializers = [];
    var _otpExpiresAt_decorators;
    var _otpExpiresAt_initializers = [];
    var _otpExpiresAt_extraInitializers = [];
    var _passwordResetToken_decorators;
    var _passwordResetToken_initializers = [];
    var _passwordResetToken_extraInitializers = [];
    var _passwordResetExpiresAt_decorators;
    var _passwordResetExpiresAt_initializers = [];
    var _passwordResetExpiresAt_extraInitializers = [];
    var _referralCode_decorators;
    var _referralCode_initializers = [];
    var _referralCode_extraInitializers = [];
    var _referredBy_decorators;
    var _referredBy_initializers = [];
    var _referredBy_extraInitializers = [];
    var _referralRewardGranted_decorators;
    var _referralRewardGranted_initializers = [];
    var _referralRewardGranted_extraInitializers = [];
    var _successfulReferralCount_decorators;
    var _successfulReferralCount_initializers = [];
    var _successfulReferralCount_extraInitializers = [];
    var _hasLoggedInOnce_decorators;
    var _hasLoggedInOnce_initializers = [];
    var _hasLoggedInOnce_extraInitializers = [];
    var User = _classThis = /** @class */ (function () {
        function User_1() {
            this.email = __runInitializers(this, _email_initializers, void 0);
            this.password = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _password_initializers, void 0)); // absent entirely for social-only accounts
            this.name = (__runInitializers(this, _password_extraInitializers), __runInitializers(this, _name_initializers, void 0));
            this.avatarUrl = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _avatarUrl_initializers, void 0));
            this.emailVerified = (__runInitializers(this, _avatarUrl_extraInitializers), __runInitializers(this, _emailVerified_initializers, void 0));
            this.role = (__runInitializers(this, _emailVerified_extraInitializers), __runInitializers(this, _role_initializers, void 0));
            // --- Auth: generic, extensible ---
            this.linkedAccounts = (__runInitializers(this, _role_extraInitializers), __runInitializers(this, _linkedAccounts_initializers, void 0));
            // --- Plan (fast path for feature gating — no join needed) ---
            this.plan = (__runInitializers(this, _linkedAccounts_extraInitializers), __runInitializers(this, _plan_initializers, void 0));
            this.isActive = (__runInitializers(this, _plan_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
            this.isWelcomed = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _isWelcomed_initializers, void 0));
            // --- Credits system ---
            this.creditsBalance = (__runInitializers(this, _isWelcomed_extraInitializers), __runInitializers(this, _creditsBalance_initializers, void 0));
            this.totalCreditsUsed = (__runInitializers(this, _creditsBalance_extraInitializers), __runInitializers(this, _totalCreditsUsed_initializers, void 0));
            this.creditsResetAt = (__runInitializers(this, _totalCreditsUsed_extraInitializers), __runInitializers(this, _creditsResetAt_initializers, void 0));
            // --- Security/auditing ---
            this.lastLoginAt = (__runInitializers(this, _creditsResetAt_extraInitializers), __runInitializers(this, _lastLoginAt_initializers, void 0));
            this.refreshTokenHash = (__runInitializers(this, _lastLoginAt_extraInitializers), __runInitializers(this, _refreshTokenHash_initializers, void 0));
            this.otpCode = (__runInitializers(this, _refreshTokenHash_extraInitializers), __runInitializers(this, _otpCode_initializers, void 0)); // hashed, never plain
            this.otpExpiresAt = (__runInitializers(this, _otpCode_extraInitializers), __runInitializers(this, _otpExpiresAt_initializers, void 0));
            this.passwordResetToken = (__runInitializers(this, _otpExpiresAt_extraInitializers), __runInitializers(this, _passwordResetToken_initializers, void 0)); // hashed
            this.passwordResetExpiresAt = (__runInitializers(this, _passwordResetToken_extraInitializers), __runInitializers(this, _passwordResetExpiresAt_initializers, void 0));
            this.referralCode = (__runInitializers(this, _passwordResetExpiresAt_extraInitializers), __runInitializers(this, _referralCode_initializers, void 0));
            this.referredBy = (__runInitializers(this, _referralCode_extraInitializers), __runInitializers(this, _referredBy_initializers, void 0));
            this.referralRewardGranted = (__runInitializers(this, _referredBy_extraInitializers), __runInitializers(this, _referralRewardGranted_initializers, void 0));
            this.successfulReferralCount = (__runInitializers(this, _referralRewardGranted_extraInitializers), __runInitializers(this, _successfulReferralCount_initializers, void 0));
            this.hasLoggedInOnce = (__runInitializers(this, _successfulReferralCount_extraInitializers), __runInitializers(this, _hasLoggedInOnce_initializers, void 0));
            __runInitializers(this, _hasLoggedInOnce_extraInitializers);
        }
        return User_1;
    }());
    __setFunctionName(_classThis, "User");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _email_decorators = [(0, mongoose_1.Prop)({ required: true, unique: true, lowercase: true, trim: true })];
        _password_decorators = [(0, mongoose_1.Prop)({ select: false })];
        _name_decorators = [(0, mongoose_1.Prop)({ trim: true })];
        _avatarUrl_decorators = [(0, mongoose_1.Prop)()];
        _emailVerified_decorators = [(0, mongoose_1.Prop)({ default: false })];
        _role_decorators = [(0, mongoose_1.Prop)({ enum: UserRole, default: UserRole.USER })];
        _linkedAccounts_decorators = [(0, mongoose_1.Prop)({ type: [exports.LinkedAccountSchema], default: [] })];
        _plan_decorators = [(0, mongoose_1.Prop)({ enum: UserPlan, default: UserPlan.FREE })];
        _isActive_decorators = [(0, mongoose_1.Prop)({ default: true })];
        _isWelcomed_decorators = [(0, mongoose_1.Prop)({ default: false })];
        _creditsBalance_decorators = [(0, mongoose_1.Prop)({ default: exports.PLAN_CREDITS[UserPlan.FREE] })];
        _totalCreditsUsed_decorators = [(0, mongoose_1.Prop)({ default: 0 })];
        _creditsResetAt_decorators = [(0, mongoose_1.Prop)({ default: function () { return new Date(); } })];
        _lastLoginAt_decorators = [(0, mongoose_1.Prop)()];
        _refreshTokenHash_decorators = [(0, mongoose_1.Prop)({ select: false })];
        _otpCode_decorators = [(0, mongoose_1.Prop)()];
        _otpExpiresAt_decorators = [(0, mongoose_1.Prop)()];
        _passwordResetToken_decorators = [(0, mongoose_1.Prop)()];
        _passwordResetExpiresAt_decorators = [(0, mongoose_1.Prop)()];
        _referralCode_decorators = [(0, mongoose_1.Prop)({ required: true, unique: true, index: true })];
        _referredBy_decorators = [(0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' })];
        _referralRewardGranted_decorators = [(0, mongoose_1.Prop)({ default: false })];
        _successfulReferralCount_decorators = [(0, mongoose_1.Prop)({ default: 0 })];
        _hasLoggedInOnce_decorators = [(0, mongoose_1.Prop)({ default: false })];
        __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
        __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } }, metadata: _metadata }, _password_initializers, _password_extraInitializers);
        __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
        __esDecorate(null, null, _avatarUrl_decorators, { kind: "field", name: "avatarUrl", static: false, private: false, access: { has: function (obj) { return "avatarUrl" in obj; }, get: function (obj) { return obj.avatarUrl; }, set: function (obj, value) { obj.avatarUrl = value; } }, metadata: _metadata }, _avatarUrl_initializers, _avatarUrl_extraInitializers);
        __esDecorate(null, null, _emailVerified_decorators, { kind: "field", name: "emailVerified", static: false, private: false, access: { has: function (obj) { return "emailVerified" in obj; }, get: function (obj) { return obj.emailVerified; }, set: function (obj, value) { obj.emailVerified = value; } }, metadata: _metadata }, _emailVerified_initializers, _emailVerified_extraInitializers);
        __esDecorate(null, null, _role_decorators, { kind: "field", name: "role", static: false, private: false, access: { has: function (obj) { return "role" in obj; }, get: function (obj) { return obj.role; }, set: function (obj, value) { obj.role = value; } }, metadata: _metadata }, _role_initializers, _role_extraInitializers);
        __esDecorate(null, null, _linkedAccounts_decorators, { kind: "field", name: "linkedAccounts", static: false, private: false, access: { has: function (obj) { return "linkedAccounts" in obj; }, get: function (obj) { return obj.linkedAccounts; }, set: function (obj, value) { obj.linkedAccounts = value; } }, metadata: _metadata }, _linkedAccounts_initializers, _linkedAccounts_extraInitializers);
        __esDecorate(null, null, _plan_decorators, { kind: "field", name: "plan", static: false, private: false, access: { has: function (obj) { return "plan" in obj; }, get: function (obj) { return obj.plan; }, set: function (obj, value) { obj.plan = value; } }, metadata: _metadata }, _plan_initializers, _plan_extraInitializers);
        __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
        __esDecorate(null, null, _isWelcomed_decorators, { kind: "field", name: "isWelcomed", static: false, private: false, access: { has: function (obj) { return "isWelcomed" in obj; }, get: function (obj) { return obj.isWelcomed; }, set: function (obj, value) { obj.isWelcomed = value; } }, metadata: _metadata }, _isWelcomed_initializers, _isWelcomed_extraInitializers);
        __esDecorate(null, null, _creditsBalance_decorators, { kind: "field", name: "creditsBalance", static: false, private: false, access: { has: function (obj) { return "creditsBalance" in obj; }, get: function (obj) { return obj.creditsBalance; }, set: function (obj, value) { obj.creditsBalance = value; } }, metadata: _metadata }, _creditsBalance_initializers, _creditsBalance_extraInitializers);
        __esDecorate(null, null, _totalCreditsUsed_decorators, { kind: "field", name: "totalCreditsUsed", static: false, private: false, access: { has: function (obj) { return "totalCreditsUsed" in obj; }, get: function (obj) { return obj.totalCreditsUsed; }, set: function (obj, value) { obj.totalCreditsUsed = value; } }, metadata: _metadata }, _totalCreditsUsed_initializers, _totalCreditsUsed_extraInitializers);
        __esDecorate(null, null, _creditsResetAt_decorators, { kind: "field", name: "creditsResetAt", static: false, private: false, access: { has: function (obj) { return "creditsResetAt" in obj; }, get: function (obj) { return obj.creditsResetAt; }, set: function (obj, value) { obj.creditsResetAt = value; } }, metadata: _metadata }, _creditsResetAt_initializers, _creditsResetAt_extraInitializers);
        __esDecorate(null, null, _lastLoginAt_decorators, { kind: "field", name: "lastLoginAt", static: false, private: false, access: { has: function (obj) { return "lastLoginAt" in obj; }, get: function (obj) { return obj.lastLoginAt; }, set: function (obj, value) { obj.lastLoginAt = value; } }, metadata: _metadata }, _lastLoginAt_initializers, _lastLoginAt_extraInitializers);
        __esDecorate(null, null, _refreshTokenHash_decorators, { kind: "field", name: "refreshTokenHash", static: false, private: false, access: { has: function (obj) { return "refreshTokenHash" in obj; }, get: function (obj) { return obj.refreshTokenHash; }, set: function (obj, value) { obj.refreshTokenHash = value; } }, metadata: _metadata }, _refreshTokenHash_initializers, _refreshTokenHash_extraInitializers);
        __esDecorate(null, null, _otpCode_decorators, { kind: "field", name: "otpCode", static: false, private: false, access: { has: function (obj) { return "otpCode" in obj; }, get: function (obj) { return obj.otpCode; }, set: function (obj, value) { obj.otpCode = value; } }, metadata: _metadata }, _otpCode_initializers, _otpCode_extraInitializers);
        __esDecorate(null, null, _otpExpiresAt_decorators, { kind: "field", name: "otpExpiresAt", static: false, private: false, access: { has: function (obj) { return "otpExpiresAt" in obj; }, get: function (obj) { return obj.otpExpiresAt; }, set: function (obj, value) { obj.otpExpiresAt = value; } }, metadata: _metadata }, _otpExpiresAt_initializers, _otpExpiresAt_extraInitializers);
        __esDecorate(null, null, _passwordResetToken_decorators, { kind: "field", name: "passwordResetToken", static: false, private: false, access: { has: function (obj) { return "passwordResetToken" in obj; }, get: function (obj) { return obj.passwordResetToken; }, set: function (obj, value) { obj.passwordResetToken = value; } }, metadata: _metadata }, _passwordResetToken_initializers, _passwordResetToken_extraInitializers);
        __esDecorate(null, null, _passwordResetExpiresAt_decorators, { kind: "field", name: "passwordResetExpiresAt", static: false, private: false, access: { has: function (obj) { return "passwordResetExpiresAt" in obj; }, get: function (obj) { return obj.passwordResetExpiresAt; }, set: function (obj, value) { obj.passwordResetExpiresAt = value; } }, metadata: _metadata }, _passwordResetExpiresAt_initializers, _passwordResetExpiresAt_extraInitializers);
        __esDecorate(null, null, _referralCode_decorators, { kind: "field", name: "referralCode", static: false, private: false, access: { has: function (obj) { return "referralCode" in obj; }, get: function (obj) { return obj.referralCode; }, set: function (obj, value) { obj.referralCode = value; } }, metadata: _metadata }, _referralCode_initializers, _referralCode_extraInitializers);
        __esDecorate(null, null, _referredBy_decorators, { kind: "field", name: "referredBy", static: false, private: false, access: { has: function (obj) { return "referredBy" in obj; }, get: function (obj) { return obj.referredBy; }, set: function (obj, value) { obj.referredBy = value; } }, metadata: _metadata }, _referredBy_initializers, _referredBy_extraInitializers);
        __esDecorate(null, null, _referralRewardGranted_decorators, { kind: "field", name: "referralRewardGranted", static: false, private: false, access: { has: function (obj) { return "referralRewardGranted" in obj; }, get: function (obj) { return obj.referralRewardGranted; }, set: function (obj, value) { obj.referralRewardGranted = value; } }, metadata: _metadata }, _referralRewardGranted_initializers, _referralRewardGranted_extraInitializers);
        __esDecorate(null, null, _successfulReferralCount_decorators, { kind: "field", name: "successfulReferralCount", static: false, private: false, access: { has: function (obj) { return "successfulReferralCount" in obj; }, get: function (obj) { return obj.successfulReferralCount; }, set: function (obj, value) { obj.successfulReferralCount = value; } }, metadata: _metadata }, _successfulReferralCount_initializers, _successfulReferralCount_extraInitializers);
        __esDecorate(null, null, _hasLoggedInOnce_decorators, { kind: "field", name: "hasLoggedInOnce", static: false, private: false, access: { has: function (obj) { return "hasLoggedInOnce" in obj; }, get: function (obj) { return obj.hasLoggedInOnce; }, set: function (obj, value) { obj.hasLoggedInOnce = value; } }, metadata: _metadata }, _hasLoggedInOnce_initializers, _hasLoggedInOnce_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        User = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return User = _classThis;
}();
exports.User = User;
exports.UserSchema = mongoose_1.SchemaFactory.createForClass(User);
// Ensures the same provider+providerId pair can't be linked to two different users,
// while still allowing many different providers per user.
exports.UserSchema.index({ 'linkedAccounts.provider': 1, 'linkedAccounts.providerId': 1 }, { unique: true, sparse: true });
