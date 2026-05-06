import fs from "node:fs/promises";

const [projectRef, token, migrationPath] = process.argv.slice(2);

if (!projectRef || !token || !migrationPath) {
  console.error("Usage: node scripts/applySupabaseMigration.mjs <project-ref> <pat> <migration-path>");
  process.exit(1);
}

const sql = await fs.readFile(migrationPath, "utf8");

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1] ?? "";

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      i += 1;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += char;
      i += 1;
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        i += 2;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      i += 1;
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') inDoubleQuote = false;
      i += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      current += char + next;
      inLineComment = true;
      i += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      current += char + next;
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (char === "'") {
      current += char;
      inSingleQuote = true;
      i += 1;
      continue;
    }

    if (char === '"') {
      current += char;
      inDoubleQuote = true;
      i += 1;
      continue;
    }

    if (char === "$") {
      const match = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (char === ";") {
      current += char;
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

function chunkStatements(statements, maxChars = 9000) {
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const statement of statements) {
    const statementLength = statement.length + 2;
    if (current.length > 0 && currentLength + statementLength > maxChars) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentLength = 0;
    }
    current.push(statement);
    currentLength += statementLength;
  }

  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks;
}

async function runChunk(query, index, total) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      read_only: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Chunk ${index + 1}/${total} failed: ${response.status} ${body}`);
  }

  return response.json().catch(() => ({}));
}

const statements = splitSqlStatements(sql);
const chunks = chunkStatements(statements);

console.log(`statements=${statements.length}`);
console.log(`chunks=${chunks.length}`);

for (let index = 0; index < chunks.length; index += 1) {
  console.log(`running_chunk=${index + 1}/${chunks.length}`);
  await runChunk(chunks[index], index, chunks.length);
}

console.log("migration_applied=true");
