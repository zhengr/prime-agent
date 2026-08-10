import CloseIcon from '@mui/icons-material/Close';
import { Box, Tooltip } from '@mui/material';
import React from 'react';
import { TooltippedIconButton } from './mui-extras';
import { IAttachment } from '../types';

const ATTACHMENT_CLASS = 'jp-chat-attachment';

function getAttachmentDisplayName(attachment: IAttachment): string {
  if (attachment.type === 'notebook') return attachment.value.split('/').pop() || 'Notebook';
  if (attachment.type === 'file') return attachment.value.split('/').pop() || 'File';
  return (attachment as any).value || 'Attachment';
}

export type AttachmentsProps = { attachments: IAttachment[]; onRemove?: (attachment: IAttachment) => void; };

export function AttachmentPreviewList(props: AttachmentsProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, rowGap: 1, columnGap: 2 }}>
      {props.attachments.map((attachment, i) => (
        <AttachmentPreview key={i} {...props} attachment={attachment} />
      ))}
    </Box>
  );
}

export function AttachmentPreview(props: AttachmentsProps & { attachment: IAttachment }): JSX.Element {
  return (
    <Box className={ATTACHMENT_CLASS} sx={{
      border: '1px solid var(--jp-border-color1)', borderRadius: '2px', px: 1, py: 0.5,
      backgroundColor: 'var(--jp-layout-color2)', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8125rem'
    }}>
      <Tooltip title={props.attachment.value} placement="top" arrow>
        <Box component="span">{getAttachmentDisplayName(props.attachment)}</Box>
      </Tooltip>
      {props.onRemove && (
        <TooltippedIconButton tooltip="Remove" onClick={() => props.onRemove!(props.attachment)}
          inputToolbar={false} sx={{ width: 'unset', minWidth: 'unset', height: 'unset', padding: 0 }}>
          <CloseIcon fontSize="small" />
        </TooltippedIconButton>
      )}
    </Box>
  );
}
