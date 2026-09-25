import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

dotenv.config();

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateReferralCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

// User schema definition for direct Mongoose access
const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: true },
    name: { type: String, trim: true },
    avatarUrl: { type: String },
    emailVerified: { type: Boolean, default: true },
    role: { type: String, enum: ['user', 'admin'], default: 'admin' },
    plan: { type: String, enum: ['free', 'pro', 'business'], default: 'business' },
    isActive: { type: Boolean, default: true },
    isWelcomed: { type: Boolean, default: true },
    creditsBalance: { type: Number, default: 500 },
    totalCreditsUsed: { type: Number, default: 0 },
    creditsResetAt: { type: Date, default: () => new Date() },
    referralCode: { type: String, required: true, unique: true },
    successfulReferralCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'users' }
);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  const positional: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...values] = arg.slice(2).split('=');
      parsed[key] = values.join('=');
    } else {
      positional.push(arg);
    }
  }

  const email =
    parsed.email ||
    positional[0] ||
    process.env.ADMIN_EMAIL ||
    'admin@blynta.com';

  const password =
    parsed.password ||
    positional[1] ||
    process.env.ADMIN_PASSWORD ||
    'admin@blynta84269713!';

  const name =
    parsed.name ||
    positional[2] ||
    process.env.ADMIN_NAME ||
    'Blynta Admin';

  return { email: email.toLowerCase().trim(), password, name: name.trim() };
}

async function createAdmin() {
  const { email, password, name } = parseArgs();

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

  const existingUser = await UserModel.findOne({ email });
  const hashedPassword = await bcrypt.hash(password, 10);

  if (existingUser) {
    console.log(`User with email "${email}" already exists. Promoting to Admin & updating password...`);

    existingUser.role = 'admin';
    existingUser.emailVerified = true;
    existingUser.isActive = true;
    existingUser.name = existingUser.name || name;
    existingUser.password = hashedPassword;

    await existingUser.save();

    console.log('\n==================================================');
    console.log('✓ Admin user updated successfully!');
    console.log('==================================================');
    console.log(`  ID:       ${existingUser._id}`);
    console.log(`  Email:    ${existingUser.email}`);
    console.log(`  Name:     ${existingUser.name}`);
    console.log(`  Role:     ${existingUser.role}`);
    console.log(`  Password: ${password}`);
    console.log('==================================================\n');
  } else {
    console.log(`Creating new Admin user for "${email}"...`);

    let referralCode = generateReferralCode();
    while (await UserModel.exists({ referralCode })) {
      referralCode = generateReferralCode();
    }

    const newUser = await UserModel.create({
      email,
      password: hashedPassword,
      name,
      role: 'admin',
      plan: 'business',
      creditsBalance: 500,
      emailVerified: true,
      isActive: true,
      isWelcomed: true,
      referralCode,
    });

    console.log('\n==================================================');
    console.log('✓ Admin user created successfully!');
    console.log('==================================================');
    console.log(`  ID:       ${newUser._id}`);
    console.log(`  Email:    ${newUser.email}`);
    console.log(`  Name:     ${newUser.name}`);
    console.log(`  Role:     ${newUser.role}`);
    console.log(`  Plan:     ${newUser.plan}`);
    console.log(`  Password: ${password}`);
    console.log('==================================================\n');
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('\n❌ Failed to create/update admin user:', err);
  process.exit(1);
});
