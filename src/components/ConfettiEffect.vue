<template>
  <div class="confetti-container"></div>
</template>

<script setup lang="ts">
import { confetti } from "@tsparticles/confetti";

const triggerConfetti = async () => {
  const config = {
    count: 100,
    spread: 60,
    startVelocity: 60,
    shapes: ["circle"],
    colors: ["#80ebff", "#33acff"],
    ticks: 50,
    gravity: 1,
    scalar: 1,
  };

  // Left side confetti burst
  await confetti({
    ...config,
    position: { x: 0, y: 50 },
    angle: 45,
  });

  // Right side confetti burst (triggered simultaneously)
  confetti({
    ...config,
    position: { x: 100, y: 50 },
    angle: 135,
  });
};

defineExpose({
  triggerConfetti,
});
</script>

<style scoped>
.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}
</style>
