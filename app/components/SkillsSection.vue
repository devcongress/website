<template>
  <section id="why-devcongress" class="py-20 px-6">
    <div class="relative w-full overflow-hidden py-8">
      <!-- soft edge fade -->
      <div
        class="pointer-events-none absolute inset-0 z-10"
        style="
          mask-image: linear-gradient(
            to right,
            transparent,
            black 10%,
            black 90%,
            transparent
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            black 10%,
            black 90%,
            transparent
          );
        "
      />

      <div
        class="flex gap-3 whitespace-nowrap will-change-transform animate-marquee hover:[animation-play-state:paused]"
        :style="{
          '--marquee-duration': duration,
        }"
        aria-hidden="false"
      >
        <!-- track #1 -->
        <div class="flex gap-3 shrink-0">
          <span
            v-for="(role, i) in roles"
            :key="'a-' + i"
            class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white/80 ring-1 ring-white/10 hover:bg-white/10 hover:text-se transition"
          >
            {{ role }}
          </span>
        </div>

        <!-- track #2 (duplicate for seamless loop) -->
        <div class="flex gap-3 shrink-0" aria-hidden="true">
          <span
            v-for="(role, i) in roles"
            :key="'b-' + i"
            class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white/80 ring-1 ring-white/10 hover:bg-white/10 hover:text-se transition"
          >
            {{ role }}
          </span>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto flex flex-col gap-16">
      <h2 class="text-5xl md:text-7xl font-bold text-left tracking-tighter">
        <span class="text-primary-500">You have the skills.</span> But it feels
        <br class="hidden sm:flex" />like no one sees you.
      </h2>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 xl:gap-12">
        <div class="flex flex-col gap-2 group">
          <div
            class="w-auto aspect-square sepia-50 group-hover:sepia-0 opacity-60 group-hover:opacity-100 transition ease-out duration-300 delay-75 rounded-2xl shadow-2xl bg-[url('https://images.pexels.com/photos/4054340/pexels-photo-4054340.jpeg?auto=compress&cs=tinysrgb&w=1200')] bg-cover bg-center [mask-image:url('/images/pattern-square.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/images/pattern-square.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
          ></div>
          <p class="text-lg text-gray-100 group-hover:text-secondary-400 font-semibold">
            You’re not sure how to showcase your skills with confidence.
          </p>
        </div>

        <div class="flex flex-col gap-2 group">
          <div
            class="w-auto aspect-square sepia-50 group-hover:sepia-0 opacity-60 group-hover:opacity-100 transition ease-out duration-300 delay-75 rounded-2xl shadow-2xl bg-[url('https://images.pexels.com/photos/12911216/pexels-photo-12911216.jpeg')] bg-cover bg-center [mask-image:url('/images/pattern-square.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/images/pattern-square.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
          ></div>
          <p class="text-lg text-gray-100 group-hover:text-secondary-400 font-semibold">
            You struggle to find opportunities that match your ambitions.
          </p>
        </div>

        <div class="flex flex-col gap-2 group">
          <div
            class="w-auto aspect-square sepia-50 group-hover:sepia-0 opacity-60 group-hover:opacity-100 transition ease-out duration-300 delay-75 rounded-2xl shadow-2xl bg-[url('https://images.pexels.com/photos/6624420/pexels-photo-6624420.jpeg')] bg-cover bg-center [mask-image:url('/images/pattern-square.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/images/pattern-square.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
          ></div>
          <p class="text-lg text-gray-100 group-hover:text-secondary-400 font-semibold">
            You want to work on projects that make a real difference, but don’t know
            where to start.
          </p>
        </div>

        <div class="flex flex-col gap-2 group">
          <div
            class="w-auto aspect-square sepia-50 group-hover:sepia-0 opacity-60 group-hover:opacity-100 transition ease-out duration-300 delay-75 rounded-2xl shadow-2xl bg-[url('https://images.pexels.com/photos/8727450/pexels-photo-8727450.jpeg')] bg-cover bg-center [mask-image:url('/images/pattern-square.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/images/pattern-square.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
          ></div>
          <p class="text-lg text-gray-100 group-hover:text-secondary-400 font-semibold">
            You rarely connect with peers who inspire you and push your limits.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { roles as defaultRoles } from '../data/roles';

const props = defineProps({
  roles: {
    type: Array,
    default: () => defaultRoles,
  },
  /** Tailwind-ish duration: e.g. '30s', '45s'. */
  duration: {
    type: String,
    default: "20s",
  },
});
</script>

<style scoped>
/* Smooth infinite marquee (right -> left) */
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

/* Use custom property for flexible speed */
.animate-marquee {
  animation: marquee var(--marquee-duration, 30s) linear infinite;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-marquee {
    animation: none !important;
  }
}
</style>
