<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const videoFrame = ref(null);
let observer;

const postToPlayer = (func) => {
  const frame = videoFrame.value;
  if (!frame || !frame.contentWindow) return;
  frame.contentWindow.postMessage(
    JSON.stringify({ event: "command", func, args: [] }),
    "*"
  );
};

onMounted(() => {
  const frame = videoFrame.value;
  if (!frame) return;

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        postToPlayer("mute");
        postToPlayer("playVideo");
      } else {
        postToPlayer("pauseVideo");
      }
    },
    { threshold: 0.4 }
  );

  observer.observe(frame);
});

onBeforeUnmount(() => {
  if (observer && videoFrame.value) observer.unobserve(videoFrame.value);
  observer = null;
});
</script>

<template>
  <!-- Hero Section -->
  <section class="py-32 px-6 ">
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col gap-8 text-center mb-12">
        <div class="flex flex-col justify-start items-center gap-1">
          <h1
            class="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tighter"
          >
            Helped <span class="text-primary-500">1000+</span> tech talents grow.
            <span class="text-primary-500">
              100+</span
            >
            hired. <span class="text-primary-500">Countless </span>questions answered.
          </h1>
          <p class="text-gray-200 text-lg md:text-xl max-w-3xl mx-auto">
            Join Ghana's most vibrant tech community. Connect & collaborate with fellow developers,
            access mentorship, and build projects that matter.
          </p>
        </div>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://devcongress-community.slack.com/join/shared_invite/zt-3elxv0f0y-U6JoK8Al4ExQp8ERaS8uwg#/shared-invite/email"
            target="_blank" rel="noopener noreferrer"
            class="inline-flex text-center items-center justify-center rounded-2xl px-6 py-4 bg-primary-500 text-accent-foreground font-semibold hover:bg-primary-600 transition duration-150 ease-out delay-75"
          >
            Join Community
          </a>
          <a
            href="https://paystack.shop/pay/devcongress-meetup"
            class="inline-flex text-center items-center justify-center rounded-2xl px-6 py-4 bg-white/10 text-primary-500 border border-transparent hover:border-primary-500 font-semibold hover:bg-white/10 transition duration-150 ease-out delay-75"
          >
            Support Mission
          </a>
        </div>

        <!-- Social Icons -->

        <div class="flex flex-col sm:flex-row items-center justify-center gap-6 mt-16">
          <p class="text-md text-gray-200">Our community members work at:</p>
          <div class="flex justify-center sm:justify-start items-center gap-8 sm:gap-4">
            <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
              />
            </svg>
          </a>
          <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"
              />
            </svg>
          </a>
          <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"
              />
            </svg>
          </a>
          <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
              />
            </svg>
          </a>
          <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"
              />
            </svg>
          </a>
          <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
          </a>
          <a
            href="#"
            class="text-gray-400 hover:text-gray-100 transition delay-75 ease-out duration-300"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"
              />
            </svg>
          </a>
          </div>
        </div>
      </div>

      <!-- Hero Image -->
      <div class="rounded-2xl overflow-hidden shadow-2xl">
        <div class="w-full aspect-video">
          <iframe
            ref="videoFrame"
            class="w-full h-full"
            src="https://www.youtube-nocookie.com/embed/vNWWGWXjybg?rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
            title="DevCongress – Community Highlight"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    </div>
  </section>
</template>
