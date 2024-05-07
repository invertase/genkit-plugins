import { Pool } from "pg";

const connectionString = `postgresql://postgres:mysecretpassword@localhost:5432/postgres`;

describe("playground", () => {
  test("should work", async () => {
    const pool = new Pool({ connectionString: connectionString });

    const result = await pool.query(`select * from pg_catalog.pg_tables`);

    const spanStore = "span_store";

    const spanTableInfo = await pool.query(`SELECT * FROM span_store`);

    console.log(spanTableInfo);

    pool.end();
  });
});
