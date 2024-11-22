import {
  hintIcon,
  ISuggestionsModel,
  ISuggestionsModelToken,
  SuggestionsModel,
  SuggestionsPanelWidget,
  LocalSuggestionsManager,
  ISuggestionsManager,
  ISuggestionsManagerToken
} from '@jupyter/jupyter-suggestions-base';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

const NAME_SPACE = '@jupyter/jupyter-suggestions-core';

export const suggestionsModelPlugin: JupyterFrontEndPlugin<ISuggestionsModel> =
  {
    id: `${NAME_SPACE}:model`,
    description: 'The model of the suggestions panel',
    autoStart: true,
    requires: [INotebookTracker, ISuggestionsManagerToken],
    provides: ISuggestionsModelToken,
    activate: (
      app: JupyterFrontEnd,
      tracker: INotebookTracker,
      suggestionsManager: ISuggestionsManager
    ): ISuggestionsModel => {
      console.log(`${NAME_SPACE}:model is activated`);
      const model = new SuggestionsModel({
        panel: tracker.currentWidget,
        suggestionsManager
      });
      tracker.currentChanged.connect(async (_, changed) => {
        if (changed) {
          await changed.context.ready;
          model.switchNotebook(changed);
        } else {
          model.switchNotebook(null);
        }
      });
      return model;
    }
  };

export const COMMAND_IDS = {
  /**
   * Command to add a cell suggestion.
   */
  addCellSuggestion: 'jupyter-suggestions-core:add-cell-suggestion'
};

export const commandsPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:commands`,
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [INotebookTracker, ISuggestionsModelToken],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    model: ISuggestionsModel,
    translator_: ITranslator | null
  ) => {
    console.log(`${NAME_SPACE}:commands is activated`);
    const { commands } = app;
    const translator = translator_ ?? nullTranslator;
    const trans = translator.load('jupyterlab');
    commands.addCommand(COMMAND_IDS.addCellSuggestion, {
      icon: hintIcon,
      caption: trans.__('Add suggestion'),
      execute: () => {
        const current = tracker.currentWidget;
        if (current === model.currentNotebookPanel) {
          model.addSuggestion();
        }
      },
      isVisible: () => true
    });
    tracker.activeCellChanged.connect(() => {
      commands.notifyCommandChanged(COMMAND_IDS.addCellSuggestion);
    });
    tracker.selectionChanged.connect(() => {
      commands.notifyCommandChanged(COMMAND_IDS.addCellSuggestion);
    });
  }
};

export const suggestionsPanelPlugin: JupyterFrontEndPlugin<void> = {
  id: `${NAME_SPACE}:panel`,
  description: 'A JupyterLab extension for suggesting changes.',
  autoStart: true,
  requires: [ISuggestionsModelToken, ILayoutRestorer],
  optional: [ITranslator],
  activate: (
    app: JupyterFrontEnd,
    model: ISuggestionsModel,
    restorer: ILayoutRestorer,
    translator_: ITranslator | null
  ) => {
    console.log(`${NAME_SPACE}:panel is activated`);
    const translator = translator_ ?? nullTranslator;
    const panel = new SuggestionsPanelWidget({ model, translator });
    panel.id = 'jupyter-suggestions:main-panel';
    panel.title.caption = 'Jupyter Suggestions';
    panel.title.icon = hintIcon;
    if (restorer) {
      restorer.add(panel, NAME_SPACE);
    }
    app.shell.add(panel, 'right', { rank: 2000, activate: false });
  }
};

export const suggestionsManagerPlugin: JupyterFrontEndPlugin<ISuggestionsManager> =
  {
    id: `${NAME_SPACE}:manager`,
    description: 'A JupyterLab extension for suggesting changes.',
    autoStart: true,
    requires: [INotebookTracker],
    provides: ISuggestionsManagerToken,
    activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
      const manager = new LocalSuggestionsManager({ tracker });
      return manager;
    }
  };
