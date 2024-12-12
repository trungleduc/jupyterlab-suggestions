import { ISharedCell, NotebookChange, YCellType } from '@jupyter/ydoc';
import {
  CellModel,
  CodeCellModel,
  ICellModel,
  MarkdownCellModel,
  RawCellModel
} from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';

import { IDict } from './types';

/**
 * Generates a mapping of cell IDs to cell models for a given notebook.
 *
 * @param {NotebookPanel | null} nb - The notebook panel from which to
 * extract cell models.
 * @returns {IDict<ICellModel>} - A dictionary mapping cell IDs to their
 * respective cell models.
 */
export function getCellMap(nb: NotebookPanel | null): IDict<ICellModel> {
  const cellMap: IDict<ICellModel> = {};
  [...(nb?.model?.cells ?? [])].forEach(it => {
    cellMap[it.id] = it;
  });
  return cellMap;
}

/**
 * Detects changes to cells in a notebook and classifies the type of change.
 *
 * @param {NotebookChange} changed - The change event to analyze.
 * @returns {Object | undefined} - An object describing the type of event:
 *   - If cells were deleted: `{ event: 'deleted' }`
 *   - If cells were moved: `{ event: 'moved', movedCells: ISharedCell[] }`
 *   - Otherwise, returns `undefined`.
 */
export function detectCellChangedEvent(changed: NotebookChange):
  | {
      event: 'deleted' | 'moved';
      movedCells?: ISharedCell[];
    }
  | undefined {
  const { cellsChange } = changed;

  if (cellsChange) {
    let haveDelete = false;
    let haveInsert: ISharedCell[] | undefined;
    let haveRetain = false;
    for (const c of cellsChange) {
      if (c.delete !== undefined) {
        haveDelete = true;
      }
      if (c.insert !== undefined) {
        haveInsert = c.insert;
      }
      if (c.retain !== undefined) {
        haveRetain = true;
      }
    }
    if (haveDelete) {
      if (haveRetain && haveInsert) {
        return { event: 'moved', movedCells: haveInsert };
      }
      return { event: 'deleted' };
    }
  }
  return;
}

/**
 * Creates a cell model from a YCellType instance based on its cell type.
 *
 * @param {Object} options - The options for creating the cell model.
 * @param {YCellType} options.yCell - The YCellType instance representing
 *  the shared cell model.
 * @param {string} options.mimeType - The MIME type to assign to the cell
 *  model (used for code cells).
 * @returns {CellModel | undefined} - The created cell model (CodeCellModel,
 *  MarkdownCellModel, or RawCellModel) or `undefined` if the cell type
 *  is unsupported.
 */
export function cellModelFromYCell(options: {
  yCell: YCellType;
  mimeType: string;
}): CellModel | undefined {
  let copiedCellModel: CellModel | undefined;
  const { yCell, mimeType } = options;
  switch (yCell.cell_type) {
    case 'code': {
      copiedCellModel = new CodeCellModel({
        sharedModel: yCell
      });
      copiedCellModel.mimeType = mimeType;
      break;
    }
    case 'markdown': {
      copiedCellModel = new MarkdownCellModel({
        sharedModel: yCell
      });
      break;
    }
    case 'raw': {
      copiedCellModel = new RawCellModel({
        sharedModel: yCell
      });
      break;
    }
    default:
      break;
  }
  return copiedCellModel;
}
