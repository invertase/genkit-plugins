import { Knex } from "knex";
import { randomUUID } from "crypto";
import { logger } from "@genkit-ai/core/logging";
import {
  SpanData,
  SpanDataSchema,
  TraceData,
  TraceDataSchema,
  TraceQuery,
  TraceQueryResponse,
  TraceStore,
} from "@genkit-ai/core/tracing"; // Adjust the import path as needed

export class PostgresTraceStore implements TraceStore {
  readonly knex: Knex;
  readonly traceTable: string;
  readonly spanTable: string;
  readonly expireAfterDays: number;

  constructor(
    params: {
      traceTable?: string;
      spanTable?: string;
      connectionString?: string;
      expireAfterDays?: number;
    } = {}
  ) {
    this.traceTable = params.traceTable || "genkit_traces";
    this.spanTable = params.spanTable || "genkit_spans";
    this.expireAfterDays = params.expireAfterDays || 14;
    const config: Knex.Config = {
      client: "pg",
      connection: params.connectionString,
    };
    this.knex = require("knex")(config);
  }
  async createTablesIfNotExists(): Promise<void> {
    const hasTraceTable = await this.knex.schema.hasTable(this.traceTable);
    const hasSpanTable = await this.knex.schema.hasTable(this.spanTable);

    if (hasTraceTable && hasSpanTable) {
      return;
    }

    if (!hasTraceTable) {
      await this.knex.schema.createTable(this.traceTable, (table) => {
        table.string("trace_id").primary(); // Use trace_id as the primary key
        table.string("display_name").nullable(); // Optional display name for the trace
        table.timestamp("start_time").nullable(); // Optional start time as Unix timestamp
        table.timestamp("end_time").nullable(); // Optional end time as Unix timestamp
        table.timestamp("expire_at").notNullable(); // Mandatory expiration timestamp for trace data lifecycle management
      });
    }

    if (!hasSpanTable) {
      await this.knex.schema.createTable(this.spanTable, (table) => {
        table.string("id").primary();
        table.string("trace_id").notNullable().index();
        table.string("parent_span_id").index();
        table.timestamp("start_time").notNullable();
        table.timestamp("end_time").notNullable();
        table.string("display_name").notNullable();
        table.jsonb("attributes").defaultTo("{}"); // Storing attributes as a JSONB object
        table.string("span_kind").notNullable();
        table.jsonb("links").defaultTo("[]"); // Storing links as a JSONB array
        table.jsonb("time_events").defaultTo("[]"); // Storing time events as a JSONB array
        table.boolean("truncated").defaultTo(false);
        table.jsonb("status").defaultTo("{}"); // Storing status code and optional message in a JSONB object
        table.jsonb("instrumentation_library").defaultTo("{}"); // Storing library details in a JSONB object
        table.boolean("same_process_as_parent_span").defaultTo(true); // Assuming true unless specified
        table.timestamp("expire_at").notNullable();
      });
    }
  }

  async save(traceId: string, traceData: TraceData): Promise<void> {
    await this.createTablesIfNotExists();

    const expireAt = new Date(
      Date.now() + this.expireAfterDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // Prepare trace data for insertion or update, excluding spans from direct storage
    const { displayName, startTime: sT, endTime: eT } = traceData;

    const endTime = this.serializeDate(eT);
    const startTime = this.serializeDate(sT);
    console.log(
      `Expire At: ${expireAt}, Start Time: ${startTime}, End Time: ${endTime}`
    );

    await this.knex(this.traceTable)
      .insert({
        trace_id: traceId,
        display_name: displayName,
        start_time: startTime,
        end_time: endTime,
        expire_at: expireAt,
      })
      .onConflict("trace_id") // Assuming trace_id is set as a primary key
      .merge({
        display_name: displayName,
        start_time: startTime,
        end_time: endTime,
        expire_at: expireAt,
      });

    // Insert or update spans related to the trace
    if (traceData.spans) {
      for (const span of Object.values(traceData.spans)) {
        const spanInsertData = {
          id: span.spanId,
          trace_id: traceId,
          parent_span_id: span.parentSpanId,
          start_time: this.serializeDate(span.startTime),
          end_time: this.serializeDate(span.endTime),
          display_name: span.displayName,
          attributes: JSON.stringify(span.attributes),
          links: JSON.stringify(span.links),
          time_events: JSON.stringify(span.timeEvents),
          truncated: span.truncated,
          status: JSON.stringify(span.status),
          instrumentation_library: JSON.stringify(span.instrumentationLibrary),
          span_kind: span.spanKind,
          same_process_as_parent_span: span.sameProcessAsParentSpan?.value,
          expire_at: expireAt,
        };

        await this.knex(this.spanTable)
          .insert(spanInsertData)
          .onConflict("id") // Assuming id is the primary key for spans
          .merge(spanInsertData);
      }
    }
  }

  serializeDate(time?: number): string | undefined {
    if (!time) return undefined;

    return new Date(time).toISOString();
  }

  deserializeDate(time: string): number {
    return new Date(time).getTime();
  }

  async load(traceId: string): Promise<TraceData | undefined> {
    await this.createTablesIfNotExists();

    // Load trace data from the trace table
    const traceResult = await this.knex(this.traceTable)
      .select(["trace_id", "display_name", "start_time", "end_time"])
      .where("trace_id", traceId)
      .andWhere("expire_at", ">", this.knex.fn.now());

    if (traceResult.length === 0) return undefined;

    const { trace_id, display_name, start_time, end_time, expire_at } =
      traceResult[0];
    const traceData: TraceData = {
      traceId: trace_id,
      displayName: display_name,
      startTime: this.deserializeDate(start_time),
      endTime: this.deserializeDate(end_time),
      spans: {}, // Initialize spans object, to be populated next
    };

    // Load related spans from the span table
    const spansResult = await this.knex(this.spanTable)
      .select([
        "id",
        "parent_span_id",
        "start_time",
        "end_time",
        "display_name",
        "attributes",
        "links",
        "time_events",
        "truncated",
        "status",
        "instrumentation_library",
        "span_kind",
        "same_process_as_parent_span",
      ])
      .where("trace_id", traceId)
      .andWhere("expire_at", ">", this.knex.fn.now());

    spansResult.forEach((row) => {
      const {
        id,
        parent_span_id,
        start_time,
        end_time,
        display_name,
        attributes,
        links,
        time_events,
        truncated,
        status,
        instrumentation_library,
        span_kind,
        same_process_as_parent_span,
      } = row;

      traceData.spans[id] = {
        spanId: id,
        traceId: trace_id,
        parentSpanId: parent_span_id,
        startTime: this.deserializeDate(start_time),
        endTime: this.deserializeDate(end_time),
        displayName: display_name,
        attributes,
        links,
        timeEvents: time_events,
        truncated: truncated,
        status,
        instrumentationLibrary: instrumentation_library,
        spanKind: span_kind,
        sameProcessAsParentSpan: { value: same_process_as_parent_span },
      };
    });

    return traceData;
  }

  async list(query?: TraceQuery): Promise<TraceQueryResponse> {
    await this.createTablesIfNotExists();

    const queryBuilder = this.knex(this.traceTable)
      .select(["trace_id", "display_name", "start_time", "end_time"]) // Select relevant columns
      .where("expire_at", ">", this.knex.fn.now())
      .orderBy("start_time", "desc"); // Order by start_time instead of using raw SQL on JSON data

    const limit = query?.limit || 10;
    queryBuilder.limit(limit);

    if (query?.continuationToken) {
      queryBuilder.offset(parseInt(query.continuationToken));
    }

    const result = await queryBuilder;
    const traces = result.map((row) => {
      // Map the row data into TraceData format, assuming the schema can parse it directly
      return {
        traceId: row.trace_id,
        displayName: row.display_name,
        startTime: this.deserializeDate(row.start_time),
        endTime: this.deserializeDate(row.end_time),
        spans: {}, // Since span data is not included in the basic listing, it's represented as an empty object
      };
    });

    // Assuming the continuation token logic should now use the last item's start_time
    const continuationToken =
      traces.length === limit
        ? String(result[result.length - 1].start_time)
        : undefined;

    return {
      traces: traces,
      continuationToken,
    };
  }

  stop(): void {
    this.knex.destroy();
  }
}
