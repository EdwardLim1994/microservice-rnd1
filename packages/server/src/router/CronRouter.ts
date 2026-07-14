import { type AwilixContainer, asClass } from 'awilix';
import { BaseRouter } from '../abstract/BaseRouter';
import type { BaseUseCase } from '../abstract/BaseUseCase';

// schedule name -> five-field cron expression (or a Bun nickname like "@daily"),
// interpreted in UTC — same syntax Bun.cron itself accepts.
export type CronScheduleMap = Record<string, string>;

export type CronHandlerMap<TSchedules extends CronScheduleMap> = {
  [K in keyof TSchedules]: new (
    ...args: any[]
  ) => BaseUseCase<void, void>;
};

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export abstract class CronRouter<
  TSchedules extends CronScheduleMap,
> extends BaseRouter {
  constructor(protected readonly container: AwilixContainer) {
    super();
  }

  // schedule name -> cron expression, used by CronDriver to call Bun.cron
  abstract get schedules(): TSchedules;
  abstract get handlers(): CronHandlerMap<TSchedules>;

  // schedule name -> resolve + execute, closing over this router's container
  // (same shape as KafkaConsumerRouter.dispatchers — auto-registers use cases transiently)
  get dispatchers(): Record<string, () => Promise<void>> {
    return Object.fromEntries(
      Object.entries(this.handlers).map(([name, UseCase]) => {
        const token = lcFirst((UseCase as any).name);
        if (!this.container.hasRegistration(token)) {
          this.container.register({
            [token]: asClass(UseCase as any).transient(),
          });
        }

        return [
          name,
          async () => {
            const useCase =
              this.container.resolve<BaseUseCase<void, void>>(token);
            await useCase.execute(undefined);
          },
        ];
      }),
    );
  }
}
