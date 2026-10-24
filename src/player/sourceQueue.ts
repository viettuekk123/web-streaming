/** Mỗi SourceBuffer có một hàng đợi. Promise chỉ xong khi updateend xảy ra. */
export class SourceQueue {
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(readonly buffer: SourceBuffer) {}

  private enqueue(action: () => void): Promise<void> {
    const task = this.tail.then(() => {
      if (this.disposed) throw new DOMException("Player đã đóng", "AbortError");
      return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.buffer.removeEventListener("updateend", success);
          this.buffer.removeEventListener("error", failure);
          this.buffer.removeEventListener("abort", failure);
        };
        const success = () => {
          cleanup();
          resolve();
        };
        const failure = () => {
          cleanup();
          reject(new Error("SourceBuffer không nhận được media"));
        };
        this.buffer.addEventListener("updateend", success, { once: true });
        this.buffer.addEventListener("error", failure, { once: true });
        this.buffer.addEventListener("abort", failure, { once: true });
        try {
          action();
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
    });
    this.tail = task.catch(() => {});
    return task;
  }

  append(data: ArrayBuffer): Promise<void> {
    return this.enqueue(() => this.buffer.appendBuffer(data));
  }

  remove(start: number, end: number): Promise<void> {
    return end > start
      ? this.enqueue(() => this.buffer.remove(start, end))
      : Promise.resolve();
  }

  idle(): Promise<void> {
    return this.tail;
  }
  dispose() {
    this.disposed = true;
  }
}
