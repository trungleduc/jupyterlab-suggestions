import { ICellModel, CodeCell, MarkdownCell, RawCell } from '@jupyterlab/cells';
import { BaseCellwidget } from './baseWidget';
import { deletedCellStyle } from './style';

export class SuggestDeleteCellWidget extends BaseCellwidget {
  constructor(options: BaseCellwidget.IOptions) {
    super(options);
  }

  protected _createCell(
    originalCell: ICellModel,
    cellModel: ICellModel,
    liveUpdate: boolean
  ): CodeCell | MarkdownCell | RawCell | undefined {
    const cellWidget = super._createCell(originalCell, cellModel, liveUpdate);
    cellWidget?.addClass(deletedCellStyle);
    return cellWidget;
  }
}
