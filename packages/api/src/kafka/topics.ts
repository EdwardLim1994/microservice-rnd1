// Hand-written, unlike everything under `../generated/` — not produced by APIGenerator, since a
// Kafka topic name isn't derivable from a .proto file (topic naming is a messaging-topology
// concern, not part of the wire schema). This is the one place a topic's name is paired with its
// generated message/schema types, so every server that produces or consumes `test1.events`
// imports the same declaration instead of each re-declaring the literal locally.
//
// Test1EventSchema is imported from its concrete generated file, not the top-level `../generated`
// barrel: APIGenerator's barrel step only scans each server's `graphql/`/`proto/` output, not
// `protobufes/` (see packages/api/CLAUDE.md), so a barrel-level `Test1EventProtobufEs` re-export
// gets silently dropped on every `bun run gen` — which broke this file on every regen. The
// concrete `test1event_pb.ts` file itself is real protoc-gen-es codegen output, regenerated
// deterministically every time, so depending on it directly sidesteps that gap entirely.
import { Test1Test1eventProto } from '../generated';
import { Test1EventSchema } from '../generated/test1/protobufes/test1event_pb';

// { topicName: tsProtoGeneratedMessage } — used for KafkaDriverConfig.topics (provisioning) and
// as a KafkaConsumerRouter's topicTypes (topic enumeration + decoded-type inference).
export const test1EventsTopics = {
  'test1.events': Test1Test1eventProto.Test1Event,
};

// { topicName: protobufEsSchema } — used for SchemaRegistryKafkaSerializerConfig.schemas, only by
// whichever server actually produces to this topic (currently test1).
export const test1EventsSchemas = {
  'test1.events': Test1EventSchema,
};
