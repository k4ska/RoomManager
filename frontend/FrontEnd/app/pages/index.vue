<template>
  <main class="landing">
    <div class="center">
      <h1>Ruumihaldur</h1>
      <p>Kujunda ja korralda oma tuba digitaalselt.</p>
      <NuxtLink class="cta-btn" to="/editor">Kujunda ruum</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.center {
  text-align: center;
}

h1 {
  margin: 0 0 12px 0;
  font-size: 3rem; /* ~48px */
  font-weight: 800;
  letter-spacing: -0.02em;
}

p {
  margin: 0 0 28px 0;
  color: var(--muted);
  font-size: 1.125rem; /* ~18px */
}

.cta-btn {
  display: inline-block;
  padding: 14px 28px;
  border-radius: 14px;
  background: var(--accent);
  color: #062217;
  font-weight: 700;
  font-size: 1.125rem;
  text-decoration: none;
  box-shadow: 0 10px 18px rgba(16, 185, 129, 0.25);
  transform: translateZ(0);
  transition: transform 0.15s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.cta-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 12px 22px rgba(16, 185, 129, 0.35);
  transform: scale(1.03);
}

.cta-btn:active {
  transform: scale(0.99);
}
</style>
