# Changelog

## [1.4.1](https://github.com/formulavize/formulavize/compare/v1.4.0...v1.4.1) (2025-08-06)


### Bug Fixes

* **dagFactory:** make undefined style tag errors in StyleBinding ([2289fc1](https://github.com/formulavize/formulavize/commit/2289fc108c016c99566a028c9752c564af74df96))

## [1.4.0](https://github.com/formulavize/formulavize/compare/v1.3.0...v1.4.0) (2025-07-26)


### Features

* **dagFactory:** make error messages for incomplete assignments ([3632c00](https://github.com/formulavize/formulavize/commit/3632c007b498a7f77ff4eeaa12bf91f7640c7016))
* **dagFactory:** undefined style tag usage creates error message ([99b884c](https://github.com/formulavize/formulavize/commit/99b884cfa74511843a89aa6396ff4895d4e6c14a))
* **ErrorReporter:** add error report tab to debug mode ([7fe07eb](https://github.com/formulavize/formulavize/commit/7fe07eb20c77cdd3af28b59a03e65c126653ebf9))
* **TextEditor:** editor displays code error diagnostics ([1aa81f3](https://github.com/formulavize/formulavize/commit/1aa81f3f0103a0d5aa47499b847da4b44cca33ea))


### Bug Fixes

* **dagFactory:** add quotes around variable names in error messages ([b6786ab](https://github.com/formulavize/formulavize/commit/b6786ab32abc7ebba9134047f2eba365e356d4fd))
* **dagFactory:** more concise import error message ([67d2812](https://github.com/formulavize/formulavize/commit/67d2812679a8211c01364dddcf6a484535355ea2))
* **dagFactory:** undefined StyleTag errors only underline the tag ([ac3da46](https://github.com/formulavize/formulavize/commit/ac3da4643ba9f3d991d88d39e8c2604e56507788))

## [1.3.0](https://github.com/formulavize/formulavize/compare/v1.2.0...v1.3.0) (2025-07-06)


### Features

* **OptionsPopup:** add an OptionsPopup component ([a2fe6a6](https://github.com/formulavize/formulavize/commit/a2fe6a6beba48501f156dbf7f876254189e4ea45))
* **OptionsPopup:** add Esc key message to Tab to Indent checkbox ([edb8935](https://github.com/formulavize/formulavize/commit/edb89350aa67a690631c4b2d6b0d0900cce9b552))
* **TextEditor:** add tab to indent toggle option ([7a8938d](https://github.com/formulavize/formulavize/commit/7a8938d6343a82f3c4b13e47208c572747f3b1cf))


### Bug Fixes

* **ExportOptionsPopup:** add spacing between icons and text ([0929047](https://github.com/formulavize/formulavize/commit/0929047e38e93ff97d2a72f6204cad1f837ab1e2))
* **OptionsPopup:** constrain max width of option popup ([01769e0](https://github.com/formulavize/formulavize/commit/01769e06f0e35c5073c749c97ceca9d59a677a98))

## [1.2.0](https://github.com/formulavize/formulavize/compare/v1.1.1...v1.2.0) (2025-02-24)


### Features

* **ExportOptionsPopup:** add export options popup ([c083200](https://github.com/formulavize/formulavize/commit/c083200ae8b5080aa76270fc179b455f6958544f))
* **GraphView:** add basic image export ([ac6d833](https://github.com/formulavize/formulavize/commit/ac6d8333ec0ad63827e324d2ec094e3bc0b7df3f))
* **GraphView:** add svg image export ([561c62a](https://github.com/formulavize/formulavize/commit/561c62aa62f19a6d2da995efb02c7ccbe3baafd6))
* **toolbar:** add app title to toolbar ([3c9b76d](https://github.com/formulavize/formulavize/commit/3c9b76d28a59697e27b84e84bdc31c6cc6a75090))
* **toolbar:** add debugMode toggle button ([7aab4e6](https://github.com/formulavize/formulavize/commit/7aab4e69b8977aaaf036b9418c74b5e66aedf3f9))
* **toolbar:** add view github button ([b7d6bb3](https://github.com/formulavize/formulavize/commit/b7d6bb3a176825fc588447ac566cc741bdaac3e7))


### Bug Fixes

* **ExportOptionsPopup:** correct file name length validation message ([fbcab95](https://github.com/formulavize/formulavize/commit/fbcab95901a10baa40f514a1578981cbb0c8d3da))
* **ui:** repaint GraphView on toggling debugMode ([dd9ce7b](https://github.com/formulavize/formulavize/commit/dd9ce7b977f5dad012b0d3b66636e7b386e7257b))

## [1.1.1](https://github.com/formulavize/formulavize/compare/v1.1.0...v1.1.1) (2025-01-04)


### Bug Fixes

* **ast:** remove reference side effect in debugDumpTree ([a9d1618](https://github.com/formulavize/formulavize/commit/a9d1618cf69b4afcff282ee95de46bd8c2941a9f))

## [1.1.0](https://github.com/formulavize/formulavize/compare/v1.0.0...v1.1.0) (2024-12-30)


### Features

* allow import assignment ([c6a966e](https://github.com/formulavize/formulavize/commit/c6a966e28b7eaf69ee6944c428cc91c5d68d36a7))
* **astToDag:** add import statements ([e3d1216](https://github.com/formulavize/formulavize/commit/e3d121642c029b5c19a75ee8bdd07778e0ba56b6))
* **dag:** add used imports to dag dump ([fc3dc5f](https://github.com/formulavize/formulavize/commit/fc3dc5fcc031aa293db869c62c9166ba900344f7))
* **importer:** add import traverser for debugging ([bffd5b0](https://github.com/formulavize/formulavize/commit/bffd5b0228b010810f8ff661aa33cccddd41daf3))


### Bug Fixes

* **astToDag:** imports are processed sequentially ([3d9d668](https://github.com/formulavize/formulavize/commit/3d9d66843af63a257d93cd73b8903a90b384fd9b))
* **editorToAst:** long parse trees no longer prematurely truncated ([c73947f](https://github.com/formulavize/formulavize/commit/c73947f4486d232c15580805bc7d89f8ddf72d72))
* **importer:** protect against circular imports ([265ed23](https://github.com/formulavize/formulavize/commit/265ed23ba908f59e06a113aff621c658ac6d0e99))

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
