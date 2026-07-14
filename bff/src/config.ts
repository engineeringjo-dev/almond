/** Server-side config. Secrets are read from the environment and NEVER shipped
 *  to any client bundle (that is the whole point of the BFF). */
export const config = {
  PORT: Number(process.env.PORT ?? 8080),
  DATA_SOURCE: (process.env.DATA_SOURCE ?? 'memory') as 'memory' | 'odoo',

  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-change-me',
  JWT_TTL: process.env.JWT_TTL ?? '30d',

  POS_TOKEN_SECRET: process.env.POS_TOKEN_SECRET ?? 'dev-insecure-pos-change-me',
  POS_TOKEN_TTL_SECONDS: Number(process.env.POS_TOKEN_TTL_SECONDS ?? 60),

  OTP_DEV_CODE: process.env.OTP_DEV_CODE ?? '123456',
  POS_SCAN_KEY: process.env.POS_SCAN_KEY ?? '',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? '*',

  ODOO_BASE_URL: process.env.ODOO_BASE_URL ?? '',
  ODOO_API_KEY: process.env.ODOO_API_KEY ?? '',
  LOYALTY_BASE_URL: process.env.LOYALTY_BASE_URL ?? '',
  LOYALTY_TOKEN: process.env.LOYALTY_TOKEN ?? '',
} as const;
