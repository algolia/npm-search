// Coming in nodejs 16
export function wait(waitTime: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, waitTime);
  });
}
