import { Token } from '@lumino/coreutils';
import { IInputModel } from '../input-model';

export const IChatCommandRegistry = new Token<IChatCommandRegistry>('@jupyter/chat:IChatCommandRegistry');

export type ChatCommand = {
  name: string;
  providerId: string;
  icon?: any;
  description?: string;
  replaceWith?: string;
  spaceOnAccept?: boolean;
};

export interface IChatCommandProvider {
  id: string;
  listCommandCompletions(inputModel: IInputModel): Promise<ChatCommand[]>;
  onSubmit(inputModel: IInputModel): Promise<void>;
}

export interface IChatCommandRegistry {
  addProvider(provider: IChatCommandProvider): void;
  getProviders(): IChatCommandProvider[];
  onSubmit(inputModel: IInputModel): Promise<void>;
}

export class ChatCommandRegistry implements IChatCommandRegistry {
  constructor() { this._providers = new Map(); }
  addProvider(provider: IChatCommandProvider): void { this._providers.set(provider.id, provider); }
  getProviders(): IChatCommandProvider[] { return Array.from(this._providers.values()); }
  async onSubmit(inputModel: IInputModel): Promise<void> {
    for (const provider of this._providers.values()) { await provider.onSubmit(inputModel); }
  }
  private _providers: Map<string, IChatCommandProvider>;
}
