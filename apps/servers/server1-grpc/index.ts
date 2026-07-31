// bootstrapOtel() must run — and finish — before ./src/app (and therefore GrpcDriver, and
// therefore @grpc/grpc-js) is ever imported: see packages/server/src/otel-bootstrap.ts's own
// docs for why. Importing "server/otel" specifically (not "server") is what makes this work —
// the main "server" entry bundles ApolloDriver/GrpcDriver into the same file, so merely
// importing bootstrapOtel from there would already be too late.
import { bootstrapOtel } from "server/otel";

await bootstrapOtel();

const { default: main } = await import("./src/app");
await main();
