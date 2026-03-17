import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.date(),
    tags: z.array(z.string()).optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const work = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.date(),
    tags: z.array(z.string()).optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const media = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    type: z.enum(['talk', 'interview', 'press', 'podcast']),
    date: z.date(),
    venue: z.string(),
    url: z.string().url(),
    description: z.string().optional(),
  }),
});

export const collections = { blog, work, media };
