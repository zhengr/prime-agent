/*
 * Prime Agent JupyterLab Chat - Type Definitions
 * Aligned with jupyter-chat IChatModel / IMessage interfaces.
 */

/**
 * Chat area: sidebar or main panel.
 */
export type ChatArea = 'sidebar' | 'main';

/**
 * User representation.
 */
export interface IUser {
  username: string;
  name?: string;
  display_name?: string;
  bot?: boolean;
  avatar_url?: string;
  mention_name?: string;
}

/**
 * Message attachment.
 */
export interface IAttachment {
  id: string;
  name: string;
  mime_type: string;
  size?: number;
  url?: string;
}

/**
 * Message content.
 */
export interface IMessageContent {
  body?: string; // Optional alias for content
  content: string;
  role?: "user" | "assistant" | "system";
  sender: IUser;
  time: number; // Unix timestamp in seconds
  attachments?: IAttachment[];
  mentions?: string[];
  deleted?: boolean;
  edited?: boolean;
  stacked?: boolean; // Consecutive messages from same sender
  raw_time?: boolean; // Unverified timestamp
}

/**
 * Full message with ID.
 */
export interface IMessage extends IMessageContent {
  id: string;
}

/**
 * New message payload for sending.
 */
export interface INewMessage {
  body: string;
  attachments?: IAttachment[];
  mentions?: string[];
}

/**
 * Chat configuration.
 */
export interface IConfig {
  sendWithShiftEnter?: boolean;
  enableCodeToolbar?: boolean;
  showDeleted?: boolean;
  sendWithSelection?: boolean;
}

/**
 * Writer (user currently typing).
 */
export interface IWriter {
  user: IUser;
  last_activity: number;
}

/**
 * Streaming state.
 */
export interface IStreamingState {
  active: boolean;
  messageId: string | null;
  buffer: string;
  abortController: AbortController | null;
}

/**
 * Input toolbar item.
 */
export interface IToolbarItem {
  id: string;
  icon: string; // CSS class or SVG
  tooltip: string;
  handler: (inputModel: IInputModel) => void;
  disabled?: boolean;
}

/**
 * Input model interface.
 */
export interface IInputModel {
  value: string;
  cursorIndex: number | null;
  attachments: IAttachment[];
  config: IConfig;
}

/**
 * Code selection from editor/notebook.
 */
export interface ICodeSelection {
  text: string;
  language?: string;
  numLines: number;
}

/**
 * CodeToolbar action result.
 */
export interface ICodeAction {
  success: boolean;
  message?: string;
}

/**
 * Message rendering delegate.
 */
export interface IMessageRenderDelegate {
  rendered: Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
}
