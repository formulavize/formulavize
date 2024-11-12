# Changelog

## 1.0.0 (2024-11-12)


### ⚠ BREAKING CHANGES

* **cyPopperExtender:** last description no longer overwrites previous ones in name bindings
* **cyPopperExtender:** name binding description styleTag precedence flipped
* astFactory requires update to handle new grammar

### Features

* **ast:** add namespace to ast ([492482e](https://github.com/formulavize/formulavize/commit/492482e66fb4a34adcc58fdf96efa1a67074a84e))
* **ast:** add VariableTreeNode as a Statement ([28b1c92](https://github.com/formulavize/formulavize/commit/28b1c92409d45976cb273f20277688a138683795))
* **cyGraph:** add basic namespace visualization ([8e9827a](https://github.com/formulavize/formulavize/commit/8e9827a527828950b6ecf6b13be8c387d1f88d6d))
* **cyGraph:** add scoped Cytoscape StyleSheets ([34fbe2f](https://github.com/formulavize/formulavize/commit/34fbe2f7a8bea721dc05387b31eb0ac1ed555b48))
* **cyGraph:** add styling to namespaces ([3db0718](https://github.com/formulavize/formulavize/commit/3db0718543a84fd22b1d4122b47df5c128de63d9))
* **cyPopperExtender:** add description poppers for dag nodes ([3d002df](https://github.com/formulavize/formulavize/commit/3d002df5d5ed128a73a3c8b4c78ceeb4591e3f56))
* **cyPopperExtender:** add lineageSelectors to descriptions ([48f0024](https://github.com/formulavize/formulavize/commit/48f002458f4b971e82fef638cc01b07efc51ca80))
* **cyPopperExtender:** allow name bindings to have multiple descriptions ([befecef](https://github.com/formulavize/formulavize/commit/befecef232f095dae399fa2be8713bf772c84c9b))
* **cyPopperExtender:** reverse styleTag precedence in name binding ([f8e10e7](https://github.com/formulavize/formulavize/commit/f8e10e7f17beb169e9b1fea7adf21f005619b98b))
* **cyPopperExtender:** scoped style tags on individual elements handled ([edf5ec3](https://github.com/formulavize/formulavize/commit/edf5ec36ce201d8c874d402a7b617990b989e416))
* **cyStyleSheetsFactory:** scoped style tags apply to individual elements ([620146f](https://github.com/formulavize/formulavize/commit/620146f3f4f90d53ca43518c616977188bbbbab7))
* **dag:** add basic subdag to dag ([db8e417](https://github.com/formulavize/formulavize/commit/db8e4170f02d02e2de7afbd0158ace98ef3b990c))
* **dag:** add namespaces to assignment expression ([ac03bbd](https://github.com/formulavize/formulavize/commit/ac03bbdbd8675e9c2fbd34bc5b459c5b06632154))
* **dag:** namespace args create incoming edges ([eb1b0a9](https://github.com/formulavize/formulavize/commit/eb1b0a963425222f80d7d12161dcd49d43e84b82))
* **dag:** recursively resolve variable names ([cf321d1](https://github.com/formulavize/formulavize/commit/cf321d1b68df7f76565e69f92e4aafae632ab09f))


### Bug Fixes

* **ast:** add qualified identifers for calls ([91e4ace](https://github.com/formulavize/formulavize/commit/91e4aced9feb4032374006279fdb116084e64828))
* **ast:** add qualified identifers for RhsVariable ([9aa8037](https://github.com/formulavize/formulavize/commit/9aa80376770ca1db22564e30fca7b7c3c886b1f3))
* **ast:** add qualified identifiers for StyleTag ([090227c](https://github.com/formulavize/formulavize/commit/090227c39ebc8a0243bbf501994e6c8578cbf98f))
* **cyPopperExtender:** add description poppers in subdags ([a1b3436](https://github.com/formulavize/formulavize/commit/a1b34363638582de1f606e5755810a717a22cca1))
* **dag:** clarify styleTag dump format ([384f67a](https://github.com/formulavize/formulavize/commit/384f67aeec476b4d37973f417fcfdb13cfd6d327))
* **dag:** variable styling respects local declaration ([d02fd61](https://github.com/formulavize/formulavize/commit/d02fd61600f9d895dcae01b7dfac64a64db5c45a))


### Miscellaneous Chores

* update lang-fiz to 0.2.0 ([949b519](https://github.com/formulavize/formulavize/commit/949b519678d816728712ee1d2c9e2c822d9c4d67))
