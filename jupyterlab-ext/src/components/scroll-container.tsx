import React, { forwardRef, useMemo } from 'react';
import { Box, SxProps, Theme } from '@mui/material';

type ScrollContainerProps = { children: React.ReactNode; sx?: SxProps<Theme>; };

export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  function ScrollContainer(props, ref) {
    const id = useMemo(() => 'jupyter-chat-scroll-container-' + Date.now().toString(), []);
    return (
      <Box ref={ref} id={id} sx={{ overflowY: 'scroll', overflowAnchor: 'none', ...props.sx }}>
        {props.children}
      </Box>
    );
  }
);
