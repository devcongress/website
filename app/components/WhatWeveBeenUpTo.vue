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
        class="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 auto-rows-[minmax(8rem,auto)] md:[grid-auto-flow:dense]"
      >
        <div v-for="(card, i) in cards" :key="i" :class="card.size">
          <a
            :href="card.link"
            class="group block h-full rounded-3xl transition duration-300 bg-[color:var(--card-color)]/20"
            :style="{ '--card-color': card.color }"
          >
            <div class="flex h-full gap-4 items-start justify-between p-5 md:p-7">
              <!-- Copy -->
              <div class="w-full">
                <h3
                  class="text-2xl md:text-4xl font-extrabold tracking-tight text-gray-100 transition-colors duration-300 group-hover:text-[color:var(--card-color)]"
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
</script>