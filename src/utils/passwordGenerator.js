import crypto from "crypto";

/**
 * Generate a secure random temporary password
 * Format: 3 words + 2 numbers + 1 special char (e.g., BlueSky42!)
 */
export const generateTempPassword = () => {
  const adjectives = [
    "Blue", "Red", "Green", "Fast", "Quick", "Bright", "Smart", "Cool",
    "Swift", "Bold", "Brave", "Strong", "Happy", "Lucky", "Wise"
  ];
  
  const nouns = [
    "Sky", "Star", "Moon", "Sun", "Tiger", "Eagle", "Lion", "Wolf",
    "River", "Ocean", "Mountain", "Forest", "Storm", "Thunder", "Flash"
  ];
  
  const specialChars = "!@#$%&*";
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const numbers = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const special = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  return `${adj}${noun}${numbers}${special}`;
};

/**
 * Alternative: Generate completely random strong password
*/
export const generateSuperStrongPassword = (length = 12) => {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+{}[]?/";

  const all = lower + upper + numbers + symbols;

  // ensure strong mix
  let password = "";
  password += lower[crypto.randomInt(0, lower.length)];
  password += upper[crypto.randomInt(0, upper.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];

  // fill remaining
  for (let i = 4; i < length; i++) {
    password += all[crypto.randomInt(0, all.length)];
  }

  // randomize final order
  return password.split("").sort(() => crypto.randomInt(-1, 2)).join("");
};
