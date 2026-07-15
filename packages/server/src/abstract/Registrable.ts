// A router that must be explicitly wired into its own driver's raw server object — the opt-in
// contract only GrpcRouter implements: @grpc/grpc-js's addService() is the sole way to attach a
// service to a Server, so GrpcDriver has no other way to read a router's routing surface.
// CronRouter/KafkaConsumerRouter/GraphqlRouter don't implement this at all — their own drivers
// (CronDriver/KafkaDriver/ApolloDriver) read schedules/dispatchers, topics/dispatchers, and
// typeDefs/resolvers directly instead, the same way GrpcDriver reads Registrable routers here.
export interface Registrable {
  register(server: unknown): void;
}

/** Duck-types a router as `Registrable` (has a `register(server)` function). */
export function isRegistrable(router: unknown): router is Registrable {
  return (
    typeof router === 'object' &&
    router !== null &&
    'register' in router &&
    typeof (router as Registrable).register === 'function'
  );
}
