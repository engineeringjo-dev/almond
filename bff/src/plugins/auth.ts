import type { FastifyReply, FastifyRequest } from 'fastify';

/** preHandler: require a valid member JWT. Identity comes from the token
 *  (`sub`), NEVER from a client-supplied userId. */
export async function requireMember(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  await request.jwtVerify(); // throws 401 on invalid/missing token
}

export function memberId(request: FastifyRequest): string {
  const user = request.user as { sub?: string } | undefined;
  if (!user?.sub) throw new Error('no member on request');
  return user.sub;
}
