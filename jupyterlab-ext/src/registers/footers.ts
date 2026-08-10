import { Token } from '@lumino/coreutils';
import { IChatModel } from '../model';
import { IMessageContent } from '../types';

export type MessageFooterSectionProps = { model: IChatModel; message: IMessageContent; };
export type MessageFooterSection = { component: React.FC<MessageFooterSectionProps>; position: 'left' | 'center' | 'right'; };
export type MessageFooter = { left?: MessageFooterSection; center?: MessageFooterSection; right?: MessageFooterSection; };

export interface IMessageFooterRegistry {
  getFooter(): MessageFooter;
  addSection(section: MessageFooterSection): void;
}

export class MessageFooterRegistry implements IMessageFooterRegistry {
  getFooter(): MessageFooter { return this._footers; }
  addSection(footer: MessageFooterSection): void { this._footers[footer.position] = footer; }
  private _footers: MessageFooter = {};
}
