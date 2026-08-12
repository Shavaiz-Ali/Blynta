import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { AuthProviderConfigSchema } from '../src/auth/schemas/auth-provider-config.schema';
import { AuthProvider } from '../src/users/schemas/user.schema';

dotenv.config();

async function seed() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI is not defined in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const AuthProviderConfigModel = mongoose.model(
        'AuthProviderConfig',
        AuthProviderConfigSchema,
    );

    const providersToSeed = [
        { provider: AuthProvider.LOCAL, isEnabled: true },
        { provider: AuthProvider.GOOGLE, isEnabled: true },
        { provider: AuthProvider.FACEBOOK, isEnabled: true },
        { provider: AuthProvider.APPLE, isEnabled: false, disabledReason: 'Not yet implemented' },
        { provider: AuthProvider.GITHUB, isEnabled: false, disabledReason: 'Not yet implemented' },
    ];

    for (const config of providersToSeed) {
        const result = await AuthProviderConfigModel.findOneAndUpdate(
            { provider: config.provider },
            config,
            { upsert: true, new: true },
        );
        console.log(`Seeded: ${result.provider} -> isEnabled: ${result.isEnabled}`);
    }

    console.log('Seeding complete');
    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});