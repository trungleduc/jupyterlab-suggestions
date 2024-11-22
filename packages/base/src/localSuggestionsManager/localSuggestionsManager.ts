import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IDict, ISuggestionsManager } from '../types';
import { Signal } from '@lumino/signaling';

export class LocalSuggestionsManager implements ISuggestionsManager {
  constructor(options: LocalSuggestionsManager.IOptions) {
    this._tracker = options.tracker;
    this._tracker.widgetAdded.connect(this._notebookAdded, this);
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._tracker.widgetAdded.disconnect(this._notebookAdded);
    Signal.clearData(this);
    this._isDisposed = true;
  }

  getAllSuggestions(notebook: NotebookPanel): IDict | undefined {
    const path = notebook.context.localPath;
    if (this._suggestionsMap.has(path)) {
      return this._suggestionsMap.get(path);
    }
    // TODO Read suggestions from metadata
  }

  private _notebookAdded(tracker: INotebookTracker, panel: NotebookPanel) {
    panel.disposed.connect(p => {
      const localPath = p.context.localPath;
      if (this._suggestionsMap.has(localPath)) {
        this._suggestionsMap.delete(localPath);
      }
    });
  }
  private _isDisposed = false;
  private _tracker: INotebookTracker;
  private _suggestionsMap = new Map<string, IDict>();
}

export namespace LocalSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
  }
}
