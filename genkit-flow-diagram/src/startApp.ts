import { getApp } from "./app";

const startApp = async () => {
  const app = getApp();
  const port = process.env.GENKIT_FLOW_DIAGRAMS_PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startApp();
