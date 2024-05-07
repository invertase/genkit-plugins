/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  FlowState,
  FlowStateQuery,
  FlowStateQueryResponse,
  FlowStateSchema,
  FlowStateStore,
} from "@genkit-ai/core";
import { logger } from "@genkit-ai/core/logging";
import { Pool } from "pg";
import { Knex } from "knex";
import { objectToCamel } from "ts-case-convert/lib/caseConvert";
export class PostgresStateStore implements FlowStateStore {
  readonly knex: Knex;
  readonly tableName: string;

  constructor(
    params: {
      tableName?: string;
      connectionString?: string;
    } = {}
  ) {
    this.tableName = params.tableName || "gk_flows";
    const config: Knex.Config = {
      client: "pg",
      connection: params.connectionString,
      pool: { min: 0, max: 7 }, // Optional: Configure your pool settings here
    };
    this.knex = require("knex")(config);
  }

  stop(): void {
    this.knex.destroy();
  }

  async createTableIfNotExists(): Promise<void> {
    const hasTable = await this.knex.schema.hasTable(this.tableName);

    if (hasTable) {
      return;
    }

    await this.knex.schema.createTable(this.tableName, (table) => {
      table.string("name");
      table.string("flow_id").primary();
      table.jsonb("input");
      table.timestamp("start_time");
      table.jsonb("cache");
      table.jsonb("events_triggered");
      table.jsonb("blocked_on_step");
      table.jsonb("operation");
      table.string("trace_context");
      table.jsonb("executions");
    });
  }

  async load(id: string): Promise<FlowState | undefined> {
    await this.createTableIfNotExists();

    const result = await this.knex
      .select("*")
      .from(this.tableName)
      .where("flow_id", id);
    if (result.length === 0) {
      return undefined;
    }

    const deserializeStartTime =
      new Date(result[0].start_time).getTime() / 1000;
    result[0].start_time = deserializeStartTime;
    return FlowStateSchema.parse(objectToCamel(result[0])); // Assuming data is stored as JSON
  }

  getSaveQuery(id: string, state: FlowState): { query: Knex.QueryBuilder } {
    const {
      name,
      flowId,
      startTime,
      cache,
      eventsTriggered,
      blockedOnStep,
      operation,
      traceContext,
      executions,
      input,
    } = state;

    const serializedStartTime = new Date(startTime * 1000).toISOString();

    const data = {
      name,
      flow_id: flowId,
      input: JSON.stringify(input),
      start_time: serializedStartTime,
      cache: JSON.stringify(cache),
      events_triggered: JSON.stringify(eventsTriggered),
      blocked_on_step: JSON.stringify(blockedOnStep),
      operation,
      trace_context: traceContext,
      executions: JSON.stringify(executions),
    };

    return {
      query: this.knex(this.tableName)
        .insert(data)
        .onConflict("flow_id")
        .merge(),
    };
  }

  async save(id: string, state: FlowState): Promise<void> {
    await this.createTableIfNotExists();
    const { query } = this.getSaveQuery(id, state);
    await query;
    logger.debug(state, "save state");
  }

  async list(query?: FlowStateQuery): Promise<FlowStateQueryResponse> {
    await this.createTableIfNotExists();

    const queryBuilder = this.knex
      .select("*")
      .from(this.tableName)
      .orderBy("start_time", "desc");
    const limit = query?.limit || 10;
    queryBuilder.limit(limit);

    if (query?.continuationToken) {
      queryBuilder.offset(parseInt(query.continuationToken));
    }

    const result = await queryBuilder;
    const deserializeStartTime = (row: any) =>
      ({
        ...row,
        start_time: new Date(row.start_time).getTime() / 1000,
      } as FlowState);

    const flowStates = result
      .map(deserializeStartTime)
      .map(objectToCamel)
      .map((r) => FlowStateSchema.parse(r));
    const continuationToken =
      flowStates.length === limit
        ? String(result[result.length - 1].data.start_time)
        : undefined;

    return {
      flowStates: flowStates,
      continuationToken: continuationToken,
    };
  }
}
