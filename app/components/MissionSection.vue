<template>
  <div id="mission" class="relative w-full h-full overflow-hidden py-12 lg:py-24 px-8">
    <div
      class="relative w-full h-full mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-12 col-start-1 col-end-13 px-4 sm:px-0 gap-8 sm:gap-0"
    >
      <div
        class="col-start-auto sm:col-start-1 sm:col-end-7 flex flex-col space-y-4 items-center sm:items-start"
      >
        <h2 class="text-5xl lg:text-7xl font-bold mb-8 tracking-tighter">
          That's why we created
          <img
            src="/images/logo.svg"
            alt="Devcongress Logo"
            class="h-16 w-auto inline-flex"
          />
        </h2>

        <div class="space-y-6 mb-8">
          <div class="flex gap-4 group">
            <div class="flex-shrink-0">
              <LogoPattern
                class="w-12 group aspect-square before:bg-surface-400 group-hover:before:bg-secondary-500 before:transition-colors before:duration-300"
              >
                <span
                  class="text-white font-extrabold text-2xl scale-100 font-heading group-hover:scale-110 transition"
                >
                  0
                </span>
              </LogoPattern>
            </div>
            <div class="flex flex-col justify-start items-start">
              <p class="font-bold text-xl tracking-tighter">
                To build confidence among tech talents.
              </p>
              <p class="text-base text-gray-100">
                Over 500+ professionals upskilled through mentorship, events, and hands-on feedback.
              </p>
            </div>
          </div>
          <div class="flex gap-4 group">
            <div class="shrink-0">
              <LogoPattern
                class="w-12 group aspect-square before:bg-surface-400 group-hover:before:bg-secondary-500 before:transition-colors before:duration-300"
              >
                <span
                  class="text-white font-extrabold text-2xl scale-100 font-heading group-hover:scale-110 transition"
                >
                  1
                </span>
              </LogoPattern>
            </div>
            <div class="flex flex-col justify-start items-start">
              <p class="font-bold text-xl tracking-tighter">
                Expose tech talents to a rich array of resources.
              </p>
              <p class="text-base text-gray-100">
                30+ community sessions, 100+ shared resources, and growing.
              </p>
            </div>
          </div>
          <div class="flex gap-4 group">
            <div class="shrink-0">
              <LogoPattern
                class="w-12 group aspect-square before:bg-surface-400 group-hover:before:bg-secondary-500 before:transition-colors before:duration-300"
              >
                <span
                  class="text-white font-extrabold text-2xl scale-100 font-heading group-hover:scale-110 transition"
                >
                  2
                </span>
              </LogoPattern>
            </div>
            <div class="flex flex-col justify-start items-start">
              <p class="font-bold text-xl tracking-tighter">
                Contribute to innovative and community-driven projects that create real impact.
              </p>
              <p class="text-base text-gray-100">
                Contributed to 10+ community-led tools powering innovation across Africa.
              </p>
            </div>
          </div>
          <div class="flex gap-4 group">
            <div class="shrink-0">
              <LogoPattern
                class="w-12 group aspect-square before:bg-surface-400 group-hover:before:bg-secondary-500 before:transition-colors before:duration-300"
              >
                <span
                  class="text-white font-extrabold text-2xl scale-100 font-heading group-hover:scale-110 transition"
                >
                  3
                </span>
              </LogoPattern>
            </div>
            <div class="flex flex-col justify-start items-start">
              <p class="font-bold text-xl tracking-tighter">
                Harness the collective strength of Africa’s tech community to solve real problems.
              </p>
              <p class="text-base text-gray-100">
                From solo learners to startup founders, we connect and grow together.
              </p>
            </div>
          </div>
        </div>

        <a
          href="#join"
          class="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-primary-500 text-accent-foreground font-semibold hover:bg-primary-600 transition duration-150 ease-out delay-75"
        >
          Join Community
        </a>
      </div>

      <LogoPattern
        mask-url="pattern-rectangle.svg"
        class="w-full h-full scale-120 aspect-video sm:absolute left-0 sm:left-2/3 object-cover drop-shadow-xl group before:bg-[url('https://pbs.twimg.com/media/GnM9JWzWUAAJg7I?format=jpg&name=large')] before:bg-cover"
      >
      </LogoPattern>
    </div>
  </div>
</template>
