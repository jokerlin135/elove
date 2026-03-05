/**
 * SupabaseAdminDb — wraps Supabase PostgREST REST API with a simple interface.
 * Used in tRPC context to replace direct PostgreSQL (Drizzle) connections that
 * fail from Vercel serverless due to DNS / pooler auth issues.
 */
export class SupabaseAdminDb {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceKey: string,
  ) {}

  private get headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      "Content-Type": "application/json",
    };
  }

  private buildQs(match: Record<string, unknown>): string {
    return Object.entries(match)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(String(v))}`)
      .join("&");
  }

  /** SELECT * FROM table WHERE match LIMIT 1 */
  async findFirst<T>(
    table: string,
    match: Record<string, unknown>,
  ): Promise<T | null> {
    const qs = this.buildQs(match);
    const res = await fetch(
      `${this.supabaseUrl}/rest/v1/${table}?${qs}&select=*&limit=1`,
      { headers: this.headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as T[];
    return rows[0] ?? null;
  }

  /** SELECT * FROM table WHERE match ORDER BY orderByDesc DESC */
  async findMany<T>(
    table: string,
    match: Record<string, unknown>,
    orderByDesc?: string,
  ): Promise<T[]> {
    const qs = this.buildQs(match);
    const order = orderByDesc ? `&order=${orderByDesc}.desc` : "";
    const res = await fetch(
      `${this.supabaseUrl}/rest/v1/${table}?${qs}&select=*${order}`,
      { headers: this.headers },
    );
    if (!res.ok) return [];
    return (await res.json()) as T[];
  }

  /** INSERT INTO table VALUES (data) */
  async insert(table: string, data: Record<string, unknown>): Promise<void> {
    await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify(data),
    });
  }

  /**
   * INSERT INTO table VALUES (data) ON CONFLICT DO NOTHING
   * Uses PostgREST resolution=ignore-duplicates
   */
  async insertIgnore(
    table: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(data),
    });
  }

  /**
   * INSERT INTO table VALUES (data) ON CONFLICT DO UPDATE SET data
   * Uses PostgREST resolution=merge-duplicates
   */
  async upsert(table: string, data: Record<string, unknown>): Promise<void> {
    await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(data),
    });
  }

  /** UPDATE table SET data WHERE match */
  async update(
    table: string,
    match: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<void> {
    const qs = this.buildQs(match);
    await fetch(`${this.supabaseUrl}/rest/v1/${table}?${qs}`, {
      method: "PATCH",
      headers: { ...this.headers, Prefer: "return=minimal" },
      body: JSON.stringify(data),
    });
  }
}
