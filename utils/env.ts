import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ADMIN_PASSWORD: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_LIFF_ID: z.string().min(1),
    NEXT_PUBLIC_DEV_BYPASS_AUTH: z.string().optional(),
    NEXT_PUBLIC_DONATE_BANNER_ENABLED: z.string().optional(),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
    NEXT_PUBLIC_DEV_BYPASS_AUTH: process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH,
    NEXT_PUBLIC_DONATE_BANNER_ENABLED: process.env.NEXT_PUBLIC_DONATE_BANNER_ENABLED,
  },
});
