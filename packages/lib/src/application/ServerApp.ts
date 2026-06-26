import type { BaseServer } from "../shared";

export default class ServerApp {
  private sidecar?: BaseServer;

  private constructor(private readonly app: BaseServer) { }

  public static init(app: BaseServer) {
    return new ServerApp(app);
  }

  public database() {
    return this;
  }

  public withSideCar(app: BaseServer) {
    this.sidecar = app;
    return this;
  }

  public async run() {
    await this.app.run();

    if (this.sidecar) {
      await this.sidecar.run();
    }
  }
}
