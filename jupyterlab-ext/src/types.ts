import { PromiseDelegate } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';

export interface IUser {
  username: string;
  name?: string;
  display_name?: string;
  initials?: string;
  color?: string;
  avatar_url?: string;
  mention_name?: string;
  bot?: boolean;
}

export interface IConfig {
  sendWithShiftEnter?: boolean;
  stackMessages?: boolean;
  enableCodeToolbar?: boolean;
  showDeleted?: boolean;
}

export type IMessageContent<T = IUser> = {
  type: string;
  body: string;
  id: string;
  time: number;
  sender: T;
  attachments?: IAttachment[];
  mentions?: T[];
  raw_time?: boolean;
  deleted?: boolean;
  edited?: boolean;
  stacked?: boolean;
  metadata?: IMessageMetadata;
  mime_model?: { data: Record<string, string> };
};

export interface IMessageMetadata {}

export interface IMessage extends IMessageContent {
  update(updated: Partial<IMessageContent>): void;
  content: IMessageContent;
  changed: ISignal<IMessage, void>;
  renderedDelegate: PromiseDelegate<void>;
}

export interface IChatHistory {
  messages: IMessageContent[];
}

export type INewMessage<T = IUser> = Partial<
  Pick<IMessageContent<T>, 'body' | 'attachments' | 'mentions' | 'metadata' | 'mime_model' | 'sender'>
>;

export type IAttachment = IFileAttachment | INotebookAttachment;

export interface IFileAttachment {
  type: 'file';
  value: string;
  mimetype?: string;
}

export interface INotebookAttachment {
  type: 'notebook';
  value: string;
  mimetype?: string;
  cells?: INotebookAttachmentCell[];
}

export interface INotebookAttachmentCell {
  id: string;
  input_type: 'raw' | 'markdown' | 'code';
}

export type ChatArea = 'sidebar' | 'main';
