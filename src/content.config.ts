import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const socialSchema = z.object({
  platform: z.enum(['x', 'linkedin', 'github', 'website', 'youtube', 'instagram', 'facebook', 'discord', 'slack']),
  url: z.string().url(),
});

const admins = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/admins' }),
  schema: z.object({
    name: z.string().min(2).max(100),
    image: z.string().url(),
    socials: z.array(socialSchema),
  }),
});

const activities = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/activities' }),
  schema: z.object({
    title: z.string().min(2),
    description: z.string().min(10),
    link: z.string().optional().refine(v => !v || v.startsWith('/') || v.startsWith('http') || v.startsWith('slack'), {
      message: 'link must be a relative path or full URL',
    }),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    order: z.number().int().min(1),
    status: z.enum(['active', 'ongoing', 'upcoming', 'completed']),
  }),
});

const partners = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/partners' }),
  schema: z.object({
    name: z.string().min(1),
    logo: z.string().url(),
    url: z.string().url().optional(),
    backgroundColor: z.string().regex(/^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  }),
});

const meetupSpeakerSchema = z.object({
  name: z.string().min(2),
  title: z.string().min(2),
  bio: z.string().min(10),
  image: z.string().url(),
  talk_title: z.string().min(2),
  talk_description: z.string().min(10),
  slides_url: z.string().url().nullable().optional(),
  recording_url: z.string().url().nullable().optional(),
  socials: z.array(socialSchema).optional(),
});

const scheduleItemSchema = z.object({
  time: z.string().min(3),
  title: z.string().min(2),
  type: z.enum(['networking', 'talk', 'panel', 'workshop', 'open_discussion', 'break']),
  lead: z.string().nullable().optional(),
  resources: z.array(z.object({
    title: z.string().min(2),
    url: z.string().url(),
  })).optional(),
});

const meetups = defineCollection({
  loader: glob({ pattern: '[!_]*.yaml', base: './content/meetups' }),
  schema: z.object({
    name: z.string().min(2),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
    description: z.string().min(10),
    cover: z.string().url(),
    location: z.object({
      name: z.string().min(2),
      map_url: z.string().url().nullable().optional(),
    }),
    stream_url: z.string().url().nullable().optional(),
    embed_stream: z.boolean().optional().default(false),
    registration_url: z.string().url().nullable().optional(),
    speakers: z.array(meetupSpeakerSchema).optional(),
    schedule: z.array(scheduleItemSchema).optional(),
    photos: z.array(z.object({
      url: z.string().url(),
      type: z.enum(['image', 'folder']).default('image'),
    })).optional(),
    videos: z.array(z.object({
      title: z.string().min(2),
      embed_url: z.string().url(),
    })).optional(),
  }),
});

const missionItemSchema = z.object({
  heading: z.string(),
  description: z.string(),
});

const site = defineCollection({
  loader: file('./content/site.yaml'),
  schema: z.object({
    community_slack_url: z.string().url(),
    paystack_url: z.string().url(),
    youtube_embed_url: z.string().url(),
    stats: z.array(z.object({
      value: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })),
    socials: z.array(socialSchema),
    roles: z.array(z.string()),
    mission_section: z.object({
      eyebrow:  z.string(),
      headline: z.string(),
      body:     z.string(),
      cta:      z.string(),
      items:    z.array(missionItemSchema),
    }),
    donate_section: z.object({
      eyebrow: z.string(),
      heading: z.string(),
      body: z.string(),
      cta_text: z.string(),
      uses_header: z.string(),
      uses_items: z.array(z.string()),
    }),
    hero: z.object({
      eyebrow: z.string(),
      headline: z.string(),
      cta_primary: z.object({
        text: z.string(),
        color: z.enum(['pink', 'outline', 'white', 'yellow']),
      }),
      cta_secondary: z.object({
        text: z.string(),
        color: z.enum(['pink', 'outline', 'white', 'yellow']),
      }),
      video_label: z.string(),
      video_live: z.string(),
    }),
  }),
});

export const collections = { admins, activities, partners, meetups, site };
