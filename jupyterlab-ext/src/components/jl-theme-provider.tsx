import React, { useState, useEffect } from 'react';
import { Theme, ThemeProvider, createTheme } from '@mui/material/styles';

function getCSSVariable(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function pollUntilReady(): Promise<void> {
  return new Promise(resolve => {
    const check = () => {
      if (document.body.hasAttribute('data-jp-theme-light')) resolve();
      else setTimeout(check, 100);
    };
    check();
  });
}

async function getJupyterLabTheme(): Promise<Theme> {
  await pollUntilReady();
  const light = document.body.getAttribute('data-jp-theme-light') === 'true';
  return createTheme({
    spacing: 4,
    components: {
      MuiButton: {
        defaultProps: { size: 'small', variant: 'text' as const },
        styleOverrides: { root: { minWidth: '24px', width: '24px', height: '24px', lineHeight: 0, '&:disabled': { opacity: 0.5 } } },
      },
      MuiIconButton: {
        defaultProps: { size: 'small' },
        styleOverrides: { root: { minWidth: '24px', width: '24px', height: '24px', lineHeight: 0, '&:disabled': { opacity: 0.5 }, '& .MuiSvgIcon-root:not([fontSize])': { fontSize: 'medium' } } },
      },
      MuiTextField: { defaultProps: { margin: 'dense', size: 'small' } },
    },
    palette: {
      mode: light ? 'light' : 'dark',
      primary: { main: getCSSVariable(`--jp-brand-color${light ? '1' : '2'}`), light: getCSSVariable('--jp-brand-color2'), dark: getCSSVariable('--jp-brand-color0') },
      error: { main: getCSSVariable('--jp-error-color1'), light: getCSSVariable('--jp-error-color2'), dark: getCSSVariable('--jp-error-color0') },
      text: { primary: getCSSVariable('--jp-ui-font-color1'), secondary: getCSSVariable('--jp-ui-font-color2'), disabled: getCSSVariable('--jp-ui-font-color3') }
    },
    shape: { borderRadius: 2 },
    typography: { fontFamily: getCSSVariable('--jp-ui-font-family'), fontSize: 12, htmlFontSize: 16, button: { textTransform: 'capitalize' as const } }
  });
}

export function JlThemeProvider(props: { themeManager?: any | null; children: React.ReactNode }): JSX.Element {
  const [theme, setTheme] = useState<Theme>(createTheme());
  useEffect(() => {
    getJupyterLabTheme().then(setTheme);
  }, []);
  return <ThemeProvider theme={theme}>{props.children}</ThemeProvider>;
}
