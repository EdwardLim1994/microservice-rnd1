export abstract class BaseRepository<TClient> {
  protected readonly prisma: TClient;

  // awilix PROXY mode: constructor receives the cradle, destructure what you need
  constructor({ prisma }: { prisma: TClient }) {
    this.prisma = prisma;
  }
}
