import { convertInningsPitched } from "./innings.util.js";

export function calculateWHIP(stat) {
  const innings = convertInningsPitched(stat.innings_pitched);

  if (!innings) return 0;

  const whip = (stat.walks_allowed + stat.hits_allowed) / innings;
  return Number(whip.toFixed(2));
}
