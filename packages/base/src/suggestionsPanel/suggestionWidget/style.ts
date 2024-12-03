import { style } from 'typestyle';

export const toolbarStyle = style({
  height: '26px',
  borderBottom: 'var(--jp-border-width) solid var(--jp-toolbar-border-color)',
  boxShadow: 'var(--jp-toolbar-box-shadow)',
  background: 'var(--jp-toolbar-background)',
  display: 'flex',
  flexDirection: 'row-reverse'
});
export const toolbarButtonStyle = style({
  margin: '0px!important'
});

export const suggestionCellStyle = style({
  background: 'var(--jp-cell-editor-background)',
  margin: '5px',
  border: 'var(--jp-border-width) solid var(--jp-cell-editor-border-color)',
  $nest: {
    '.minimize': {
      height: 0,
      overflow: 'hidden',
      padding: '0!important'
    }
  }
});
export const suggestionCellSelectedStyle = style({
  border:
    'var(--jp-border-width) solid var(--jp-cell-editor-active-border-color)!important',
  boxShadow: 'var(--jp-elevation-z4)'
});
