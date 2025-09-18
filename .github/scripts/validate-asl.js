// Validador leve para ASL – checa estrutura básica e referências.
const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "state-machines", "example.asl.json");
let doc;
const errors = [];

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const err = (m) => errors.push("❌ " + m);

try {
  doc = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`Falha ao ler/parsear ${file}:`, e.message);
  process.exit(1);
}

if (!doc.StartAt || typeof doc.StartAt !== "string") err("Campo 'StartAt' ausente ou não é string.");
if (!isObject(doc.States)) err("Campo 'States' ausente ou não é objeto.");

const states = doc.States || {};
if (doc.StartAt && !states[doc.StartAt]) err(`'StartAt' referencia estado inexistente: ${doc.StartAt}`);

for (const [name, s] of Object.entries(states)) {
  if (!isObject(s)) { err(`Estado '${name}' não é um objeto.`); continue; }
  const type = s.Type;
  if (!type) err(`Estado '${name}' sem 'Type'.`);

  if (type === "Choice") {
    const choices = s.Choices;
    if (!Array.isArray(choices) || choices.length === 0) err(`Estado '${name}' (Choice) sem 'Choices'.`);
    else choices.forEach((c, i) => c.Next && !states[c.Next] && err(`'${name}' Choice[${i}].Next inexistente: ${c.Next}`));
    if (s.Default && !states[s.Default]) err(`'${name}' Default referencia estado inexistente: ${s.Default}`);
  }

  if (type === "Parallel") {
    if (!Array.isArray(s.Branches) || s.Branches.length === 0) err(`Estado '${name}' (Parallel) sem 'Branches'.`);
    else s.Branches.forEach((b, i) => {
      if (!b.StartAt || !isObject(b.States)) err(`'${name}' Branch[${i}] sem StartAt/States.`);
      else if (!b.States[b.StartAt]) err(`'${name}' Branch[${i}].StartAt referencia estado inexistente dentro da branch.`);
    });
  }

  const hasNext = Object.prototype.hasOwnProperty.call(s, "Next");
  const hasEnd = s.End === true;
  const canOmitNext = ["Choice", "Fail", "Succeed", "Parallel"].includes(type);

  if (!canOmitNext && !hasNext && !hasEnd) err(`Estado '${name}' deve possuir 'Next' ou 'End'.`);
  if (hasNext && !states[s.Next]) err(`Estado '${name}' -> Next referencia estado inexistente: ${s.Next}`);
}

if (errors.length) {
  console.error("\nValidação ASL falhou:");
  errors.forEach((e) => console.error(e));
  process.exit(1);
} else {
  console.log("✅ ASL ok: estrutura básica e referências válidas.");
}
