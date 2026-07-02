// Hand-written, unlike everything under `../generated/` — not produced by APIGenerator, since a
// Kafka topic name isn't derivable from a .proto file (topic naming is a messaging-topology
// concern, not part of the wire schema). This is the one place a topic's name is paired with its
// generated message/schema types, so every server that produces or consumes `demo1.events`
// imports the same declaration instead of each re-declaring the literal locally.
//
// Demo1EventSchema is imported from its concrete generated file, not the top-level `../generated`
// barrel: APIGenerator's barrel step only scans each server's `graphql/`/`proto/` output, not
// `protobufes/` (see packages/api/CLAUDE.md), so a barrel-level `Demo1EventProtobufEs` re-export
// gets silently dropped on every `bun run gen` — which broke this file on every regen. The
// concrete `demo1event_pb.ts` file itself is real protoc-gen-es codegen output, regenerated
// deterministically every time, so depending on it directly sidesteps that gap entirely.
import { Demo1Demo1eventProto } from '../generated';
import { Demo1EventSchema } from '../generated/demo1/protobufes/demo1event_pb';

// { topicName: tsProtoGeneratedMessage } — used for KafkaDriverConfig.topics (provisioning) and
// as a KafkaConsumerRouter's topicTypes (topic enumeration + decoded-type inference).
export const demo1EventsTopics = {
  'demo1.events': Demo1Demo1eventProto.Demo1Event,
};

// { topicName: protobufEsSchema } — used for SchemaRegistryKafkaSerializerConfig.schemas, only by
// whichever server actually produces to this topic (currently demo1).
export const demo1EventsSchemas = {
  'demo1.events': Demo1EventSchema,
};
