<template>
  <section id="admins" class="py-20 px-6 ">
    <div class="max-w-7xl mx-auto flex flex-col gap-16">
      <h2 class="text-5xl md:text-7xl font-bold text-left tracking-tighter leading-tight">
        <span class="text-primary-500">Meet the Admins</span><br />
        who make
        <img
          src="/images/logo.svg"
          alt="Devcongress Logo"
          class="h-16 w-auto inline-flex"
        />
        possible.
      </h2>

      <!-- Admin Grid -->
      <div
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-10 xl:gap-12"
      >
        <div
          v-for="(admin, i) in admins"
          :key="i"
          class="flex flex-col items-center gap-4 text-center group"
        >
          <!-- Image Mask -->
          <div
            class="w-full aspect-square grayscale-100 sepia-50 group-hover:grayscale-0 group-hover:sepia-0 opacity-70 group-hover:opacity-100 transition ease-out duration-300 delay-75 rounded-2xl shadow-xl bg-cover bg-center [mask-image:url('/images/pattern-square.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/images/pattern-square.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
            :style="`background-image: url(${admin.image})`"
          ></div>

          <!-- Info -->
          <div>
            <h3 class="text-lg font-bold text-white">{{ admin.name }}</h3>
            <p class="text-sm text-gray-400 font-medium group-hover:text-secondary-400">
              {{ admin.role }}
            </p>

            <!-- Social Links -->
            <div class="flex items-center justify-center gap-4 mt-3">
              <a
                v-for="(social, s) in admin.socials"
                :key="s"
                :href="social.url"
                target="_blank"
                rel="noopener noreferrer"
                class="cursor-pointer text-gray-400 hover:text-primary-500 transition duration-200"
              >
                <component :is="icons[social.platform]" class="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
// Import icons from lucide-vue-next (or @iconify/vue if you prefer)
import {
  Twitter,
  Github,
  Linkedin,
  Instagram,
  Globe,
  Youtube,
  Slack,
} from "lucide-vue-next";
import { admins } from '../data/admins';

const icons = {
  twitter: Twitter,
  github: Github,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  website: Globe,
  slack: Slack,
};
</script>
