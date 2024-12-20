<h1 align="center">jupyterlab_suggestions</h1>

[![Github Actions Status](https://github.com/jupyterlab-contrib/jupyter-suggestions/workflows/Build/badge.svg)](https://github.com/jupyterlab-contrib/jupyter-suggestions/actions/workflows/build.yml)

<h2 align="center">A JupyterLab extension for suggesting changes</h2>

https://github.com/user-attachments/assets/5b944b39-562b-4d6e-b0e3-1e16b92224d1

## Requirements

- JupyterLab >= 4.0.0

## Installation

To install the extension, use the following commands:

```bash
pip install jupyter-suggestions
```

By default, `jupyter-suggestions` uses notebook metadata to store suggestions. However, this approach has certain limitations:

- Changes made to the suggested cell are not reflected in the suggestion widget.
- Accepting a suggestion overwrites the content of the suggested cell.

To address these issues, you can install an additional package to utilize the forking capabilities of `jupyter-collaboration`.

```bash
pip install jupyter-suggestions-rtc
```

By using `jupyter-collaboration` as the backend for managing suggestions, the content of suggestions is merged directly into the suggested cell.

## Contributing

`jupyter-suggestions` is an open-source project, and contributions are always welcome. If you would like to contribute to `jupyter-suggestions`, please fork the repository and submit a pull request.

See [CONTRIBUTING](CONTRIBUTING.md) for dev installation instructions.

## License

`jupyter-suggestions` is licensed under the BSD 3-Clause License. See the LICENSE file for more information.
