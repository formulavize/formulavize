import { AnimationStep } from "./lesson";

export enum TypingSpeed {
  Instant = 0,
  Fast = 15,
  Medium = 30,
  Slow = 60,
}

export function createAnimationStep(
  text: string,
  typingSpeed: number = TypingSpeed.Medium,
): AnimationStep {
  return {
    text,
    typingSpeedDelayMs: typingSpeed,
  };
}

const createSpeedHelper =
  (speed: TypingSpeed) =>
  (text: string): AnimationStep =>
    createAnimationStep(text, speed);

export const instant = createSpeedHelper(TypingSpeed.Instant);
export const fast = createSpeedHelper(TypingSpeed.Fast);
export const normal = createSpeedHelper(TypingSpeed.Medium);
export const slow = createSpeedHelper(TypingSpeed.Slow);

export const dramatic = (text: string): AnimationStep[] => {
  // Type each word with a dramatic pause, then end with a newline
  const dramaticDelay = 300;
  const words = text.split(" ");
  const steps = words.flatMap((word, index) =>
    index < words.length - 1
      ? [fast(word), createAnimationStep(" ", dramaticDelay)]
      : [fast(word)],
  );
  return [...steps, createAnimationStep("\n", dramaticDelay)];
};
