function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  required,
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  /** Only this email may use the app, even if someone else gets a Supabase account. */
  isAllowedRecruiter(email: string | undefined | null) {
    const allowed = (process.env.RECRUITER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return !!email && allowed.includes(email.toLowerCase());
  },
  retentionDays: () => Number(process.env.RETENTION_DAYS ?? 180),
};
