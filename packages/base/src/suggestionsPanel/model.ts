import { ISharedNotebook, NotebookChange } from '@jupyter/ydoc';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { User } from '@jupyterlab/services';
import { PromiseDelegate } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import {
  IAllSuggestionData,
  IAllSuggestionViewData,
  IDict,
  ISuggestionChange,
  ISuggestionData,
  ISuggestionsManager,
  ISuggestionsModel,
  ISuggestionViewData
} from '../types';
import { detectCellChangedEvent, getCellMap } from '../tools';

export class SuggestionsModel implements ISuggestionsModel {
  constructor(options: SuggestionsModel.IOptions) {
    this._userManager = options.userManager;
    this.switchNotebook(options.panel);
    this.switchManager(options.suggestionsManager);
  }

  get sourceLiveUpdate(): boolean {
    return Boolean(this._suggestionsManager?.sourceLiveUpdate);
  }
  get filePath(): string {
    return this._filePath ?? '';
  }
  get allSuggestionsChanged(): ISignal<ISuggestionsModel, void> {
    return this._allSuggestionsChanged;
  }
  get activeCellChanged(): ISignal<ISuggestionsModel, { cellId?: string }> {
    return this._activeCellChanged;
  }
  get suggestionChanged(): ISignal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  > {
    return this._suggestionChanged;
  }
  get currentNotebookPanel(): NotebookPanel | null {
    return this._notebookPanel;
  }
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  get allSuggestions(): IAllSuggestionViewData | undefined {
    return this._allSuggestions;
  }
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._suggestionsManager?.suggestionChanged.disconnect(
      this._handleSuggestionChanged
    );
    Signal.clearData(this);
  }

  getSuggestionManagerName(): string {
    return this._suggestionsManager?.name ?? '';
  }
  async addSuggestion(): Promise<void> {
    const activeCell = this._notebookPanel?.content.activeCell;
    if (activeCell && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.addSuggestion({
        notebook: this._notebookPanel,
        cell: activeCell,
        author: this._userManager.identity
      });
    }
  }
  async deleteSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<void> {
    const { cellId, suggestionId } = options;
    if (cellId && this._notebookPanel) {
      if (this._suggestionsManager) {
        await this._suggestionsManager.deleteSuggestion({
          notebook: this._notebookPanel,
          cellId,
          suggestionId
        });
      }
      if (this._allSuggestions && this._allSuggestions.has(cellId)) {
        const cellSuggestions = this._allSuggestions.get(cellId)!;
        delete cellSuggestions[suggestionId];
      }
    }
  }

  async acceptSuggestion(options: {
    cellId?: string;
    suggestionId: string;
  }): Promise<boolean> {
    const { cellId, suggestionId } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      return await this._suggestionsManager.acceptSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId
      });
    }
    return false;
  }
  async updateSuggestion(options: {
    cellId?: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    const { cellId, suggestionId, newSource } = options;
    if (cellId && this._notebookPanel && this._suggestionsManager) {
      await this._suggestionsManager.updateSuggestion({
        notebook: this._notebookPanel,
        cellId,
        suggestionId,
        newSource
      });
    }
  }
  async getSuggestion(options: {
    cellId: string;
    suggestionId: string;
  }): Promise<ISuggestionViewData | undefined> {
    if (!this._filePath || !this._suggestionsManager) {
      return;
    }
    const { cellId, suggestionId } = options;
    let cellSuggestions: IDict<ISuggestionViewData> | undefined = undefined;
    if (!this._allSuggestions?.has(cellId)) {
      cellSuggestions = {};
      this._allSuggestions?.set(cellId, cellSuggestions);
    } else {
      cellSuggestions = this._allSuggestions.get(cellId)!;
    }
    if (!cellSuggestions[suggestionId]) {
      const suggestionFromManager =
        await this._suggestionsManager.getSuggestion({
          notebookPath: this._filePath,
          ...options
        });
      const suggestionData = this._convertSuggestionFromManager(
        suggestionFromManager
      );
      if (suggestionData) {
        cellSuggestions[suggestionId] = suggestionData;
      }
    }
    return cellSuggestions[suggestionId];
  }

  getActiveCell(): Cell<ICellModel> | null | undefined {
    return this._notebookPanel?.content.activeCell;
  }
  getCellIndex(cellId?: string): number {
    if (!cellId) {
      return -1;
    }

    const allCells = this._notebookPanel?.content.model?.cells;
    if (!allCells) {
      return -1;
    }
    for (let idx = 0; idx < allCells.length; idx++) {
      const element = allCells.get(idx);
      if (element.id === cellId) {
        return idx;
      }
    }
    return -1;
  }
  async switchNotebook(panel: NotebookPanel | null): Promise<void> {
    if (panel) {
      await panel.context.ready;
      this._disconnectPanelSignal();
      this._notebookPanel = panel;
      this._connectPanelSignal();
      this._filePath = this._notebookPanel?.context.localPath;

      const allSuggestionsFromManager =
        await this._suggestionsManager?.getAllSuggestions(panel);
      this._allSuggestions = this._convertAllSuggestionsFromManager(
        allSuggestionsFromManager
      );
    } else {
      this._allSuggestions = undefined;
    }
    this._promiseQueue = {};
    this._allSuggestionsChanged.emit();
  }
  async switchManager(manager: ISuggestionsManager | undefined): Promise<void> {
    if (!manager) {
      return;
    }
    this._suggestionsManager?.suggestionChanged.disconnect(
      this._handleSuggestionChanged
    );

    this._suggestionsManager = manager;
    this._suggestionsManager.suggestionChanged.connect(
      this._handleSuggestionChanged,
      this
    );
    if (this._notebookPanel) {
      const allSuggestionsFromManager =
        await this._suggestionsManager?.getAllSuggestions(this._notebookPanel);
      this._allSuggestions = this._convertAllSuggestionsFromManager(
        allSuggestionsFromManager
      );
      this._promiseQueue = {};
      this._allSuggestionsChanged.emit();
    }
  }

  private _convertSuggestionFromManager(
    source?: ISuggestionData
  ): ISuggestionViewData | undefined {
    if (!source || !this._notebookPanel) {
      return;
    }
    const { originalCellId, metadata, cellModel } = source;
    const cells = this._notebookPanel.context.model.cells;
    for (const it of cells) {
      if (it.id === originalCellId) {
        return {
          cellModel,
          originalCellModel: it,
          metadata
        };
      }
    }
  }

  private _convertAllSuggestionsFromManager(
    all?: IAllSuggestionData | undefined
  ): IAllSuggestionViewData | undefined {
    if (!all || !this._notebookPanel) {
      return;
    }
    const newMap: IAllSuggestionViewData = new Map();
    all.forEach((suggestionDict, key) => {
      const newDict: IDict<ISuggestionViewData> = {};
      for (const suggestionKey in suggestionDict) {
        const convertedData = this._convertSuggestionFromManager(
          suggestionDict[suggestionKey]
        );
        if (convertedData) {
          newDict[suggestionKey] = convertedData;
        }
      }
      newMap.set(key, newDict);
    });
    return newMap;
  }
  private _connectPanelSignal() {
    if (!this._notebookPanel) {
      return;
    }
    this._notebookPanel.content.activeCellChanged.connect(
      this._handleActiveCellChanged,
      this
    );

    this._notebookPanel.content.model?.sharedModel.changed.connect(
      this._handleNotebookChanged,
      this
    );
  }

  private _disconnectPanelSignal() {
    if (!this._notebookPanel) {
      return;
    }
    this._notebookPanel.content.activeCellChanged.disconnect(
      this._handleActiveCellChanged
    );
  }
  private _handleActiveCellChanged(
    nb: Notebook,
    cell: Cell<ICellModel> | null
  ) {
    this._activeCellChanged.emit({ cellId: cell?.model.id });
  }
  private async _handleNotebookChanged(
    _: ISharedNotebook,
    changed: NotebookChange
  ) {
    const cellChangedEvent = detectCellChangedEvent(changed);
    if (cellChangedEvent) {
      const { event } = cellChangedEvent;
      const cellMap = getCellMap(this._notebookPanel);

      if (event === 'deleted') {
        const cellInNotebook = new Set(Object.keys(cellMap));
        const cellInModel = [...(this._allSuggestions?.keys() ?? [])];
        const removedElements = cellInModel.filter(
          el => !cellInNotebook.has(el)
        );
        for (const removed of removedElements) {
          const suggestions = this._allSuggestions?.get(removed) ?? {};
          for (const suggestionId in suggestions) {
            await this.deleteSuggestion({ cellId: removed, suggestionId });
          }
        }
      }
      if (event === 'moved') {
        const movedCells = cellChangedEvent.movedCells ?? [];
        // Only emit rerender signal if the moved cell has suggestions
        let needEmit = false;
        for (const cell of movedCells) {
          const cellId = cell.id;
          if (!this._promiseQueue[cellId]) {
            this._promiseQueue[cellId] = new PromiseDelegate<void>();
          }
          const pd = this._promiseQueue[cellId];
          if (this._allSuggestions?.has(cellId)) {
            const cellSuggestions = this._allSuggestions.get(cellId)!;
            const allSuggestions = Object.entries(cellSuggestions);
            const originalCell = cellMap[cellId];
            // In case of a stanalone cell shared model, the `cellModel`
            // of the associated suggestion data needs to be updated
            // by the parent document, so we need to wait for it.
            let shouldWait = false;
            if (originalCell && allSuggestions.length > 0) {
              needEmit = true;
              allSuggestions.forEach(([suggestionId, it]) => {
                it.originalCellModel = originalCell;
                shouldWait = it.cellModel.sharedModel.isStandalone;
              });
              if (shouldWait) {
                await pd.promise;
              }
            }
          }

          delete this._promiseQueue[cellId];
        }
        if (needEmit) {
          this._allSuggestionsChanged.emit();
        }
      }
    }
  }

  private _handleSuggestionChanged(
    manager: ISuggestionsManager,
    changed: ISuggestionChange
  ) {
    const { notebookPath, ...newChanged } = changed;
    if (notebookPath === this._filePath) {
      if (changed.operator === 'modified') {
        const { cellId, suggestionId, modifiedData } = changed;
        if (this._allSuggestions?.has(cellId)) {
          const cellSuggestions = this._allSuggestions.get(cellId)!;
          const updatedSuggestion = cellSuggestions[suggestionId];
          if (updatedSuggestion && modifiedData) {
            if (modifiedData.cellModel) {
              updatedSuggestion.cellModel = modifiedData.cellModel;
            }
            if (modifiedData.metadata) {
              updatedSuggestion.metadata = modifiedData.metadata;
            }
          }
        }
        if (!this._promiseQueue[cellId]) {
          this._promiseQueue[cellId] = new PromiseDelegate<void>();
        }
        const pd = this._promiseQueue[cellId];
        pd.resolve();
      } else {
        this._suggestionChanged.emit(newChanged);
      }
    }
  }

  private _isDisposed = false;
  private _filePath?: string;
  private _notebookPanel: NotebookPanel | null = null;
  private _allSuggestionsChanged: Signal<this, void> = new Signal(this);
  private _allSuggestions?: IAllSuggestionViewData;
  private _suggestionsManager?: ISuggestionsManager;
  private _userManager: User.IManager;
  private _suggestionChanged = new Signal<
    ISuggestionsModel,
    Omit<ISuggestionChange, 'notebookPath'>
  >(this);
  private _activeCellChanged = new Signal<
    ISuggestionsModel,
    { cellId?: string }
  >(this);

  /**
   * Queue of promises used to wait for the update of the cell shared
   * model in case of drag-and-drop cell.
   */
  private _promiseQueue: IDict<PromiseDelegate<void>> = {};
}

export namespace SuggestionsModel {
  export interface IOptions {
    panel: NotebookPanel | null;
    suggestionsManager?: ISuggestionsManager;
    userManager: User.IManager;
  }
}
