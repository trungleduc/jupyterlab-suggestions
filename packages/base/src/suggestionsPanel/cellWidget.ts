import { Cell, CodeCell, CodeCellModel } from '@jupyterlab/cells';
import {
  CodeMirrorEditorFactory,
  EditorLanguageRegistry
} from '@jupyterlab/codemirror';
import { ICell } from '@jupyterlab/nbformat';
import {
  RenderMimeRegistry,
  standardRendererFactories as initialFactories
} from '@jupyterlab/rendermime';
import { Panel } from '@lumino/widgets';
import { suggestionCellStyle } from './style';

export class CellWidget extends Panel {
  constructor(options: CellWidget.IOptions) {
    super(options);
    this.addClass(suggestionCellStyle);
    const rendermime = new RenderMimeRegistry({ initialFactories });
    const languages = new EditorLanguageRegistry();
    EditorLanguageRegistry.getDefaultLanguages()
      .filter(language =>
        ['ipython', 'julia', 'python'].includes(language.name.toLowerCase())
      )
      .forEach(language => {
        languages.addLanguage(language);
      });
    const factoryService = new CodeMirrorEditorFactory({
      languages
    });
    const model = new CodeCellModel();
    model.sharedModel.setSource(options.cellModel.source as string);
    const cellWidget = new CodeCell({
      contentFactory: new Cell.ContentFactory({
        editorFactory: factoryService.newInlineEditor.bind(factoryService)
      }),
      rendermime,
      model
    });
    this.addWidget(cellWidget);
  }
}

export namespace CellWidget {
  export interface IOptions extends Panel.IOptions {
    cellModel: ICell;
  }
}
