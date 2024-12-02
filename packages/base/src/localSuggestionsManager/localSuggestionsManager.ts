import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import {
  IAllSuggestions,
  IDict,
  ISuggestionChange,
  ISuggestionData,
  ISuggestionsManager
} from '../types';
import { ISignal, Signal } from '@lumino/signaling';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { UUID } from '@lumino/coreutils';

const METADATA_KEY = 'jupyter_suggestion';
export class LocalSuggestionsManager implements ISuggestionsManager {
  constructor(options: LocalSuggestionsManager.IOptions) {
    this._tracker = options.tracker;
    this._tracker.widgetAdded.connect(this._notebookAdded, this);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get suggestionChanged(): ISignal<ISuggestionsManager, ISuggestionChange> {
    return this._suggestionChanged;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._tracker.widgetAdded.disconnect(this._notebookAdded);
    Signal.clearData(this);
    this._isDisposed = true;
  }

  async getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestions | undefined> {
    const path = notebook.context.localPath;
    if (this._suggestionsMap.has(path)) {
      return this._suggestionsMap.get(path);
    } else {
      const savedSuggestions = notebook.context.model.getMetadata(METADATA_KEY);
      if (savedSuggestions) {
        const currentSuggestion = new Map<string, IDict<ISuggestionData>>(
          Object.entries(savedSuggestions)
        );
        this._suggestionsMap.set(path, currentSuggestion);
        return currentSuggestion;
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
  }): Promise<string> {
    const { notebook, cell } = options;
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
    const suggestionId = UUID.uuid4();
    const cellModel = cell.model.toJSON();
    const suggestionContent: ISuggestionData = {
      content: cellModel,
      newSource: cellModel.source as string
    };
    cellSuggesions[suggestionId] = suggestionContent;
    await this._saveSuggestionToMetadata({
      notebook,
      cellId,
      suggestionId,
      content: suggestionContent
    });
    this._suggestionChanged.emit({
      notebookPath: path,
      cellId,
      suggestionId,
      operator: 'added'
    });
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
      const { newSource } = currentSuggestion;
      for (const element of notebook.content.model.cells) {
        if (element.id === cellId) {
          element.sharedModel.setSource(newSource);
          await this.deleteSuggestion(options);
          return true;
        }
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
        const currentSuggestion = nbSuggestions.get(cellId)![suggestionId];
        currentSuggestion.newSource = newSource;
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
    content: IDict;
  }) {
    const { notebook, cellId, suggestionId, content } = options;
    const currentSuggestions: IDict =
      notebook.context.model.getMetadata(METADATA_KEY) ?? {};

    const newData = {
      ...currentSuggestions,
      [cellId]: {
        ...(currentSuggestions[cellId] ?? {}),
        [suggestionId]: content
      }
    };
    notebook.context.model.setMetadata(METADATA_KEY, newData);
    await notebook.context.save();
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
    notebook.context.model.setMetadata(METADATA_KEY, currentSuggestions);
    await notebook.context.save();
  }

  private async _updateSuggestionInMetadata(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }) {
    const { notebook, cellId, suggestionId, newSource } = options;
    const currentSuggestions: IDict<IDict<ISuggestionData>> | undefined =
      notebook.context.model.getMetadata(METADATA_KEY);
    if (
      !currentSuggestions ||
      !currentSuggestions[cellId] ||
      !currentSuggestions[cellId][suggestionId]
    ) {
      return;
    }

    currentSuggestions[cellId][suggestionId].newSource = newSource;

    notebook.context.model.setMetadata(METADATA_KEY, currentSuggestions);
    await notebook.context.save();
  }

  private _notebookAdded(tracker: INotebookTracker, panel: NotebookPanel) {
    panel.disposed.connect(p => {
      const localPath = p.context.localPath;
      if (this._suggestionsMap.has(localPath)) {
        this._suggestionsMap.delete(localPath);
      }
    });
  }
  private _suggestionChanged = new Signal<
    ISuggestionsManager,
    ISuggestionChange
  >(this);
  private _isDisposed = false;
  private _tracker: INotebookTracker;
  private _suggestionsMap = new Map<string, IAllSuggestions>();
}

export namespace LocalSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
  }
}
