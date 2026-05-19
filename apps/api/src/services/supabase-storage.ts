import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { config } from "../config.js";

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return client;
}

export async function uploadToSupabase(
  localPath: string,
  remotePath: string
): Promise<string | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const buffer = await readFile(localPath);
  const { error } = await supabase.storage
    .from(config.supabaseBucket)
    .upload(remotePath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload failed:", error.message);
    return null;
  }

  const { data } = supabase.storage
    .from(config.supabaseBucket)
    .getPublicUrl(remotePath);

  return data.publicUrl;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseKey);
}
