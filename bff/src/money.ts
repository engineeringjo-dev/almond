/** JOD is stored as integer fils (1 JOD = 1000 fils) to avoid float drift. */
export const toFils = (jod: number): number => Math.round(jod * 1000);
export const toJod = (fils: number): number => Math.round(fils) / 1000;
