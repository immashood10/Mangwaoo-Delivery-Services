// Navigation is recorded from user actions, never from WebView load callbacks.
// Android can deliver those callbacks late after a document was cancelled.
export class AppHistory {
  private pages: string[];
  private origin: string;

  constructor(initialUrl: string) {
    const initial = new URL(initialUrl);
    this.origin = initial.origin;
    this.pages = [initial.href];
  }

  private normalize(value: string) {
    try {
      const target = new URL(value, this.origin);
      return target.origin === this.origin ? target.href : null;
    } catch { return null; }
  }

  visit(value: string) {
    const target = this.normalize(value);
    if (target && this.pages[this.pages.length - 1] !== target) this.pages.push(target);
  }

  replace(value: string) {
    const target = this.normalize(value);
    if (target) this.pages[this.pages.length - 1] = target;
  }

  restore(value: string) {
    const target = this.normalize(value);
    if (!target) return;
    const index = this.pages.lastIndexOf(target);
    if (index >= 0) this.pages.length = index + 1;
    else this.visit(target);
  }

  back() {
    if (this.pages.length < 2) return null;
    this.pages.pop();
    return this.pages[this.pages.length - 1];
  }
}
