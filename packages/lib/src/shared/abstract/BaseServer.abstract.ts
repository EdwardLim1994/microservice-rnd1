export default abstract class BaseServer {

  protected port: number = 3000;
  protected host: string = "localhost";
  protected name: string = "Base server";


  public abstract run(): Promise<void>;
}
