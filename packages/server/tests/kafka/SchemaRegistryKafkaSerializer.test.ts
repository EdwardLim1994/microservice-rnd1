import { expect, test } from '@rstest/core';
import type { DescMessage } from '@bufbuild/protobuf';
import {
  SchemaRegistryKafkaSerializer,
  type ProtobufDeserializerLike,
  type ProtobufSerializerLike,
} from '../../src/kafka/SchemaRegistryKafkaSerializer';

const Demo1Schema = { name: 'Demo1Schema' } as unknown as DescMessage;

function makeMockSerde() {
  const added: DescMessage[] = [];
  const serialized: { topic: string; message: unknown }[] = [];
  const deserializeCalls: { topic: string; payload: Buffer }[] = [];
  const serializeResult = Buffer.from('serialized');
  const deserializeResult = { id: '1', name: 'hello' };

  const serializer: ProtobufSerializerLike = {
    registry: {
      add: (schema) => {
        added.push(schema);
      },
    },
    serialize: async (topic, message) => {
      serialized.push({ topic, message });
      return serializeResult;
    },
  };

  const deserializer: ProtobufDeserializerLike = {
    deserialize: async (topic, payload) => {
      deserializeCalls.push({ topic, payload });
      return deserializeResult;
    },
  };

  return {
    serializer,
    deserializer,
    added,
    serialized,
    deserializeCalls,
    serializeResult,
    deserializeResult,
  };
}

function makeSerializer(
  mock: ReturnType<typeof makeMockSerde>,
  schemas?: Record<string, DescMessage>,
) {
  return new SchemaRegistryKafkaSerializer(
    { schemas },
    (schema, value) => ({ schema, value }),
    () => ({ serializer: mock.serializer, deserializer: mock.deserializer }),
  );
}

test('registers every configured schema with the serializer up front', () => {
  const mock = makeMockSerde();
  makeSerializer(mock, { 'demo1.events': Demo1Schema });

  expect(mock.added).toEqual([Demo1Schema]);
});

test('constructing with no schemas configured is fine — decode-only usage needs none', () => {
  const mock = makeMockSerde();
  expect(() => makeSerializer(mock)).not.toThrow();
  expect(mock.added).toEqual([]);
});

test('serialize() builds a message via createMessage and delegates to the serializer', async () => {
  const mock = makeMockSerde();
  const serializer = makeSerializer(mock, { 'demo1.events': Demo1Schema });

  const result = await serializer.serialize('demo1.events', { id: '1' });

  expect(mock.serialized).toEqual([
    {
      topic: 'demo1.events',
      message: { schema: Demo1Schema, value: { id: '1' } },
    },
  ]);
  expect(result).toBe(mock.serializeResult);
});

test('serialize() throws for a topic with no registered schema', async () => {
  const mock = makeMockSerde();
  const serializer = makeSerializer(mock, { 'demo1.events': Demo1Schema });

  await expect(
    serializer.serialize('unknown.topic', { id: '1' }),
  ).rejects.toThrow(/no schema registered for topic "unknown.topic"/);
});

test('deserialize() delegates to the deserializer for the given topic', async () => {
  const mock = makeMockSerde();
  const serializer = makeSerializer(mock);

  const payload = new TextEncoder().encode('bytes');
  const result = await serializer.deserialize('demo1.events', payload);

  expect(mock.deserializeCalls).toEqual([
    { topic: 'demo1.events', payload: Buffer.from(payload) },
  ]);
  expect(result).toEqual(mock.deserializeResult);
});

test('decoder() binds deserialize() to one topic, satisfying KafkaMessageType<T>', async () => {
  const mock = makeMockSerde();
  const serializer = makeSerializer(mock);

  const decoder = serializer.decoder<{ id: string; name: string }>(
    'demo1.events',
  );
  const result = await decoder.decode(new Uint8Array());

  expect(mock.deserializeCalls[0]?.topic).toBe('demo1.events');
  expect(result).toEqual(mock.deserializeResult);
});
