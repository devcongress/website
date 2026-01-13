<template>
  <nav class="sticky top-0 z-50 bg-surface-500/75 backdrop-blur-sm">
    <div class="max-w-8xl mx-auto px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 md:h-20">
        <!-- Logo -->
        <a href="/" class="flex items-center gap-2">
          <img src="/images/logo.svg" alt="Devcongress Logo" class="h-8 w-auto" />
        </a>

        <!-- Desktop Nav -->
        <div class="hidden md:flex items-center gap-6">
          <!-- Primary links -->
          <template v-for="item in navItems" :key="item.label">
            <!-- Simple link -->
            <a
              v-if="!item.children"
              :href="item.href"
              class="text-foreground hover:text-accent transition-colors"
            >
              {{ item.label }}
            </a>

            <!-- Dropdown -->
            <div
              v-else
              class="relative"
              ref="desktopDropdownEl"
              @mouseenter="aboutOpen = true"
              @mouseleave="aboutOpen = false"
            >
              <button
                ref="desktopTriggerEl"
                type="button"
                class="inline-flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                @click="aboutOpen = !aboutOpen"
                aria-haspopup="menu"
                :aria-expanded="aboutOpen ? 'true' : 'false'"
              >
                {{ item.label }}
                <ChevronDown
                  class="w-4 h-4"
                  :class="aboutOpen ? 'rotate-180 transition-transform' : 'transition-transform'"
                />
              </button>

              <transition
                enter-active-class="transition ease-out duration-150"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition ease-in duration-100"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
              >
                <div
                  v-if="aboutOpen"
                  class="absolute left-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg p-1"
                  role="menu"
                  tabindex="-1"
                >
                  <a
                    v-for="sub in item.children"
                    :key="sub.href"
                    :href="sub.href"
                    class="block rounded-lg px-3 py-2 text-sm text-foreground hover:text-primary-500"
                    role="menuitem"
                    @click="closeAll()"
                  >
                    {{ sub.label }}
                  </a>
                </div>
              </transition>
            </div>
          </template>

          <!-- CTAs -->
          <a
            v-for="cta in ctas"
            :key="cta.label"
            :href="cta.href"
            class="inline-flex items-center justify-center font-semibold transition duration-150 ease-out delay-75"
            :class="cta.variant === 'secondary'
              ? 'rounded-2xl px-4 py-2 bg-white/10 text-primary-500 border border-transparent hover:border-primary-500 hover:bg-white/10'
              : 'rounded-xl px-4 py-2 bg-primary-500 text-accent-foreground hover:bg-primary-600'"
          >
            {{ cta.label }}
          </a>
        </div>

        <!-- Mobile toggle -->
        <button
          class="md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground hover:text-primary cursor-pointer"
          @click="mobileOpen = !mobileOpen"
          :aria-expanded="mobileOpen ? 'true' : 'false'"
          aria-label="Toggle navigation"
        >
          <component :is="mobileOpen ? X : Menu" class="w-6 h-6" />
        </button>
      </div>
    </div>

    <!-- Mobile Nav -->
    <transition
      enter-active-class="transition-[max-height] duration-200 ease-out"
      leave-active-class="transition-[max-height] duration-150 ease-in"
    >
      <div v-if="mobileOpen" class="md:hidden border-t border-border">
        <div class="px-6 py-4 space-y-2">
          <!-- Primary links (mirror desktop) -->
          <template v-for="item in navItems" :key="item.label">
            <!-- Simple link -->
            <a
              v-if="!item.children"
              :href="item.href"
              class="block px-2 py-2 rounded-md text-foreground hover:text-primary"
              @click="closeAll()"
            >
              {{ item.label }}
            </a>

            <!-- Collapsible for dropdown -->
            <div v-else>
              <button
                type="button"
                class="w-full flex items-center justify-between px-2 py-2 rounded-xl hover:text-primary-500"
                @click="mobileSubOpen = !mobileSubOpen"
                aria-controls="mobile-what-sub"
                :aria-expanded="mobileSubOpen ? 'true' : 'false'"
              >
                <span class="text-foreground">{{ item.label }}</span>
                <ChevronDown class="w-4 h-4 transition-transform" :class="mobileSubOpen ? 'rotate-180' : ''" />
              </button>
              <transition
                enter-active-class="transition ease-out duration-150"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition ease-in duration-100"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div v-if="mobileSubOpen" id="mobile-what-sub" class="mt-1 pl-3 space-y-1">
                  <a
                    v-for="sub in item.children"
                    :key="sub.href"
                    :href="sub.href"
                    class="block px-2 py-2 rounded-md text-sm text-foreground/90 hover:text-primary-500"
                    @click="closeAll()"
                  >
                    {{ sub.label }}
                  </a>
                </div>
              </transition>
            </div>
          </template>

          <!-- CTAs (mirror desktop) -->
          <div class="pt-2 space-y-2">
            <a
              v-for="cta in ctas"
              :key="cta.label"
              :href="cta.href"
              class="block text-center font-semibold transition duration-150 ease-out delay-75"
              :class="cta.variant === 'secondary'
                ? 'rounded-xl px-4 py-2 bg-white/10 text-primary-500 border border-transparent hover:border-primary-500 hover:bg-white/10'
                : 'rounded-xl px-4 py-2 bg-primary-500 text-accent-foreground hover:bg-primary-600'"
              @click="closeAll()"
            >
              {{ cta.label }}
            </a>
          </div>
        </div>
      </div>
    </transition>
  </nav>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Menu, X, ChevronDown } from "lucide-vue-next";

const mobileOpen = ref(false);
const mobileSubOpen = ref(false);
const aboutOpen = ref(false);

const whatItems = [
  { label: "How to Build", href: "/how-to-build" },
  { label: "Echo", href: "/echo" },
  { label: "Chale Code", href: "/chale-code" },
  { label: "What are you building", href: "/what-are-you-building" },
  { label: "Hackathon", href: "/hackathon" },
];

// single source of truth for both views
const navItems = [
  { label: "Why Devcongress", href: "#why-devcongress" },
  { label: "What we’re about", children: whatItems },
];

const ctas = [
  { label: "Support Mission", href: "#support", variant: "secondary" },
  { label: "Join Community", href: "#join", variant: "primary" },
];

/* Close helpers */
function closeAll() {
  mobileOpen.value = false;
  mobileSubOpen.value = false;
  aboutOpen.value = false;
}

/* Click outside to close desktop dropdown */
const desktopDropdownEl = ref(null);
const desktopTriggerEl = ref(null);

function handleClickOutside(e) {
  const ddRaw = desktopDropdownEl.value;
  const trigRaw = desktopTriggerEl.value;

  const dd = Array.isArray(ddRaw) ? ddRaw[0] : ddRaw;
  const trig = Array.isArray(trigRaw) ? trigRaw[0] : trigRaw;

  if (!dd || !trig) return;

  const clickedInside = dd.contains(e.target) || trig.contains(e.target);
  if (!clickedInside) aboutOpen.value = false;
}

/* ESC to close */
function handleKeydown(e) {
  if (e.key === "Escape") closeAll();
}

/* Auto-close mobile menu when resizing to md+ */
function handleResize() {
  if (typeof window !== 'undefined' && window.innerWidth >= 768) closeAll();
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener("resize", handleResize);
  }
});
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeydown);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener("resize", handleResize);
  }
});
</script>
