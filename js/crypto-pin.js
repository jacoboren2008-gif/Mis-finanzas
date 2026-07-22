// Hash del PIN local con Web Crypto (PBKDF2-SHA256). Esto es un candado de
// pantalla, no cifrado real de los datos — ver aviso en views/lock.js.
const ITERATIONS = 180000;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

async function derive(pin, saltBytes, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

export async function hashPin(pin) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, saltBytes, ITERATIONS);
  return { pinSalt: bufToHex(saltBytes), pinIterations: ITERATIONS, pinHash: hash };
}

export async function verifyPin(pin, { pinSalt, pinIterations, pinHash }) {
  const hash = await derive(pin, hexToBuf(pinSalt), pinIterations || ITERATIONS);
  return hash === pinHash;
}
