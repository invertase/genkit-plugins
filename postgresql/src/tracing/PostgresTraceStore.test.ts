import { SpanData, TraceData } from "@genkit-ai/core/tracing";
import { PostgresTraceStore } from "./PostgresTraceStore";
import { Pool } from "pg";

const traceDataExample = {
  traceId: "trace123456",
  displayName: "Sample Trace for API Request",
  startTime: 1617981378000, // Optional Unix timestamp in milliseconds for the start of the trace
  endTime: 1617981389000, // Optional Unix timestamp in milliseconds for the end of the trace
  spans: {
    span123: {
      spanId: "span123",
      traceId: "trace123456",
      parentSpanId: "span122", // Optional; can be undefined if this is a root span
      startTime: 1617981378000,
      endTime: 1617981382000,
      attributes: {
        "http.method": "GET",
        "http.url": "https://example.com/api/resource",
      },
      displayName: "GET /api/resource",
      links: [
        {
          context: {
            traceId: "otherTrace123",
            spanId: "otherSpan321",
            traceFlags: 1,
            isRemote: true,
          },
          attributes: {
            connectionType: "SSL",
            error: false,
          },
          droppedAttributesCount: 0,
        },
      ],
      instrumentationLibrary: {
        name: "opentelemetry/web",
        version: "1.0.0",
        schemaUrl: "https://opentelemetry.io/schemas/1.0.0",
      },
      spanKind: "CLIENT",
      sameProcessAsParentSpan: {
        value: true,
      },
      status: {
        code: 0, // Typically, 0 indicates OK, any other number could indicate an error
        message: "Success",
      },
      timeEvents: {
        timeEvent: [
          {
            time: 1617981380000,
            annotation: {
              attributes: {
                cacheHit: true,
                latency: "50ms",
              },
              description: "Cache hit during processing",
            },
          },
        ],
      },
      truncated: false,
    },
  },
} as TraceData;
describe("PostgresTraceStore Integration Tests", () => {
  let store: PostgresTraceStore;
  const connectionString = `postgresql://postgres:mysecretpassword@localhost:5432/postgres`;
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: connectionString });
    store = new PostgresTraceStore({ connectionString: connectionString });
  });

  afterEach(async () => {
    // Ensure the table is dropped after each test to start fresh
    await pool.query(`DROP TABLE IF EXISTS ${store.traceTable}`);
    await pool.query(`DROP TABLE IF EXISTS ${store.spanTable}`);
  });

  afterAll(async () => {
    // Properly close the pool connection to ensure no handles are left open
    await pool.end();
    await store.stop();
  });

  describe("createTablesIfNotExists", () => {
    test("should create the tables correctly", async () => {
      // This test includes the creation of the table
      await store.createTablesIfNotExists();
      const traceTableInfo = await pool.query(
        `SELECT * FROM information_schema.columns WHERE table_name = '${store.traceTable}'`
      );
      const columns = traceTableInfo.rows.map((row) => row.column_name);

      expect(columns).toEqual([
        "start_time",
        "end_time",
        "expire_at",
        "trace_id",
        "display_name",
      ]);

      const spanTableInfo = await pool.query(
        `SELECT * FROM information_schema.columns WHERE table_name = '${store.spanTable}'`
      );
      const spanColumns = spanTableInfo.rows.map((row) => row.column_name);

      const expectedColumns = [
        "truncated",
        "status",
        "instrumentation_library",
        "same_process_as_parent_span",
        "expire_at",
        "start_time",
        "attributes",
        "end_time",
        "links",
        "time_events",
        "span_kind",
        "trace_id",
        "parent_span_id",
        "display_name",
        "id",
      ];
      expect(spanColumns).toEqual(expectedColumns);
    });
  });

  describe("save", () => {
    test("should save the trace data correctly", async () => {
      await store.save(traceDataExample.traceId, traceDataExample as TraceData);
      const result = await pool.query(
        `SELECT * FROM ${store.traceTable} WHERE trace_id = '${traceDataExample.traceId}'`
      );
      expect(result.rows).toHaveLength(1);

      const serializedStartTime = new Date(traceDataExample.startTime!);
      const serializedEndTime = new Date(traceDataExample.endTime!);

      const expectedData = {
        trace_id: "trace123456",
        display_name: "Sample Trace for API Request",
        start_time: serializedStartTime,
        end_time: serializedEndTime,
        expire_at: expect.any(Date),
      };

      expect(result.rows[0]).toEqual(expectedData);

      const spanResult = await pool.query(
        `SELECT * FROM ${store.spanTable} WHERE trace_id = '${traceDataExample.traceId}'`
      );

      expect(spanResult.rows).toHaveLength(1);

      const expectedSpanData = {
        attributes: {
          "http.method": "GET",
          "http.url": "https://example.com/api/resource",
        },
        display_name: "GET /api/resource",
        end_time: new Date(traceDataExample.spans.span123.endTime),
        expire_at: expect.any(Date),
        id: "span123",
        instrumentation_library: {
          name: "opentelemetry/web",
          schemaUrl: "https://opentelemetry.io/schemas/1.0.0",
          version: "1.0.0",
        },
        links: [
          {
            attributes: {
              connectionType: "SSL",
              error: false,
            },
            context: {
              isRemote: true,
              spanId: "otherSpan321",
              traceFlags: 1,
              traceId: "otherTrace123",
            },
            droppedAttributesCount: 0,
          },
        ],
        parent_span_id: "span122",
        same_process_as_parent_span: true,
        span_kind: "CLIENT",
        start_time: new Date(traceDataExample.spans.span123.startTime),
        status: {
          code: 0,
          message: "Success",
        },
        time_events: {
          timeEvent: [
            {
              annotation: {
                attributes: {
                  cacheHit: true,
                  latency: "50ms",
                },
                description: "Cache hit during processing",
              },
              time: 1617981380000,
            },
          ],
        },
        trace_id: "trace123456",
        truncated: false,
      };

      // Now you can use `spanData` object in your JavaScript code.

      expect(spanResult.rows[0]).toEqual(expectedSpanData);
    });
  });

  describe("load", () => {
    test("should load the trace data correctly", async () => {
      await store.save(traceDataExample.traceId, traceDataExample as TraceData);

      const loadedData = await store.load(traceDataExample.traceId);

      console.log(loadedData);
      expect(loadedData).toEqual(traceDataExample);
    });
  });

  describe("list", () => {
    test("should list the trace data correctly", async () => {
      await store.save(traceDataExample.traceId, traceDataExample as TraceData);

      const listData = await store.list();
      const { traces, continuationToken } = listData;

      expect(traces).toHaveLength(1);
      const listResponse = { ...traceDataExample, spans: {} };
      expect(traces[0]).toEqual(listResponse);
    });
  });
});

// TODO: span ids are not matching
// TODO: list traces
