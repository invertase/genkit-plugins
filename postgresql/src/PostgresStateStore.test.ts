import { PostgresStateStore } from "./PostgresStateStore"; // Adjust the import path as needed
import { Pool } from "pg";

const testFlowState = {
  name: "Example Flow",
  flowId: "flow123",
  input: { someInput: "data" },
  startTime: 1651234567,
  cache: {
    key1: {
      value: "cached value",
      empty: undefined, // can also be true or left out entirely
    },
  },
  eventsTriggered: {
    event1: "triggered",
  },
  blockedOnStep: null, // or could be an object with name and optionally schema
  operation: {
    name: "processData",
    metadata: { info: "metadata" },
    done: false, // defaulted to false
    result: {
      response: null, // could be any value
      error: "Error message",
      stacktrace: "Stack trace details",
    },
    blockedOnStep: {
      name: "verifyData",
      schema: "schema details",
    },
  },
  traceContext: "trace123",
  executions: [
    {
      startTime: 1651234500,
      endTime: 1651234600,
      traceIds: ["trace1", "trace2"],
    },
  ],
};

describe("PostgresStateStore Integration Tests", () => {
  let store: PostgresStateStore;
  const connectionString = `postgresql://postgres:mysecretpassword@localhost:5432/postgres`;
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: connectionString });
    store = new PostgresStateStore({ connectionString: connectionString });
  });

  afterEach(async () => {
    // Ensure the table is dropped after each test to start fresh
    await pool.query(`DROP TABLE IF EXISTS ${store.tableName}`);
  });

  afterAll(async () => {
    // Properly close the pool connection to ensure no handles are left open
    await pool.end();
    await store.knex.destroy();
  });

  describe("createTableIfNotExists", () => {
    test("should create the table correctly", async () => {
      // This test includes the creation of the table
      await store.createTableIfNotExists();
      const tableInfo = await pool.query(
        `SELECT * FROM information_schema.columns WHERE table_name = '${store.tableName}'`
      );
      expect(tableInfo.rows).toHaveLength(10);
      const columns = tableInfo.rows.map((row) => row.column_name);
      expect(columns).toContain("flow_id");
      expect(columns).toContain("input");
      expect(columns).toContain("start_time");
      expect(columns).toContain("cache");
      expect(columns).toContain("events_triggered");
      expect(columns).toContain("blocked_on_step");
      expect(columns).toContain("operation");
      expect(columns).toContain("trace_context");
      expect(columns).toContain("executions");
    });
  });

  describe("save", () => {
    test("should save the correct data", async () => {
      await store.save("flow123", testFlowState);

      const formattedStartTime = new Date(testFlowState.startTime * 1000);

      const result = await pool.query(`SELECT * FROM ${store.tableName}`);

      console.log(result.rows[0]);

      expect(result.rows).toHaveLength(1);
      const savedData = result.rows[0];
      expect(savedData.flow_id).toBe("flow123");
      expect(savedData.input).toEqual({ someInput: "data" });
      expect(savedData.start_time).toEqual(formattedStartTime);
      expect(savedData.cache).toEqual({
        key1: {
          value: "cached value",
        },
      });
      expect(savedData.events_triggered).toEqual({ event1: "triggered" });
      expect(savedData.blocked_on_step).toBe(null);
      expect(savedData.operation).toEqual({
        name: "processData",
        metadata: { info: "metadata" },
        done: false,
        result: {
          response: null,
          error: "Error message",
          stacktrace: "Stack trace details",
        },
        blockedOnStep: {
          name: "verifyData",
          schema: "schema details",
        },
      });
      expect(savedData.trace_context).toBe("trace123");
      expect(savedData.executions).toEqual([
        {
          startTime: 1651234500,
          endTime: 1651234600,
          traceIds: ["trace1", "trace2"],
        },
      ]);
    });
  });

  describe("load", () => {
    test("should load the correct data", async () => {
      await store.save("flow123", testFlowState);
      const loadedData = await store.load("flow123");

      expect(loadedData).toEqual(testFlowState);
    });
  });

  describe("list", () => {
    test("should list the correct data", async () => {
      await store.save("flow123", testFlowState);
      const listData = await store.list();

      expect(listData.flowStates).toHaveLength(1);
      expect(listData.flowStates[0]).toEqual(testFlowState);
    });
  });
});
