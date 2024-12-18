import { ISharedCell } from '@jupyter/ydoc';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Debouncer } from '@lumino/polling';
import { Panel, Widget } from '@lumino/widgets';

import {
  IDict,
  ISuggestionChange,
  ISuggestionsModel,
  ISuggestionViewData,
  SuggestionType
} from '../types';
import { suggestionsWidgetAreaStyle } from './style';
import {
  BaseCellwidget,
  SuggestChangeCellWidget,
  SuggestDeleteCellWidget,
  suggestionCellSelectedStyle
} from './suggestionWidget';

export class SuggestionsWidget extends PanelWithToolbar {
  constructor(options: SuggestionsWidget.IOptions) {
    super(options);
    this.title.label = 'All Suggestions';
    this._model = options.model;
    this._suggestionsArea.addClass(suggestionsWidgetAreaStyle);
    this._suggestionsArea.addClass('jp-scrollbar-tiny');
    this.addWidget(this._suggestionsArea);

    this._renderSuggestions();

    this._model.suggestionChanged.connect(this._updateSuggestions, this);

    this._model.allSuggestionsChanged.connect(this._renderSuggestions, this);

    this._model.activeCellChanged.connect(this._handleActiveCellChanged, this);
  }

  dispose(): void {
    this._model.suggestionChanged.disconnect(this._updateSuggestions);

    this._model.allSuggestionsChanged.disconnect(this._renderSuggestions);

    this._model.activeCellChanged.disconnect(this._handleActiveCellChanged);
  }
  private async _updateSuggestions(
    _: ISuggestionsModel,
    changedArg: Omit<ISuggestionChange, 'notebookPath'>
  ) {
    const { operator, cellId, suggestionId } = changedArg;
    switch (operator) {
      case 'added': {
        const suggestion = await this._model.getSuggestion({
          cellId,
          suggestionId
        });
        if (suggestion) {
          const { widget } = this._widgetFactory({
            suggestionId,
            suggestionData: suggestion
          });
          const cellIdx = this._model.getCellIndex(cellId);
          let cellSuggestionPanelData = this._cellSuggestionsPanel.get(cellId);

          if (!cellSuggestionPanelData) {
            const cellSuggestionPanel = new Panel();
            cellSuggestionPanelData = {
              panel: cellSuggestionPanel,
              cellIndex: cellIdx
            };
            this._cellSuggestionsPanel.set(cellId, cellSuggestionPanelData);
            let elementBefore: Widget | undefined = undefined;
            const allIndex = [...this._cellSuggestionsPanel.values()].sort(
              (a, b) => a.cellIndex - b.cellIndex
            );
            for (const element of allIndex) {
              if (element.cellIndex < cellIdx) {
                elementBefore = element.panel;
              } else {
                break;
              }
            }
            let indexToInsert = 0;
            if (elementBefore) {
              indexToInsert =
                this._suggestionsArea.widgets.indexOf(elementBefore) + 1;
            }
            this._suggestionsArea.insertWidget(
              indexToInsert,
              cellSuggestionPanel
            );
          }
          cellSuggestionPanelData.panel.addWidget(widget);

          this._highlightCellSuggestions(cellId);
        }
        break;
      }
      case 'deleted': {
        const cellSuggestionsData = this._cellSuggestionsPanel.get(cellId);
        if (!cellSuggestionsData) {
          break;
        }
        const allWidgets = [...cellSuggestionsData.panel.widgets];
        for (const element of allWidgets) {
          if (element.id === suggestionId) {
            element.dispose();
            element.parent = null;

            break;
          }
        }
        break;
      }
      case 'modified': {
        break;
      }

      default:
        break;
    }

    this._updatePanelTitle();
  }

  private _handleActiveCellChanged(
    sender: ISuggestionsModel,
    args: { cellId?: string }
  ) {
    const { cellId } = args;
    cellId && this._highlightCellSuggestions(cellId);
  }
  private _highlightCellSuggestions(cellId: string): void {
    this._cellSuggestionsPanel.forEach((p, k) => {
      const { panel } = p;
      if (k === cellId) {
        panel.addClass(suggestionCellSelectedStyle);
        let lastElement: Widget | undefined = undefined;
        for (const element of panel.widgets) {
          (element as BaseCellwidget).toggleMinimized(false);
          lastElement = element;
        }
        this._scrollToWidget(panel, lastElement);
      } else {
        panel.removeClass(suggestionCellSelectedStyle);
      }
    });
  }
  private _scrollToWidget(parent?: Widget, w?: Widget) {
    if (!parent || !w) {
      return;
    }
    const parentToTop = parent.node.offsetTop;

    const childToParent = w.node.offsetTop;
    this._suggestionsArea.node.scrollTop = parentToTop + childToParent;
  }

  private _renderSuggestions() {
    const allSuggestions = this._model.allSuggestions;

    this._cellSuggestionsPanel.forEach(it => {
      const { panel } = it;
      const allWidgets = [...panel.widgets];
      for (const element of allWidgets) {
        panel.layout?.removeWidget(element);
        element.dispose();
        element.parent = null;
      }
      panel.dispose();
      panel.parent = null;
      this._suggestionsArea.layout?.removeWidget(panel);
    });
    this._cellSuggestionsPanel.clear();
    if (allSuggestions) {
      const suggestionPanelByIndex: IDict<Panel> = {};
      for (const [cellId, val] of allSuggestions.entries()) {
        const cellSuggestionPanel = new Panel();
        const cellIdx = this._model.getCellIndex(cellId);
        this._cellSuggestionsPanel.set(cellId, {
          panel: cellSuggestionPanel,
          cellIndex: cellIdx
        });
        suggestionPanelByIndex[cellIdx] = cellSuggestionPanel;
        Object.entries(val).forEach(([suggestionId, suggestionData]) => {
          const { widget } = this._widgetFactory({
            suggestionId,
            suggestionData
          });
          cellSuggestionPanel.addWidget(widget);
        });
      }
      const sortedKey = [...Object.keys(suggestionPanelByIndex)].sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      for (const k of sortedKey) {
        this._suggestionsArea.insertWidget(
          parseInt(k),
          suggestionPanelByIndex[k]
        );
      }
    }

    this._updatePanelTitle();

    const activeCell = this._model.getActiveCell();
    const activeCellId = activeCell?.model.id;
    this._handleActiveCellChanged(this._model, { cellId: activeCellId });
  }

  private _updatePanelTitle(): void {
    let count = 0;
    this._cellSuggestionsPanel.forEach(it => {
      count += it.panel.widgets.length;
    });
    if (count !== 0) {
      this.title.label = `All Suggestions (${count})`;
    } else {
      this.title.label = 'All Suggestions';
    }
  }

  private _widgetFactory(options: {
    suggestionId: string;
    suggestionData: ISuggestionViewData;
  }): { widget: BaseCellwidget } {
    const { suggestionId, suggestionData } = options;
    const cellId = suggestionData.originalCellModel.id as string | undefined;
    const deleteCallback = async () => {
      const { button } = await showDialog({
        title: 'Discard suggestion',
        body: 'Do you want to discard the suggestion?',
        buttons: [Dialog.cancelButton(), Dialog.okButton()],
        hasClose: true
      });
      if (button.accept) {
        await this._model.deleteSuggestion({ cellId, suggestionId });
      }
    };

    const debouncer = new Debouncer(async (cellModel: ISharedCell) => {
      const newContent = cellModel.toJSON();
      await this._model.updateSuggestion({
        cellId,
        suggestionId,
        newSource: newContent.source as string
      });
    }, 500);
    suggestionData.cellModel.sharedModel.changed.connect(
      async (cellModel, changed) => {
        debouncer.invoke(cellModel);
      }
    );
    suggestionData.cellModel.sharedModel.disposed.connect(
      () => void debouncer.dispose()
    );

    const acceptCallback = async () => {
      const accepted = await this._model.acceptSuggestion({
        cellId,
        suggestionId
      });
      if (!accepted) {
        const { button } = await showDialog({
          title: 'Error accepting suggestion',
          body: 'Cannot accept suggestion, do you want to discard it?',
          buttons: [Dialog.cancelButton(), Dialog.okButton()],
          hasClose: true
        });
        if (button.accept) {
          await this._model.deleteSuggestion({ cellId, suggestionId });
        }
      }
    };
    const navigateCallback = async () => {
      this._model.nativateToCell(cellId);
    };
    let Cls: typeof BaseCellwidget = BaseCellwidget;
    switch (suggestionData.type) {
      case SuggestionType.change:
        Cls = SuggestChangeCellWidget;
        break;
      case SuggestionType.delete:
        Cls = SuggestDeleteCellWidget;
        break;
      default:
        break;
    }
    const w = new Cls({
      suggestionData,
      deleteCallback,
      acceptCallback,
      navigateCallback,
      liveUpdate: this._model.sourceLiveUpdate
    });

    w.id = suggestionId;
    return { widget: w };
  }

  private _suggestionsArea = new Panel();
  private _cellSuggestionsPanel = new Map<
    string,
    { panel: Panel; cellIndex: number }
  >();
  private _model: ISuggestionsModel;
}

export namespace SuggestionsWidget {
  export interface IOptions extends PanelWithToolbar.IOptions {
    model: ISuggestionsModel;
  }
}
