import 'reflect-metadata';
import { config } from 'dotenv';
import { ConfigService } from '@nestjs/config';
import mongoose, { Types } from 'mongoose';
import { CredentialVault } from '../src/ai-registry/credential-vault.service';
import {
  CredentialSchema,
  ModelSchema,
  ProviderSchema,
  RoutingSchema,
} from '../src/ai-registry/registry.schemas';
import { modelInput } from '../src/ai-registry/registry.contract';
import { UserRole, UserSchema } from '../src/users/schemas/user.schema';
import {
  ActivitySchema,
  ActivityActorType,
  ActivityCategory,
  ActivityType,
} from '../src/activities/schemas/activity.schema';

// Explicit operator command only. Never called by application startup.
async function main() {
  config({ quiet: true });
  const modelId = process.env.LLM_MODEL_NAME;
  if (!modelId || !/^gemini-[a-zA-Z0-9.-]{1,100}$/.test(modelId))
    throw new Error('Set a configured Gemini LLM_MODEL_NAME');
  const importSecret = process.argv.includes('--bootstrap-credential');
  const replace = process.argv.includes('--replace-credential');
  if (replace && !importSecret)
    throw new Error('Replacement requires explicit credential bootstrap');
  const actor = process.env.AI_BOOTSTRAP_ADMIN_ID;
  if (importSecret && (!actor || !Types.ObjectId.isValid(actor)))
    throw new Error('Set AI_BOOTSTRAP_ADMIN_ID for credential audit');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  if (
    importSecret &&
    !(await mongoose
      .model('User', UserSchema)
      .exists({ _id: actor, role: UserRole.ADMIN, isActive: true }))
  )
    throw new Error('Bootstrap audit actor must be an active administrator');
  const providers = mongoose.model('AIProvider', ProviderSchema),
    credentials = mongoose.model('AICredential', CredentialSchema),
    models = mongoose.model('AIModel', ModelSchema),
    routing = mongoose.model('AIRouting', RoutingSchema);
  await Promise.all([providers.init(), credentials.init(), models.init()]);
  const provider = await providers.findOneAndUpdate(
    { code: 'google' },
    {
      $setOnInsert: {
        code: 'google',
        name: 'Google Gemini',
        adapter: 'google',
        enabled: true,
      },
    },
    { upsert: true, new: true },
  );
  let credential = await credentials.findOne({
    providerId: String(provider._id),
    label: 'Environment bootstrap',
  });
  if (importSecret && (!credential || replace)) {
    const secret = process.env.LLM_API_KEY;
    if (!secret || secret.length < 12)
      throw new Error('LLM_API_KEY is required for explicit bootstrap');
    const id = credential?._id ?? new Types.ObjectId();
    const encrypted = new CredentialVault(
      new ConfigService(process.env),
    ).encrypt(secret, String(provider._id) + ':' + String(id));
    const activity = mongoose.model('Activity', ActivitySchema);
    await activity.create({
      userId: actor,
      actorId: actor,
      actorType: ActivityActorType.ADMIN,
      category: ActivityCategory.SYSTEM,
      type: ActivityType.SYSTEM_EVENT,
      title: 'AI credential bootstrap',
      entityType: 'ai_configuration',
      metadata: { recordId: String(id), replacement: replace },
    });
    credential = credential
      ? await credentials.findByIdAndUpdate(
          id,
          {
            $set: { ...encrypted, lastValidationStatus: 'unknown' },
            $inc: { revision: 1 },
          },
          { new: true },
        )
      : await credentials.findOneAndUpdate(
          { providerId: String(provider._id), label: 'Environment bootstrap' },
          {
            $setOnInsert: {
              _id: id,
              providerId: String(provider._id),
              label: 'Environment bootstrap',
              enabled: true,
              createdBy: actor,
              ...encrypted,
            },
          },
          { upsert: true, new: true },
        );
    await providers.updateOne(
      { _id: provider._id, defaultCredentialId: { $exists: false } },
      { $set: { defaultCredentialId: String(credential!._id) } },
    );
  }
  const spec = modelInput.parse({
    providerId: String(provider._id),
    modelId,
    displayName: modelId,
    enabled: false,
    tasks: ['highlight_detection', 'edit_planning', 'edit_refinement'],
    capabilities: {
      text: true,
      vision: false,
      audioInput: false,
      structuredOutput: true,
      toolCalling: false,
    },
    settings: { maxOutputTokens: 4096, timeoutMs: 30000, maxRetries: 0 },
    access: { allowedPlans: ['free', 'pro', 'business'], selectable: true },
    priority: 100,
  });
  const model = await models.findOneAndUpdate(
    { providerId: String(provider._id), modelId },
    { $setOnInsert: { ...spec, archived: false, lastTestStatus: 'unknown' } },
    { upsert: true, new: true },
  );
  await routing.updateOne(
    { _id: 'editing-default' },
    { $setOnInsert: { modelId: String(model._id), revision: 1 } },
    { upsert: true },
  );
  console.log(
    'Gemini registry seed complete. Model is not operational until tested and enabled by an administrator. Existing defaults and credentials were preserved unless replacement was explicitly requested.',
  );
}
main()
  .catch(() => {
    console.error(
      'AI registry seed failed. Check configuration, encryption keys and database access; sensitive error details are suppressed.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
