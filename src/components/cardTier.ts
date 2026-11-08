/** Nível do card pelo overall, como no Ultimate Team. */
export const cardTier = (ovr: number) =>
  ovr >= 80
    ? 'card-rare'
    : ovr >= 75
      ? 'card-gold'
      : ovr >= 70
        ? 'card-silver card-shiny'
        : ovr >= 65
          ? 'card-silver'
          : ovr >= 60
            ? 'card-bronze card-shiny'
            : 'card-bronze';
