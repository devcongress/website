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
    link: z.string().startsWith('/'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    order: z.number().int().min(1),
    status: z.enum(['active', 'ongoing', 'upcoming']),
  }),
});

const partners = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './content/partners' }),
  schema: z.object({
    name: z.string().min(1),
    logo: z.string().url(),
    url: z.string().url().optional(),
    tier: z.enum(['gold', 'silver', 'community']).optional(),
  }),
});

const meetups = defineCollection({
  loader: glob({ pattern: '**/meta.yaml', base: './content/meetups' }),
  schema: z.object({
    name: z.string().min(2),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().min(2),
    description: z.string().min(10),
    cover: z.string().url(),
    photos: z.array(z.string().url()),
  }),
});

const missionItemSchema = z.object({
  heading: z.string(),
  description: z.string(),
  stat: z.string(),
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
