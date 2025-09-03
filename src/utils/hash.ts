import bcrypt from "bcryptjs";


export async function hashPassword(plain: string, saltRounds = 10) {
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(plain, salt);
}


export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}


export function validatePasswordStrength(pw: string) {
  
  return pw.length >= 6;
}
