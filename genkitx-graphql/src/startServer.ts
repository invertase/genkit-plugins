import { GenkitApolloServer } from "./GenkitApolloServer";

export const startServer = async () => {
  const server = new GenkitApolloServer({
    port: parseInt(process.env.APOLLO_PORT || "4003"),
    cors: true,
  });
  await server.start();
};

startServer();
