/**
 * Marker base class shared by every router type. Registration into a raw protocol server is an
 * opt-in capability (see Registrable), not a universal one — GrpcRouter is the only subclass that
 * implements it; CronRouter/KafkaConsumerRouter/GraphqlRouter never did and don't need to.
 */
export abstract class BaseRouter {}
