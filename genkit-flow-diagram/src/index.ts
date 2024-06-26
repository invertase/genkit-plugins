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
import child_process from "child_process";
import path from "path";

interface GenkitFlowDiagramPluginParams {
  port: number;
}

export const genkitFlowDiagrams: Plugin<[GenkitFlowDiagramPluginParams] | []> =
  genkitPlugin(
    "genkit-flow-diagram",
    async (params?: GenkitFlowDiagramPluginParams) => {
      console.log(
        "Starting genkit-flow-diagram plugin at port",
        params?.port.toString() || "4003"
      );

      const pathToScript = path.join(__dirname, "startApp.js");

      child_process.fork(pathToScript, [], {
        env: {
          GENKIT_REFLECTION_PORT: process.env.GENKIT_REFLECTION_PORT,
          GENKIT_ENV: process.env.GENKIT_ENV,
          GENKIT_FLOW_DIAGRAMS_PORT: params?.port.toString() || "4003",
        },
      });

      return {};
    }
  );
