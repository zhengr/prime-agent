import { IInputModel } from '../../input-model';
import { IChatCommandRegistry } from '../../registers';

export async function submitInputMessage(options: submitInputMessage.IOptions): Promise<void> {
  const { model, chatCommandRegistry, body } = options;
  await chatCommandRegistry?.onSubmit(model);
  model.send(body ?? model.value);
  model.focus();
}

export namespace submitInputMessage {
  export interface IOptions {
    model: IInputModel;
    chatCommandRegistry?: IChatCommandRegistry;
    body?: string;
  }
}
