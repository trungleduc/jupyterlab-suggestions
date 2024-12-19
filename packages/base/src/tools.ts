import {
  ISharedCell,
  NotebookChange,
  YCellType,
  YNotebook
} from '@jupyter/ydoc';
import {
  CellModel,
  CodeCellModel,
  ICellModel,
  MarkdownCellModel,
  RawCellModel
} from '@jupyterlab/cells';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';

import { IDict } from './types';
import { PromiseDelegate } from '@lumino/coreutils';

export const COMMAND_IDS = {
  /**
   * Command to add a cell suggestion.
   */
  addCellSuggestion: 'jupyter-suggestions-core:add-cell-suggestion',
  /**
   * Command to add a cell deletion suggestion.
   */
  addDeleteCellSuggestion: 'jupyter-suggestions-core:add-delete-cell-suggestion'
};

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
      deletedIdx?: number;
    }
  | undefined {
  const { cellsChange } = changed;

  if (cellsChange) {
    let haveDelete = false;
    let haveInsert: ISharedCell[] | undefined;
    let haveRetain = false;
    let retainIndex = 0;
    let deleteIndex = 0;
    for (const c of cellsChange) {
      if (c.delete !== undefined) {
        haveDelete = true;
        deleteIndex = c.delete;
      }
      if (c.insert !== undefined) {
        haveInsert = c.insert;
      }
      if (c.retain !== undefined) {
        haveRetain = true;
        retainIndex = c.retain;
      }
    }
    if (haveDelete) {
      if (haveRetain && haveInsert) {
        return { event: 'moved', movedCells: haveInsert };
      }
      return { event: 'deleted', deletedIdx: retainIndex + deleteIndex - 1 };
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

/**
 * Delete a cell in the shared notebook by id
 *
 * @param {{
 *   currentNotebook: Notebook;
 *   sharedModel: ISharedDocument;
 * }} options
 */
export async function deleteCellById(options: {
  cellId: string;
  sharedModel?: YNotebook;
  defaultCell?: string;
  currentNotebook?: Notebook;
}): Promise<boolean> {
  const { cellId, defaultCell, currentNotebook } = options;
  let sharedModel = options.sharedModel;

  const pd = new PromiseDelegate<boolean>();
  if (currentNotebook) {
    sharedModel = currentNotebook.model?.sharedModel as YNotebook;
  }
  if (sharedModel) {
    let cellIndex = -1;
    const allCells = sharedModel.cells;
    for (let index = 0; index < allCells.length; index++) {
      const element = allCells[index];
      if (element.getId() === cellId) {
        cellIndex = index;
        break;
      }
    }

    if (cellIndex !== -1) {
      const handler = (nb: YNotebook, changed: NotebookChange) => {
        const cellChangedEvent = detectCellChangedEvent(changed);
        if (cellChangedEvent?.event === 'deleted') {
          const deletedIndex = cellChangedEvent.deletedIdx;
          if (deletedIndex === cellIndex) {
            pd.resolve(true);
            sharedModel.changed.disconnect(handler);
          }
        }
      };
      sharedModel.changed.connect(handler);
      sharedModel.transact(() => {
        sharedModel.deleteCell(cellIndex);
        // Add a new cell if the notebook is empty. This is done
        // within the compound operation to make the deletion of
        // a notebook's last cell undoable.
        if (sharedModel.cells.length === 1) {
          sharedModel.insertCell(0, {
            cell_type: defaultCell ?? 'code',
            metadata:
              defaultCell === 'code'
                ? {
                    trusted: true
                  }
                : {}
          });
        }
        if (currentNotebook) {
          currentNotebook.activeCellIndex = cellIndex;
        }
      });
      currentNotebook?.deselectAll();
    }
  } else {
    pd.resolve(false);
  }
  return pd.promise;
}

export function cloneCellModel(
  cellModel: ICellModel,
  newSource?: string
): ICellModel {
  let copiedCellModel: CellModel | undefined;
  const mimeType = cellModel.mimeType;
  switch (cellModel.type) {
    case 'code': {
      copiedCellModel = new CodeCellModel();
      break;
    }
    case 'markdown': {
      copiedCellModel = new MarkdownCellModel();
      break;
    }
    case 'raw': {
      copiedCellModel = new RawCellModel();
      break;
    }
    default:
      break;
  }

  if (!copiedCellModel) {
    throw new Error('Invalid cell type');
  }
  copiedCellModel.mimeType = mimeType;
  copiedCellModel.sharedModel.setSource(
    newSource ?? cellModel.sharedModel.getSource()
  );
  return copiedCellModel;
}
