import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import {
  IForkChangedEvent,
  IForkManager,
  requestDocSession
} from '@jupyter/docprovider';
import {
  BaseSuggestionsManager,
  cellModelFromYCell,
  deleteCellById,
  detectCellChangedEvent,
  IAllSuggestionData,
  IDict,
  ISuggestionData,
  ISuggestionMetadata,
  ISuggestionsManager,
  SuggestionType
} from '@jupyter/suggestions-base';
import { NotebookChange, YCellType, YNotebook } from '@jupyter/ydoc';
import { Cell, CellModel, ICellModel } from '@jupyterlab/cells';
import { URLExt } from '@jupyterlab/coreutils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { User } from '@jupyterlab/services';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { WebsocketProvider as YWebsocketProvider } from 'y-websocket';

const DOCUMENT_PROVIDER_URL = 'api/collaboration/room';

interface IForkMetadata {
  cellId?: string;
  path?: string;
  mimeType?: string;
  suggestionType: SuggestionType;
  metadata?: ISuggestionMetadata;
}
export class RtcSuggestionsManager
  extends BaseSuggestionsManager
  implements ISuggestionsManager
{
  constructor(options: RtcSuggestionsManager.IOptions) {
    super(options);
    this._tracker = options.tracker;
    this._tracker;
    this._forkManager = options.forkManager;
    this._drive = options.drive;
    this._serverUrl = URLExt.join(
      this._drive.serverSettings.wsUrl,
      DOCUMENT_PROVIDER_URL
    );
    this._forkManager.forkAdded.connect(this._handleForkAdded, this);
    this._forkManager.forkDeleted.connect(this._handleForkDeleted, this);
  }

  sourceLiveUpdate = true;

  name = 'RTC Suggestion Manager';

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._forkManager.forkAdded.disconnect(this._handleForkAdded);
    this._forkManager.forkDeleted.disconnect(this._handleForkDeleted);
    super.dispose();
  }
  async getAllSuggestions(
    notebook: NotebookPanel
  ): Promise<IAllSuggestionData> {
    const path = notebook.context.localPath;
    let rootDocId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string | undefined;
    let format = 'json';
    let type = 'notebook';
    if (rootDocId) {
      [format, type] = rootDocId.split(':');
    } else {
      const docSession = await requestDocSession(format, type, path);
      rootDocId = `${format}:${type}:${docSession.fileId}`;
      this._serverSession = docSession.sessionId;
    }

    if (!this._serverSession) {
      const docSession = await requestDocSession(format, type, path);
      this._serverSession = docSession.sessionId;
    }
    if (this._suggestionsMap.has(path)) {
      return this._suggestionsMap.get(path)!;
    } else {
      const allForks = await this._forkManager.getAllForks(rootDocId);
      const currentSuggestion = new Map<string, IDict<ISuggestionData>>();
      const cellList = notebook.content.model?.cells ?? [];
      const cellMap: IDict<ICellModel> = {};
      for (const element of cellList) {
        cellMap[element.id] = element;
      }
      for (const [forkRoomId, forkData] of Object.entries(allForks)) {
        const forkMeta = JSON.parse(
          forkData.description ?? '{}'
        ) as IForkMetadata;
        const cellId = forkMeta.cellId;
        if (!cellId || !cellMap[cellId]) {
          continue;
        }
        const metadata = forkMeta.metadata;
        const cellModel = await this._cellModelFactory({
          rootDocId,
          forkRoomId,
          cellId,
          mimeType: cellMap[cellId].mimeType,
          forkMeta
        });
        const data: ISuggestionData = {
          cellModel,
          originalCellId: cellId,
          metadata: metadata ?? {},
          type: forkMeta.suggestionType
        };
        if (currentSuggestion.has(cellId)) {
          const currentData = currentSuggestion.get(cellId)!;
          currentData[forkRoomId] = data;
        } else {
          currentSuggestion.set(cellId, {
            [forkRoomId]: data
          });
        }
      }

      this._suggestionsMap.set(path, currentSuggestion);
      return currentSuggestion;
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
    const { notebook, cell, author, type } = options;
    const path = notebook.context.localPath;

    const cellId = cell.model.id;
    const rootId = notebook.context.model.sharedModel.getState(
      'document_id'
    ) as string;
    const forkMetadata: IForkMetadata = {
      cellId,
      path,
      mimeType: cell.model.mimeType,
      suggestionType: type,
      metadata: { author }
    };
    const response = await this._forkManager.createFork({
      rootId,
      synchronize: true,
      //TODO: Update when the fork manager supports metadata
      description: JSON.stringify(forkMetadata)
    });
    return response?.fork_roomid ?? '';
  }

  async acceptSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<boolean> {
    const { suggestionId, cellId, notebook } = options;
    const notebookPath = notebook.context.localPath;
    const suggestionData = await this.getSuggestion({
      notebookPath,
      cellId,
      suggestionId
    });
    if (!suggestionData) {
      return false;
    }
    const suggestionType = suggestionData.type;
    if (suggestionType === SuggestionType.delete) {
      const sharedModel = this._allSharedNotebook.get(suggestionId);
      const deleted = await deleteCellById({ sharedModel, cellId });
      if (!deleted) {
        return deleted;
      }
    }
    try {
      this._removeSharedNotebook(suggestionId);
      await this._forkManager.deleteFork({ forkId: suggestionId, merge: true });

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async deleteSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
  }): Promise<void> {
    const { suggestionId } = options;
    setTimeout(() => {
      if (this._allSharedNotebook.has(suggestionId)) {
        this._removeSharedNotebook(suggestionId);
        try {
          this._forkManager.deleteFork({
            forkId: suggestionId,
            merge: false
          });
        } catch (e) {
          //
        }
      }
    }, 0);
  }

  async updateSuggestion(options: {
    notebook: NotebookPanel;
    cellId: string;
    suggestionId: string;
    newSource: string;
  }): Promise<void> {
    // no-op
    return;
  }

  private _removeSharedNotebook(suggestionId: string) {
    const ynb = this._allSharedNotebook.get(suggestionId);
    if (ynb) {
      Signal.clearData(ynb);
      ynb.dispose();
    }
    this._allSharedNotebook.delete(suggestionId);
  }
  private _handleForkDeleted(
    manager: IForkManager,
    changed: IForkChangedEvent
  ) {
    const forkInfo = changed.fork_info;
    const forkMeta = JSON.parse(forkInfo.description ?? '{}') as IForkMetadata;
    const { cellId, path } = forkMeta;
    const suggestionId = changed.fork_roomid;
    if (path && cellId && this._suggestionsMap.has(path)) {
      const nbSuggestions = this._suggestionsMap.get(path);
      if (nbSuggestions && nbSuggestions.has(cellId)) {
        delete nbSuggestions.get(cellId)![suggestionId];
        this._suggestionChanged.emit({
          notebookPath: path,
          cellId,
          suggestionId,
          operator: 'deleted'
        });
      }
    }
  }

  /**
   * When a cell is moved in the root document, all forked documents are
   * also updated, we need to listed for this event of all forked documents
   * to be able to update the suggestion data with the newly created
   * shared cell after the move operator.
   *
   */
  private async _handleForkNotebookChanged(
    notebook: YNotebook,
    changed: NotebookChange,
    options: {
      forkCellMimeType: string;
      forkCellId: string;
      forkRoomId: string;
      notebookPath: string;
      suggestionType: SuggestionType;
    }
  ) {
    const { forkCellMimeType, forkCellId, forkRoomId, notebookPath } = options;
    const cellChangedEvent = detectCellChangedEvent(changed);
    if (cellChangedEvent) {
      const { event } = cellChangedEvent;
      if (event === 'moved') {
        const movedCells = cellChangedEvent.movedCells ?? [];
        const cellMap: IDict<YCellType> = {};
        [...(notebook.cells ?? [])].forEach(it => {
          cellMap[it.id] = it;
        });

        for (const cell of movedCells) {
          const cellIdInFork = cell.id;
          if (cellIdInFork === forkCellId) {
            const copiedCellModel = cellModelFromYCell({
              yCell: cell as YCellType,
              mimeType: forkCellMimeType
            });
            if (copiedCellModel) {
              this._suggestionChanged.emit({
                operator: 'modified',
                cellId: forkCellId,
                notebookPath: notebookPath,
                suggestionId: forkRoomId,
                modifiedData: { cellModel: copiedCellModel }
              });
            }
          }
        }
      }
    }
  }

  private async _handleForkAdded(
    manager: IForkManager,
    changed: IForkChangedEvent
  ) {
    const forkInfo = changed.fork_info;
    const forkMeta = JSON.parse(forkInfo.description ?? '{}') as IForkMetadata;
    const { cellId, path, mimeType, metadata, suggestionType } = forkMeta;
    const rootId = forkInfo.root_roomid;
    const suggestionId = changed.fork_roomid;
    if (!path || !cellId) {
      return;
    }
    if (!this._suggestionsMap.has(path)) {
      this._suggestionsMap.set(path, new Map());
    }
    const currentSuggestions = this._suggestionsMap.get(path)!;

    if (!currentSuggestions.has(cellId)) {
      currentSuggestions.set(cellId, {});
    }
    const cellSuggesions = currentSuggestions.get(cellId)!;
    if (cellSuggesions[suggestionId]) {
      return;
    }

    const cellModel = await this._cellModelFactory({
      rootDocId: rootId,
      forkRoomId: suggestionId,
      cellId,
      mimeType: mimeType ?? 'text/plain',
      forkMeta
    });
    const suggestionContent: ISuggestionData = {
      originalCellId: cellId,
      cellModel,
      metadata: metadata ?? {},
      type: suggestionType
    };

    cellSuggesions[suggestionId] = suggestionContent;
    this._suggestionChanged.emit({
      notebookPath: path,
      cellId,
      suggestionId,
      operator: 'added'
    });
  }
  private async _cellModelFactory(options: {
    rootDocId: string;
    forkRoomId: string;
    cellId: string;
    mimeType: string;
    forkMeta: IForkMetadata;
  }): Promise<CellModel | null> {
    const { rootDocId, forkRoomId, cellId, mimeType, forkMeta } = options;
    const [format, type] = rootDocId.split(':');
    const sharedModelFactory =
      this._drive.sharedModelFactory.documentFactories.get(type);
    const pd = new PromiseDelegate<CellModel | null>();
    if (sharedModelFactory) {
      const shared = sharedModelFactory({
        path: forkRoomId,
        format: format as any,
        contentType: type,
        collaborative: true
      }) as any as YNotebook;
      this._allSharedNotebook.set(forkRoomId, shared);
      const handler = (sender: YNotebook, args: NotebookChange) =>
        this._handleForkNotebookChanged(sender, args, {
          forkCellMimeType: mimeType,
          forkCellId: cellId,
          forkRoomId,
          notebookPath: forkMeta.path!,
          suggestionType: forkMeta.suggestionType
        });
      shared.changed.connect(handler);
      shared.disposed.connect(() => {
        shared.changed.disconnect(handler);
      });
      const _yWebsocketProvider = new YWebsocketProvider(
        this._serverUrl,
        forkRoomId,
        shared.ydoc,
        {
          disableBc: true,
          params: { sessionId: this._serverSession! },
          awareness: shared.awareness
        }
      );
      _yWebsocketProvider.on('sync', (isSynced: boolean) => {
        if (isSynced) {
          const selectedCell = shared.cells.filter(it => {
            return it.getId() === cellId;
          });
          if (selectedCell[0]) {
            const currentCell = selectedCell[0];
            const copiedCellModel = cellModelFromYCell({
              yCell: currentCell,
              mimeType
            });
            if (copiedCellModel) {
              pd.resolve(copiedCellModel);
            } else {
              pd.reject('Invalid cell type');
            }
          } else {
            // Cell deletion suggestion
            pd.resolve(null);
          }
        }
      });
    } else {
      pd.reject('Missing factory');
    }
    return pd.promise;
  }
  private _allSharedNotebook = new Map<string, YNotebook>();
  private _forkManager: IForkManager;
  private _drive: ICollaborativeDrive;
  private _serverSession?: string;
  private _serverUrl: string;
}

export namespace RtcSuggestionsManager {
  export interface IOptions {
    tracker: INotebookTracker;
    forkManager: IForkManager;
    drive: ICollaborativeDrive;
  }
}
