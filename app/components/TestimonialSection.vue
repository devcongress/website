<template>
  <section class="py-24 px-6 text-white">
    <div class="max-w-7xl mx-auto text-center mb-16">
      <h2 class="text-5xl lg:text-7xl font-bold text-center mb-16 tracking-tighter">
        See What’s Possible When You <br class="hidden sm:inline-flex" />
        <span class="text-primary-500">Have the Right Support</span>
      </h2>
    </div>

    <!-- HORIZONTAL SCROLLER -->
    <div class="relative mx-auto">
      <div class="overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-6 px-6">
        <div class="grid grid-flow-col auto-cols-[minmax(16rem,20rem)] gap-8 py-2">
          <!-- CARD -->
          <div v-for="(t, i) in testimonials" :key="i" class="snap-start group">
            <div
              class="relative w-full aspect-4/3 sm:aspect-9/16 rounded-3xl overflow-hidden shadow-lg group hover:scale-[1.02] transition duration-300"
            >
              <img
                :src="t.image"
                :alt="t.name"
                class="w-full h-full object-cover grayscale-100 group-hover:grayscale-0 group-hover:sepia-0 transition ease-out duration-300 delay-75"
              />
            </div>

            <p class="text-base text-gray-100 mt-4 italic leading-relaxed">
              “{{ t.quote }}”
              <br />
              <span
                class="not-italic font-semibold text-gray-400 group-hover:text-secondary-400"
              >
                – {{ t.name }}, {{ t.role }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { testimonials } from '../data/testimonials';
</script>

<style>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
