// One serialization strategy shared by both sides of a topic — a producer's KafkaDriverConfig
// (via serialize) and a consumer router's topics map (via deserialize, see
// KafkaMessageType<T> in router/KafkaRouter). Concrete implementations (e.g.
// SchemaRegistryKafkaSerializer) typically back both methods with the same underlying client.
export interface KafkaSerializer {
  serialize(topic: string, value: unknown): Promise<Buffer | Uint8Array>;
  deserialize<T>(topic: string, payload: Uint8Array): Promise<T>;
}
