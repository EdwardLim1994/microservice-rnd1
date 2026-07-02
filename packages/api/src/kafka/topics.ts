// Hand-written, unlike everything under `../generated/` — not produced by APIGenerator, since a
// Kafka topic name isn't derivable from a .proto file (topic naming is a messaging-topology
// concern, not part of the wire schema). This is the one place a topic's name is paired with its
// generated message/schema types, so every server that produces or consumes `demo1.events`
// imports the same declaration instead of each re-declaring the literal locally.
import { Demo1Demo1eventProto, Demo1EventProtobufEs } from '../generated';

// { topicName: tsProtoGeneratedMessage } — used for KafkaDriverConfig.topics (provisioning) and
// as a KafkaConsumerRouter's topicTypes (topic enumeration + decoded-type inference).
export const demo1EventsTopics = {
  'demo1.events': Demo1Demo1eventProto.Demo1Event,
};

// { topicName: protobufEsSchema } — used for SchemaRegistryKafkaSerializerConfig.schemas, only by
// whichever server actually produces to this topic (currently demo1).
export const demo1EventsSchemas = {
  'demo1.events': Demo1EventProtobufEs.Demo1EventSchema,
};
