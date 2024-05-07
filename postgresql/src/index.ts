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

import { genkitPlugin, Plugin } from "@genkit-ai/core";
import { PostgresStateStore } from "./PostgresStateStore";
import { PostgresTraceStore } from "./tracing/PostgresTraceStore";

interface PostgresPluginParams {
  connectionString?: string;
  flowStateStore?: {
    tableName?: string;
  };
  traceStore?: {
    traceTable?: string;
    spanTable?: string;
  };
}

export const postgres: Plugin<[PostgresPluginParams] | []> = genkitPlugin(
  "postgres",
  async (params?: PostgresPluginParams) => ({
    flowStateStore: {
      id: "postgres",
      value: new PostgresStateStore({
        ...params?.flowStateStore,
        connectionString: params?.connectionString,
      }),
    },
    traceStore: {
      id: "postgres",
      value: new PostgresTraceStore({
        ...params?.traceStore,
        connectionString: params?.connectionString,
      }),
    },
  })
);
