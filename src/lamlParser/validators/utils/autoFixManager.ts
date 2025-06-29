/**
 * Manager for auto-fix messages with deduplication
 */
export class AutoFixManager {
  private fixes: Set<string> = new Set();

  /**
   * Add auto-fix message if it doesn't already exist
   */
  add(message: string): void {
    this.fixes.add(message);
  }

  /**
   * Get all unique auto-fix messages as array
   */
  getAll(): string[] {
    return Array.from(this.fixes);
  }

  /**
   * Check if a specific fix message exists
   */
  has(message: string): boolean {
    return this.fixes.has(message);
  }

  /**
   * Get count of unique fixes
   */
  count(): number {
    return this.fixes.size;
  }


} 