"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose = require("mongoose");
var dotenv = require("dotenv");
var bcrypt = require("bcrypt");
var user_schema_1 = require("../src/users/schemas/user.schema");
var generate_referral_code_1 = require("../src/users/utils/generate-referral-code");
dotenv.config();
// Helper to parse CLI arguments (e.g. --email=foo@bar.com or positional arguments)
function parseArgs() {
    var args = process.argv.slice(2);
    var parsed = {};
    var positional = [];
    for (var _i = 0, args_1 = args; _i < args_1.length; _i++) {
        var arg = args_1[_i];
        if (arg.startsWith('--')) {
            var _a = arg.slice(2).split('='), key = _a[0], values = _a.slice(1);
            parsed[key] = values.join('=');
        }
        else {
            positional.push(arg);
        }
    }
    var email = parsed.email ||
        positional[0] ||
        process.env.ADMIN_EMAIL ||
        'admin@blynta.com';
    var password = parsed.password ||
        positional[1] ||
        process.env.ADMIN_PASSWORD ||
        'admin@blynta84269713!';
    var name = parsed.name ||
        positional[2] ||
        process.env.ADMIN_NAME ||
        'Blynta Admin';
    return { email: email.toLowerCase().trim(), password: password, name: name.trim() };
}
function createAdmin() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, email, password, name, mongoUri, UserModel, existingUser, hashedPassword, referralCode, newUser;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = parseArgs(), email = _a.email, password = _a.password, name = _a.name;
                    mongoUri = process.env.MONGO_URI;
                    if (!mongoUri) {
                        throw new Error('MONGO_URI is not defined in .env');
                    }
                    console.log('Connecting to MongoDB...');
                    return [4 /*yield*/, mongoose.connect(mongoUri)];
                case 1:
                    _b.sent();
                    console.log('Connected to MongoDB.\n');
                    UserModel = mongoose.model('User', user_schema_1.UserSchema);
                    return [4 /*yield*/, UserModel.findOne({ email: email })];
                case 2:
                    existingUser = _b.sent();
                    return [4 /*yield*/, bcrypt.hash(password, 10)];
                case 3:
                    hashedPassword = _b.sent();
                    if (!existingUser) return [3 /*break*/, 5];
                    console.log("User with email \"".concat(email, "\" already exists. Updating to Admin..."));
                    existingUser.role = user_schema_1.UserRole.ADMIN;
                    existingUser.emailVerified = true;
                    existingUser.isActive = true;
                    existingUser.name = existingUser.name || name;
                    existingUser.password = hashedPassword;
                    return [4 /*yield*/, existingUser.save()];
                case 4:
                    _b.sent();
                    console.log('\n========================================');
                    console.log('✓ Admin user updated successfully!');
                    console.log('========================================');
                    console.log("  ID:       ".concat(existingUser._id));
                    console.log("  Email:    ".concat(existingUser.email));
                    console.log("  Name:     ".concat(existingUser.name));
                    console.log("  Role:     ".concat(existingUser.role));
                    console.log("  Password: ".concat(password));
                    console.log('========================================\n');
                    return [3 /*break*/, 10];
                case 5:
                    console.log("Creating new Admin user for \"".concat(email, "\"..."));
                    referralCode = (0, generate_referral_code_1.generateReferralCode)();
                    _b.label = 6;
                case 6: return [4 /*yield*/, UserModel.exists({ referralCode: referralCode })];
                case 7:
                    if (!_b.sent()) return [3 /*break*/, 8];
                    referralCode = (0, generate_referral_code_1.generateReferralCode)();
                    return [3 /*break*/, 6];
                case 8: return [4 /*yield*/, UserModel.create({
                        email: email,
                        password: hashedPassword,
                        name: name,
                        role: user_schema_1.UserRole.ADMIN,
                        plan: user_schema_1.UserPlan.BUSINESS,
                        creditsBalance: 500,
                        emailVerified: true,
                        isActive: true,
                        isWelcomed: true,
                        referralCode: referralCode,
                    })];
                case 9:
                    newUser = _b.sent();
                    console.log('\n========================================');
                    console.log('✓ Admin user created successfully!');
                    console.log('========================================');
                    console.log("  ID:       ".concat(newUser._id));
                    console.log("  Email:    ".concat(newUser.email));
                    console.log("  Name:     ".concat(newUser.name));
                    console.log("  Role:     ".concat(newUser.role));
                    console.log("  Plan:     ".concat(newUser.plan));
                    console.log("  Password: ".concat(password));
                    console.log('========================================\n');
                    _b.label = 10;
                case 10: return [4 /*yield*/, mongoose.disconnect()];
                case 11:
                    _b.sent();
                    console.log('Disconnected from MongoDB.');
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
createAdmin().catch(function (err) {
    console.error('\n❌ Failed to create/update admin user:', err);
    process.exit(1);
});
