import { Token } from '@lumino/coreutils';
import { IAttachment } from '../types';

export const IAttachmentOpenerRegistry = new Token<IAttachmentOpenerRegistry>('@jupyter/chat:IAttachmentOpenerRegistry');

export interface IAttachmentOpenerRegistry {
  get(type: string): ((attachment: IAttachment) => void) | undefined;
  set(type: string, opener: (attachment: IAttachment) => void): void;
}

export class AttachmentOpenerRegistry extends Map<string, (attachment: IAttachment) => void> implements IAttachmentOpenerRegistry {}
