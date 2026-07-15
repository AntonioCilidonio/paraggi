import type { AdminClient } from "./http.ts";

export type TestPersona = {
  id: string;
  email: string;
  created: boolean;
};

const DISPLAY_NAME = "Marta Test";

async function loadMappedPersona(adminClient: AdminClient, ownerId: string): Promise<TestPersona | null> {
  const { data: mapping } = await adminClient
    .from("test_personas")
    .select("persona_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!mapping?.persona_id) return null;

  const { data } = await adminClient.auth.admin.getUserById(mapping.persona_id);
  const email = data.user?.email;
  if (!data.user || !email) {
    await adminClient.from("test_personas").delete().eq("owner_id", ownerId);
    return null;
  }

  return { id: data.user.id, email, created: false };
}

export async function getOrCreateTestPersona(adminClient: AdminClient, ownerId: string): Promise<TestPersona> {
  const mapped = await loadMappedPersona(adminClient, ownerId);
  if (mapped) return mapped;

  const email = `paraggi-test-${ownerId}@paraggi.local`;
  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password: `${crypto.randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: {
      display_name: DISPLAY_NAME,
      paraggi_test_persona: true,
      paraggi_test_owner_id: ownerId
    }
  });

  if (createUserError || !createdUser.user) {
    const raced = await loadMappedPersona(adminClient, ownerId);
    if (raced) return raced;
    throw new Error(`test_user_create_failed:${createUserError?.message ?? "missing_user"}`);
  }

  const personaId = createdUser.user.id;
  await adminClient.from("profiles").upsert({
    id: personaId,
    display_name: DISPLAY_NAME,
    bio: "Profilo automatico per testare interazioni e chat.",
    reputation_score: 27
  }, { onConflict: "id" });

  const { error: mappingError } = await adminClient.from("test_personas").insert({
    owner_id: ownerId,
    persona_id: personaId
  });

  if (mappingError) {
    const raced = await loadMappedPersona(adminClient, ownerId);
    if (raced) {
      await adminClient.auth.admin.deleteUser(personaId);
      return raced;
    }
    await adminClient.auth.admin.deleteUser(personaId);
    throw new Error(`test_persona_mapping_failed:${mappingError.message}`);
  }

  return { id: personaId, email, created: true };
}

export async function resetTestPersonaPassword(adminClient: AdminClient, personaId: string): Promise<string> {
  const password = `${crypto.randomUUID()}Aa1!`;
  const { error } = await adminClient.auth.admin.updateUserById(personaId, {
    password,
    email_confirm: true
  });
  if (error) throw new Error(`test_user_password_reset_failed:${error.message}`);
  return password;
}
