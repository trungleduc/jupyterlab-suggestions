import { Cell, ICellModel } from '@jupyterlab/cells';
import { ICell } from '@jupyterlab/nbformat';
import { NotebookPanel } from '@jupyterlab/notebook';
import { User } from '@jupyterlab/services';
import { UUID } from '@lumino/coreutils';

import { BaseSuggestionsManager } from '../baseSuggestionsManager';
import { cloneCellModel, deleteCellById } from '../tools';
import {
  IAllSuggestionData,
  IDict,
  ISuggestionData,
  ISuggestionMetadata,
  ISuggestionsManager,
  SuggestionType
} from '../types';

export interface ISerializedSuggessionData {
  originalCellId: string;
  newSource: string;
  metadata: ISuggestionMetadata;
  type: SuggestionType;
}

const METADATA_KEY = 'jupyter_suggestion';
export class LocalSuggestionsManager
  extends BaseSuggestionsManager
  implements ISuggestionsManager
{
  constructor(options: BaseSuggestionsManager.IOptions) {
    super(options);
    this._tracker = options.tracker;
    this._tracker.widgetAdded.connect(this._notebookAdded, this);
  }

  sourceLiveUpdate = false;

  name = 'Local Suggestion Manager';

  async getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestionData> {
    const path = notebook.context.localPath;
    if (this._suggestionsMap.has(path)) {
      return this._suggestionsMap.get(path) ?? new Map();
    } else {
      const savedSuggestions: IDict<IDict<ISerializedSuggessionData>> =
        notebook.context.model.getMetadata(METADATA_KEY);
      if (savedSuggestions) {
        const currentSuggestion = new Map<string, IDict<ISuggestionData>>();
        const cellList = notebook.content.model?.cells ?? [];
        const cellMap: IDict<ICellModel> = {};
        for (const element of cellList) {
          cellMap[element.id] = element;
        }
        Object.entries(savedSuggestions).forEach(
          ([cellID, serializedCellSuggestions]) => {
            const data: IDict<ISuggestionData> = {};
            Object.entries(serializedCellSuggestions).forEach(
              ([id, serializedData]) => {
                data[id] = this._deserializedSuggestion(
                  serializedData,
                  cellMap
                );
              }
            );
            currentSuggestion.set(cellID, data);
          }
        );
        this._suggestionsMap.set(path, currentSuggestion);
        return currentSuggestion;
      } else {
        return new Map();
      }
    }
  }

  async getSuggestion(options: {
    notebookPath: string;
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionData | undefined> {
    const { notebookPath, cellId, suggestionId } = options;
    if (this._suggestionsMap.has(notebookPath)) {
      const nbSuggestions = this._suggestionsMap.get(notebookPath);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        return nbSuggestions.get(cellId)![suggestionId];
      }
    }
  }
  async addSuggestion(options: {
    notebook: NotebookPanel;
    cell: Cell<ICellModel>;
    author?: User.IIdentity | null;
    type: SuggestionType;
  }): Promise<string> {
    const suggestionId = UUID.uuid4();
    switch (options.type) {
      case SuggestionType.delete:
      case SuggestionType.change: {
        const { notebook, cell, author } = options;
        const path = notebook.context.localPath;
        if (!this._suggestionsMap.has(path)) {
          this._suggestionsMap.set(path, new Map());
        }
        const currentSuggestions = this._suggestionsMap.get(path)!;
        const cellId = cell.model.id;
        if (!currentSuggestions.has(cellId)) {
          currentSuggestions.set(cellId, {});
        }
        const cellSuggesions = currentSuggestions.get(cellId)!;

        const suggestionContent: ISuggestionData = {
          originalCellId: cellId,
          cellModel: cloneCellModel(cell.model),
          metadata: { author },
          type: options.type
        };
        cellSuggesions[suggestionId] = suggestionContent;
        await this._saveSuggestionToMetadata({
          notebook,
          cellId,
          suggestionId,
          suggestionContent
        });
        this._suggestionChanged.emit({
          notebookPath: path,
          cellId,
          suggestionId,
          operator: 'added'
        });
        break;
      }

      default:
        break;
    }

    return suggestionId;
  }

  async acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean> {
    const { notebook, cellId, suggestionId } = options;
    const notebookPath = notebook.context.localPath;
    const currentSuggestion = await this.getSuggestion({
      notebookPath,
      cellId,
      suggestionId
    });
    if (currentSuggestion && notebook.content.model?.cells) {
      switch (currentSuggestion.type) {
        case SuggestionType.change: {
          // In case of a change suggestion. the cell model is always defined
          const newSource =
            currentSuggestion.cellModel!.sharedModel.getSource();
          for (const element of notebook.content.model.cells) {
            if (element.id === cellId) {
              element.sharedModel.setSource(newSource);
              await this.deleteSuggestion(options);
              return true;
            }
          }
          break;
        }
        case SuggestionType.delete: {
          const currentNotebook = notebook.content;
          const { defaultCell } = currentNotebook.notebookConfig;
          const deleted = await deleteCellById({
            currentNotebook,
            cellId,
            defaultCell
          });
          return deleted;
        }
        default:
          break;
      }
    }
    return false;
  }

  async deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void> {
    const { notebook, cellId, suggestionId } = options;
    const notebookPath = notebook.context.localPath;
    if (this._suggestionsMap.has(notebookPath)) {
      const nbSuggestions = this._suggestionsMap.get(notebookPath);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        delete nbSuggestions.get(cellId)![suggestionId];
        await this._removeSuggestionFromMetadata({
          notebook,
          cellId,
          suggestionId
        });
        this._suggestionChanged.emit({
          notebookPath,
          cellId,
          suggestionId,
          operator: 'deleted'
        });
      }
    }
  }

  async updateSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    const { notebook, cellId, suggestionId, newSource } = options;
    const notebookPath = notebook.context.localPath;
    if (this._suggestionsMap.has(notebookPath)) {
      const nbSuggestions = this._suggestionsMap.get(notebookPath);
      if (
        nbSuggestions &&
        nbSuggestions.has(cellId) &&
        nbSuggestions.get(cellId)![suggestionId]
      ) {
        await this._updateSuggestionInMetadata({
          notebook,
          cellId,
          suggestionId,
          newSource
        });
        this._suggestionChanged.emit({
          notebookPath,
          cellId,
          suggestionId,
          operator: 'modified'
        });
      }
    }
  }
  private async _saveSuggestionToMetadata(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    suggestionContent: ISuggestionData;
  }) {
    const { notebook, cellId, suggestionId, suggestionContent } = options;
    const { originalCellId, cellModel, metadata, type } = suggestionContent;
    const currentSuggestions: IDict<IDict<ISerializedSuggessionData>> =
      notebook.context.model.getMetadata(METADATA_KEY) ?? {};
    const serializedData: ISerializedSuggessionData = {
      originalCellId,
      newSource: cellModel?.sharedModel?.getSource() ?? '',
      metadata: metadata,
      type
    };
    const newData = {
      ...currentSuggestions,
      [cellId]: {
        ...(currentSuggestions[cellId] ?? {}),
        [suggestionId]: serializedData
      }
    };
    notebook.context.model.setMetadata(METADATA_KEY, newData);
    await this._saveNotebook(notebook);
  }

  private async _saveNotebook(notebook: NotebookPanel) {
    if (notebook.content.model && !notebook.content.model.collaborative) {
      await notebook.context.save();
    }
  }

  private async _removeSuggestionFromMetadata(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }) {
    const { notebook, cellId, suggestionId } = options;
    const currentSuggestions: IDict | undefined =
      notebook.context.model.getMetadata(METADATA_KEY);
    if (!currentSuggestions || !currentSuggestions[cellId]) {
      return;
    }
    if (currentSuggestions[cellId][suggestionId]) {
      delete currentSuggestions[cellId][suggestionId];
    }
    if (Object.keys(currentSuggestions[cellId]).length === 0) {
      delete currentSuggestions[cellId];
    }
    notebook.context.model.setMetadata(METADATA_KEY, currentSuggestions);
    await this._saveNotebook(notebook);
  }

  private async _updateSuggestionInMetadata(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }) {
    const { notebook, cellId, suggestionId, newSource } = options;
    const currentSuggestions:
      | IDict<IDict<{ content: ICell; newSource: string }>>
      | undefined = notebook.context.model.getMetadata(METADATA_KEY);
    if (
      !currentSuggestions ||
      !currentSuggestions[cellId] ||
      !currentSuggestions[cellId][suggestionId]
    ) {
      return;
    }

    currentSuggestions[cellId][suggestionId].newSource = newSource;

    notebook.context.model.setMetadata(METADATA_KEY, currentSuggestions);
    await this._saveNotebook(notebook);
  }

  private _deserializedSuggestion(
    serializedData: ISerializedSuggessionData,
    cellMap: IDict<ICellModel>
  ): ISuggestionData {
    const { originalCellId, newSource, metadata, type } = serializedData;
    const originalCellModel = cellMap[serializedData.originalCellId];
    const newCellModel = cloneCellModel(originalCellModel, newSource);
    return {
      originalCellId,
      cellModel: newCellModel,
      metadata,
      type
    };
  }
}
