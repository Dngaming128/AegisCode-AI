export class ReentrancyLock {
  private locked = false;

  acquire(): boolean {
    if (this.locked) {
      return false;
    }
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}
