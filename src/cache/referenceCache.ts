export class ReferenceCache<T> {
  private readonly values = new Map<string, T>();
  private hits = 0;
  private misses = 0;

  public get(key: string): T | undefined {
    const value = this.values.get(key);
    if (value === undefined) this.misses += 1;
    else this.hits += 1;
    return value;
  }

  public set(key: string, value: T): void {
    this.values.set(key, value);
  }

  public invalidateUri(uri: string): void {
    for (const key of this.values.keys()) if (key.startsWith(`${uri}#`)) this.values.delete(key);
  }

  public clear(): void {
    this.values.clear();
  }

  public stats(): { readonly size: number; readonly hits: number; readonly misses: number } {
    return { size: this.values.size, hits: this.hits, misses: this.misses };
  }
}
