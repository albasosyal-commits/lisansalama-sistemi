/** Promise'i belirtilen sürede tamamlanmazsa "zaman aşımı" hatasıyla reddeder. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`İşlem zaman aşımına uğradı (${ms} ms).`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}
