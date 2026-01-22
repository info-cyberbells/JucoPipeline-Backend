export function convertInningsPitched(inningsPitched) {
  if (!inningsPitched || inningsPitched <= 0) return 0;

  const whole = Math.floor(inningsPitched);
  const decimal = Number((inningsPitched - whole).toFixed(1));

  if (decimal === 0.1) return whole + 1 / 3;
  if (decimal === 0.2) return whole + 2 / 3;

  return whole;
}
