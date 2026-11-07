export const regionOf = (state: string) =>
  ['RS', 'SC', 'PR'].includes(state)
    ? 'Sul'
    : ['SP', 'RJ', 'MG', 'ES'].includes(state)
      ? 'Sudeste'
      : ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'].includes(state)
        ? 'Nordeste'
        : ['AC', 'AM', 'AP', 'PA', 'RR', 'RO', 'TO'].includes(state)
          ? 'Norte'
          : 'Centro-Oeste';
