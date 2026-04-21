// Agent Swarm Server entry point
// Delegates to app.ts which contains all Express configuration
// app.ts auto-starts the server when run directly (detected via process.argv)
export { app, server, startServer } from "./app.js";
