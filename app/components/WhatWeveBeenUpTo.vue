<template>
  <section class="py-24 px-6 text-white">
    <div class="max-w-7xl mx-auto flex flex-col gap-16">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <h2 class="text-5xl md:text-7xl font-bold tracking-tight">
          What <span class="text-primary-500">We’ve Been Up To</span>
        </h2>
      </div>

      <!-- Bento Grid -->
      <div
        class="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 auto-rows-[minmax(8rem,auto)] md:grid-flow-dense"
      >
        <div v-for="(card, i) in cards" :key="i" :class="card.size">
          <div
            v-if="card.title === 'Echo Podcast'"
            class="group block h-full rounded-3xl transition duration-300 bg-(--card-color)/5 hover:bg-(--card-color)/20"
            :style="{ '--card-color': card.color }"
          >
            <div class="flex h-full flex-col gap-4 p-5 md:p-7">
              <!-- Copy -->
              <div class="w-full">
                <h3
                  class="text-2xl md:text-4xl font-extrabold tracking-tight text-gray-100 transition-colors duration-300 group-hover:text-(--card-color)"
                >
                  {{ card.title }}
                </h3>
                <p
                  class="text-base md:text-lg text-white/60 leading-snug mt-2 transition-colors duration-300 group-hover:text-white"
                >
                  {{ card.description }}
                </p>
              </div>

              <iframe
                src="https://embed.acast.com/653bf1eb18e0ae00111ac1a1?episode-order=desc&accentColor=161616&bgColor=fcf404&secondaryColor=161616&feed=true"
                frameborder="0"
                width="100%"
                height="280px"
                title="Echo Podcast"
              ></iframe>
            </div>
          </div>

          <a
            v-else
            :href="card.link"
            class="group block h-full rounded-3xl transition duration-300 bg-(--card-color)/5 hover:bg-(--card-color)/20"
            :class="card.title === 'Hackathon 2025' ? 'ring-1 ring-primary-500/30 shadow-[0_0_60px_rgb(252_244_4/0.08)]' : ''"
            :style="cardBackgroundStyle(card, i)"
          >
            <div class="flex h-full gap-4 items-start justify-between p-5 md:p-7">
              <!-- Copy -->
              <div class="w-full">
                <h3
                  class="text-2xl md:text-4xl font-extrabold tracking-tight text-gray-100 transition-colors duration-300 group-hover:text-(--card-color)"
                >
                  {{ card.title }}
                </h3>
                <p
                  class="text-base md:text-lg text-white/60 leading-snug mt-2 transition-colors duration-300 group-hover:text-white"
                >
                  {{ card.description }}
                </p>
              </div>

              <!-- External link icon -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="ms-4 size-7 text-white/60 shrink-0 transition-all duration-300 group-hover:text-[color:var(--card-color)] group-hover:translate-x-1"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 13v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 3h-6m6 0v6m0-6L10 14"/>
              </svg>
            </div>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { activities as cards } from '../data/activities';

function cardBackgroundStyle(card, index) {
  const gradients = [
    "linear-gradient(155deg, var(--surface-600), var(--surface-800))",
    "linear-gradient(155deg, var(--surface-500), var(--surface-700))",
    "linear-gradient(155deg, var(--surface-700), var(--surface-900))",
    "linear-gradient(155deg, var(--surface-600), var(--surface-900))",
  ];

  const baseGradient = gradients[index % gradients.length];
  const isHackathon = card.title === 'Hackathon 2025';

  return {
    '--card-color': card.color,
    backgroundImage: `
      linear-gradient(160deg, rgb(8 10 18 / 88%), rgb(8 10 18 / 72%)),
      radial-gradient(circle at top right, var(--card-color), transparent 52%),
      ${
        isHackathon
          ? "linear-gradient(155deg, rgb(8 10 18 / 20%), rgb(8 10 18 / 54%)), url('/images/hackathon-bg.jpg'), repeating-linear-gradient(135deg, rgb(252 244 4 / 0.12) 0 2px, transparent 2px 14px), radial-gradient(circle at 12% 16%, rgb(252 244 4 / 0.2), transparent 38%), radial-gradient(circle at 86% 84%, rgb(251 113 133 / 0.18), transparent 34%),"
          : ""
      }
      ${baseGradient}
    `,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}
</script>
