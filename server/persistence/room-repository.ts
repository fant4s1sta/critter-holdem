export class RoomRevisionConflictError extends Error {
  constructor(code: string, expectedRev: number | null, actualRev: number) {
    super(
      `Room ${code} revision conflict: expected ${expectedRev ?? "missing"}, got ${actualRev}`,
    );
    this.name = "RoomRevisionConflictError";
  }
}

export interface VersionedSnapshot {
  rev: number;
}

export interface RoomRepository<T extends VersionedSnapshot> {
  get(code: string): Promise<T | null>;
  set(code: string, snapshot: T, expectedRev: number | null): Promise<void>;
  delete(code: string): Promise<void>;
  close(): Promise<void>;
}

export class MemoryRoomRepository<T extends VersionedSnapshot>
  implements RoomRepository<T>
{
  private readonly values = new Map<string, T>();

  async get(code: string): Promise<T | null> {
    const value = this.values.get(code.toUpperCase());
    return value ? structuredClone(value) : null;
  }

  async set(
    code: string,
    snapshot: T,
    expectedRev: number | null,
  ): Promise<void> {
    const key = code.toUpperCase();
    const current = this.values.get(key);
    const actualRev = current?.rev ?? 0;
    if (expectedRev !== null && actualRev !== expectedRev) {
      throw new RoomRevisionConflictError(key, expectedRev, actualRev);
    }
    if (expectedRev === null && current) {
      throw new RoomRevisionConflictError(key, null, actualRev);
    }
    this.values.set(key, structuredClone(snapshot));
  }

  async delete(code: string): Promise<void> {
    this.values.delete(code.toUpperCase());
  }

  async close(): Promise<void> {}
}
