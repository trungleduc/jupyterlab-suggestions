import { style } from 'typestyle';

export const mainPanelStyle = style({});
export const suggestionsWidgetAreaStyle = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  height: '100%'
});

export const suggestionCellStyle = style({
  background: 'var(--jp-cell-editor-background)',
  margin: '5px'
});
export const suggestionCellSelectedStyle = style({
  border:
    'var(--jp-border-width) solid var(--jp-cell-editor-active-border-color)',
  boxShadow: 'var(--jp-elevation-z4)'
});
