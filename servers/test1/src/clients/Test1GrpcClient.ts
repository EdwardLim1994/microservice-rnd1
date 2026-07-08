import { credentials } from "@grpc/grpc-js";
import { Test1Test1Proto } from "api";

// Client for this same server's own gRPC endpoint — lets a GraphQL resolver (e.g.
// GetTest1FromGrpcUseCase) fetch data via gRPC instead of duplicating the use case logic.
// Connects lazily on first call, by which point both drivers are already up (ServerApp.run()
// starts every driver concurrently and only resolves once all of them have).
export default class Test1GrpcClient extends Test1Test1Proto.Test1ServiceClient {
	constructor() {
		super(`localhost:${import.meta.env.GRPC_PORT}`, credentials.createInsecure());
	}
}
