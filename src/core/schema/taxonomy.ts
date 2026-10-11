import { z } from 'zod';
import { Slug } from './pack';

/** รายการ subject / rotation / tag ที่ใช้ได้ — กันชื่อซ้ำซ้อน เช่น `HF` กับ `heart-failure` */
export const Taxonomy = z.object({
  subjects: z.array(z.object({ id: Slug, th: z.string().min(1), en: z.string().min(1) })).min(1),
  rotations: z.array(z.object({ id: Slug, th: z.string().min(1), en: z.string().min(1) })).min(1),
  tags: z
    .array(
      z.object({
        id: Slug,
        /** ชื่อเรียกอื่นที่ห้ามใช้เป็น tag (validator จะเสนอ id นี้แทน) */
        aliases: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

export type Taxonomy = z.infer<typeof Taxonomy>;
