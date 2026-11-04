/** Nível do card pelo overall, como no Ultimate Team. */
export const cardTier = (ovr: number) =>
  ovr >= 83 ? 'card-rare' : ovr >= 75 ? 'card-gold' : ovr >= 65 ? 'card-silver' : 'card-bronze';
