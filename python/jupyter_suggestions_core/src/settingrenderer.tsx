import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { FieldProps } from '@rjsf/utils';
const SETTING_NAME = 'suggestionsManager';

interface IProps extends FieldProps {
  translator: ITranslator;
}

/**
 * Custom setting renderer for suggestion extension extension.
 */
export function SuggestionsSettingComponent(props: IProps): JSX.Element {
  const { formContext, schema } = props;
  const settings = useMemo<ISettingRegistry.ISettings | undefined>(
    () => formContext.settings,
    [formContext.settings]
  );
  const selectedValue = useMemo<string>(() => {
    return (settings?.composite?.[SETTING_NAME] ?? 'None') as string;
  }, [settings?.composite]);

  useEffect(() => {
    setState(selectedValue);
  }, [selectedValue]);
  const [state, setState] = useState(selectedValue);
  const allOptions = useMemo(() => {
    const allManagers = schema['availableManagers'] as string[];
    return [...allManagers].map(it => ({ value: it, label: it }));
  }, [schema]);

  const onChange = useCallback(
    (value: string) => {
      settings?.set(SETTING_NAME, value);
      setState(value);
    },
    [settings]
  );
  return (
    <div className="jp-inputFieldWrapper jp-FormGroup-contentItem">
      <select
        className="form-control"
        value={state}
        onChange={e => onChange(e.target.value)}
      >
        {allOptions.map((it, idx) => (
          <option key={idx} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
    </div>
  );
}
