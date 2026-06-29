import type {
  WriterCommand,
  WriterCommandContext,
} from "../../domain/engine";

export class CommandRegistry {
  private readonly commands = new Map<string, WriterCommand>();

  constructor(commands: WriterCommand[] = []) {
    commands.forEach((command) => this.register(command));
  }

  register(command: WriterCommand) {
    if (this.commands.has(command.id)) {
      throw new Error(`Duplicate command id: ${command.id}`);
    }
    this.commands.set(command.id, command);
  }

  list(): WriterCommand[] {
    return [...this.commands.values()];
  }

  get(id: string): WriterCommand | undefined {
    return this.commands.get(id);
  }

  async execute(id: string, ctx: WriterCommandContext): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Unknown command id: ${id}`);
    }

    await command.run(ctx);
  }

}
