import { config } from '../config';

export function getExpiresAt(popular = false): number {
  // Rand -48h to +48h, to spread refresh
  const randHours = Math.floor(Math.random() * (-48 - 48 + 1)) + 48;

  // Round minutes to avoid too many values in facet
  const minutes = Math.ceil(Math.floor(Math.random() * (60 + 1)) / 30) * 30;

  const expiresAt = new Date(
    Date.now() + (popular ? config.popularExpiresAt : config.expiresAt)
  );
  expiresAt.setMilliseconds(0);
  expiresAt.setSeconds(0);
  expiresAt.setMinutes(minutes);
  expiresAt.setHours(randHours);

  return expiresAt.getTime();
}
