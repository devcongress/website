<template>
  <section class="py-24 px-6 text-white">
    <div class="max-w-7xl mx-auto flex flex-col gap-16">
      <h2 class="text-5xl md:text-7xl font-bold tracking-tight">
        Let’s Build What Africa Needs, Together.
        <span class="text-primary-500">Partner Or Sponsor</span>
      </h2>

      <!-- Partner Grid -->
      <div
        class="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-8 place-items-center"
      >
        <div
          v-for="(partner, i) in partners"
          :key="i"
          class="flex items-center justify-center bg-gray-800/40 hover:bg-gray-700/50 transition duration-300 p-8 rounded-2xl w-full h-28 sm:h-32 md:h-36 grayscale hover:grayscale-0 hover:scale-[1.05] cursor-pointer"
        >
          <img
            :src="partner.logo"
            :alt="partner.name"
            class="max-h-16 sm:max-h-20 md:max-h-24 object-contain"
          />
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center mt-12">
        <p class="text-xl text-gray-100 mb-8 max-w-2xl mx-auto">
          Want to collaborate or support our community of vibrant tech talent?
        </p>
        <a
          href="#support"
          class="inline-flex items-center justify-center rounded-2xl px-6 py-4 bg-white/10 text-primary-500 border border-transparent hover:border-primary-500 font-semibold hover:bg-white/10 transition duration-150 ease-out delay-75"
        >
          Support Mission
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { partners } from '../data/partners';
</script>
