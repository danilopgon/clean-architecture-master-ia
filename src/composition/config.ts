import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url().optional(),
    PRICING_BASE_URL: z.url().optional(),
    USER_INMEMORY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((data, ctx) => {
    if (!data.USER_INMEMORY) {
      if (!data.DATABASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ['DATABASE_URL'],
          message: 'Required when USER_INMEMORY is false',
        });
      }
      if (!data.PRICING_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ['PRICING_BASE_URL'],
          message: 'Required when USER_INMEMORY is false',
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment variables: ${formattedErrors}`);
}

export type AppConfig = z.infer<typeof envSchema>;

export const config: AppConfig = parsedEnv.data;

export const getConfig = (): AppConfig => config;
