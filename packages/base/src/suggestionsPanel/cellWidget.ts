import { Cell, CodeCell, CodeCellModel } from '@jupyterlab/cells';
import { ICell } from '@jupyterlab/nbformat';
import {
  RenderMimeRegistry,
  standardRendererFactories as initialFactories
} from '@jupyterlab/rendermime';
import { Panel } from '@lumino/widgets';
import { suggestionCellStyle } from './style';
import {
  CodeMirrorEditorFactory,
  EditorExtensionRegistry,
  EditorLanguageRegistry,
  EditorThemeRegistry,
  ybinding
} from '@jupyterlab/codemirror';
import { IYText } from '@jupyter/ydoc';

export class CellWidget extends Panel {
  constructor(options: CellWidget.IOptions) {
    super(options);
    const { cellModel } = options;
    this.addClass(suggestionCellStyle);

    const editorExtensions = () => {
      const themes = new EditorThemeRegistry();
      EditorThemeRegistry.getDefaultThemes().forEach(theme => {
        themes.addTheme(theme);
      });
      const registry = new EditorExtensionRegistry();

      EditorExtensionRegistry.getDefaultExtensions({ themes }).forEach(
        extensionFactory => {
          registry.addExtension(extensionFactory);
        }
      );
      registry.addExtension({
        name: 'shared-model-binding',
        factory: options => {
          const sharedModel = options.model.sharedModel as IYText;
          return EditorExtensionRegistry.createImmutableExtension(
            ybinding({
              ytext: sharedModel.ysource,
              undoManager: sharedModel.undoManager ?? undefined
            })
          );
        }
      });
      return registry;
    };

    const rendermime = new RenderMimeRegistry({ initialFactories });
    const languages = new EditorLanguageRegistry();
    EditorLanguageRegistry.getDefaultLanguages()
      .filter(language =>
        ['ipython', 'julia', 'python'].includes(language.name.toLowerCase())
      )
      .forEach(language => {
        languages.addLanguage(language);
      });

    languages.addLanguage({
      name: 'ipythongfm',
      mime: 'text/x-ipythongfm',
      load: async () => {
        const m = await import('@codemirror/lang-markdown');
        return m.markdown({
          codeLanguages: (info: string) => languages.findBest(info) as any
        });
      }
    });
    const factoryService = new CodeMirrorEditorFactory({
      extensions: editorExtensions(),
      languages
    });
    const model = new CodeCellModel();
    let mimeType = 'text/plain';
    if (cellModel.cell_type === 'code') {
      //TODO Detect correct kernel language
      mimeType = 'text/x-ipython';
    } else if (cellModel.cell_type === 'markdown') {
      mimeType = 'text/x-ipythongfm';
    }
    model.mimeType = mimeType;
    model.sharedModel.setSource(options.cellModel.source as string);
    const cellWidget = new CodeCell({
      contentFactory: new Cell.ContentFactory({
        editorFactory: factoryService.newInlineEditor.bind(factoryService)
      }),
      rendermime,
      model,
      editorConfig: {
        lineNumbers: false,
        lineWrap: false,
        matchBrackets: true,
        tabFocusable: false
      }
    }).initializeState();
    this.addWidget(cellWidget);
  }
}

export namespace CellWidget {
  export interface IOptions extends Panel.IOptions {
    cellModel: ICell;
  }
}
