import Database from "better-sqlite3";

async function main(): Promise<void> {
  const databasePath = process.argv[2];
  if (!databasePath) {
    throw new Error("Usage: tsx scripts/inspect-phone-db.ts <sqlite-file>");
  }

  const database = new Database(databasePath, { readonly: true });

  try {
    const tables = database
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all();
    const indexes = database
      .prepare(
        "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name",
      )
      .all();

    process.stdout.write(
      JSON.stringify(
        {
          databasePath,
          tables,
          indexes,
        },
        null,
        2,
      ),
    );
    process.stdout.write("\n");
  } finally {
    database.close();
  }
}

if (process.argv[1]?.endsWith("inspect-phone-db.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main as inspectPhoneDatabase };
