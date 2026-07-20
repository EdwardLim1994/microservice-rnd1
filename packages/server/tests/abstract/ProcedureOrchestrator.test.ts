import { expect, test } from '@rstest/core';
import { asValue, createContainer, InjectionMode } from 'awilix';
import { BaseUseCase } from '../../src/abstract/BaseUseCase';
import { ProcedureOrchestrator } from '../../src/abstract/ProcedureOrchestrator';

interface Context {
  orderId: string;
  reserved?: boolean;
  charged?: boolean;
}

const calls: string[] = [];

class ReserveInventoryUseCase extends BaseUseCase<Context, Partial<Context>> {
  async execute() {
    calls.push('reserve');
    return { reserved: true };
  }
}
class ReleaseInventoryUseCase extends BaseUseCase<Context, void> {
  async execute() {
    calls.push('release');
  }
}

class ChargePaymentUseCase extends BaseUseCase<Context, Partial<Context>> {
  async execute(): Promise<Partial<Context>> {
    calls.push('charge');
    throw new Error('payment declined');
  }
}
class RefundPaymentUseCase extends BaseUseCase<Context, void> {
  async execute() {
    calls.push('refund');
  }
}

class OrderSaga extends ProcedureOrchestrator<Context> {
  protected build() {
    this.procedure(ReserveInventoryUseCase, ReleaseInventoryUseCase).procedure(
      ChargePaymentUseCase,
      RefundPaymentUseCase,
    );
  }
}

function makeContainer() {
  const container = createContainer({ injectionMode: InjectionMode.PROXY });
  container.register({ container: asValue(container) });
  return container;
}

test('runs steps in order, merging each step output into the shared context', async () => {
  calls.length = 0;
  const container = makeContainer();
  const saga = new OrderSaga({ container } as any);

  await expect(saga.execute({ orderId: '1' })).rejects.toThrow(
    'payment declined',
  );

  // reserve committed, charge failed -> only reserve's fallback (release) compensates
  expect(calls).toEqual(['reserve', 'charge', 'release']);
});

test('returns the merged context when every step succeeds', async () => {
  class HappySaga extends ProcedureOrchestrator<Context> {
    protected build() {
      this.procedure(ReserveInventoryUseCase, ReleaseInventoryUseCase);
    }
  }
  const container = makeContainer();
  const saga = new HappySaga({ container } as any);

  const result = await saga.execute({ orderId: '2' });

  expect(result).toEqual({ orderId: '2', reserved: true });
});

test('retries a step until it succeeds, without compensating', async () => {
  let attempts = 0;
  class FlakyUseCase extends BaseUseCase<Context, Partial<Context>> {
    async execute() {
      attempts++;
      if (attempts < 3) throw new Error('transient failure');
      return { charged: true };
    }
  }
  class NoopFallback extends BaseUseCase<Context, void> {
    async execute() {
      calls.push('noop-fallback');
    }
  }

  class RetrySaga extends ProcedureOrchestrator<Context> {
    protected build() {
      this.procedure(FlakyUseCase, NoopFallback, { retries: 2 });
    }
  }
  calls.length = 0;
  const saga = new RetrySaga({ container: makeContainer() } as any);

  const result = await saga.execute({ orderId: '3' });

  expect(attempts).toBe(3);
  expect(result).toEqual({ orderId: '3', charged: true });
  expect(calls).toEqual([]);
});

test('gives up and compensates after exhausting retries', async () => {
  let attempts = 0;
  class AlwaysFailsUseCase extends BaseUseCase<Context, Partial<Context>> {
    async execute(): Promise<Partial<Context>> {
      attempts++;
      throw new Error('permanent failure');
    }
  }

  class RetrySaga extends ProcedureOrchestrator<Context> {
    protected build() {
      this.procedure(
        ReserveInventoryUseCase,
        ReleaseInventoryUseCase,
      ).procedure(AlwaysFailsUseCase, ChargePaymentUseCase as any, {
        retries: 1,
      });
    }
  }
  calls.length = 0;
  const saga = new RetrySaga({ container: makeContainer() } as any);

  await expect(saga.execute({ orderId: '4' })).rejects.toThrow(
    'permanent failure',
  );
  expect(attempts).toBe(2);
  expect(calls).toEqual(['reserve', 'release']);
});

test('a step that never resolves is aborted by timeoutMs', async () => {
  class HangingUseCase extends BaseUseCase<Context, Partial<Context>> {
    execute(): Promise<Partial<Context>> {
      return new Promise(() => {});
    }
  }
  class NoopFallback extends BaseUseCase<Context, void> {
    async execute() {}
  }

  class TimeoutSaga extends ProcedureOrchestrator<Context> {
    protected build() {
      this.procedure(HangingUseCase, NoopFallback, { timeoutMs: 20 });
    }
  }
  const saga = new TimeoutSaga({ container: makeContainer() } as any);

  await expect(saga.execute({ orderId: '5' })).rejects.toThrow(
    'procedure timed out after 20ms',
  );
});
