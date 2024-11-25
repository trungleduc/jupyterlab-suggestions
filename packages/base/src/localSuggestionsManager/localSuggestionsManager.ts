import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import {
  IAllSuggestions,
  ISuggestionChange,
  ISuggestionsManager
} from '../types';
import { ISignal, Signal } from '@lumino/signaling';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { UUID } from '@lumino/coreutils';
import { ICell } from '@jupyterlab/nbformat';
// import { ICell } from '@jupyterlab/nbformat';
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

  getAllSuggestions(notebook: NotebookPanel): IAllSuggestions | undefined {
    const path = notebook.context.localPath;
    if (this._suggestionsMap.has(path)) {
      return this._suggestionsMap.get(path);
    }
    // TODO Read suggestions from metadata
  }

  getSuggestion(options: {
    notebookPath: string;
    cellId: string;
    suggestionId: string;
  }): { content: ICell } | undefined {
    const { notebookPath, cellId, suggestionId } = options;
    if (this._suggestionsMap.has(notebookPath)) {
      const nbSuggestions = this._suggestionsMap.get(notebookPath);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        return nbSuggestions.get(cellId)![suggestionId];
      }
    }
    // TODO Read suggestions from metadata
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
    cellSuggesions[suggestionId] = { content: cell.model.toJSON() };
    this._suggestionChanged.emit({
      notebookPath: path,
      cellId,
      suggestionId,
      operator: 'added'
    });
    return suggestionId;
  }

  private _notebookAdded(tracker: INotebookTracker, panel: NotebookPanel) {
    panel.disposed.connect(p => {
      const localPath = p.context.localPath;
      if (this._suggestionsMap.has(localPath)) {
        // this._suggestionsMap.delete(localPath);
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
