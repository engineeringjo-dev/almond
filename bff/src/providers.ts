import { paymentProviderConfigError } from './payments';
import { otpTemplateError, smsProviderConfigError } from './auth/sms';

/**
 * Configuration mistakes that break an integration seam in EVERY environment —
 * unlike insecureBootReasons (config.ts), which is about production safety.
 *
 * A misspelt PAYMENT_PROVIDER would otherwise quietly serve `unconfigured` and
 * refuse every card order; a template without `{code}` would text members a
 * sentence with no code in it. Both are one typo in an env file, and both are
 * refused at boot rather than discovered by a member.
 */
export function providerConfigErrors(): string[] {
  return [paymentProviderConfigError(), smsProviderConfigError(), otpTemplateError()]
    .filter((e): e is string => e !== null);
}
